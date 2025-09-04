/**
 * @module useProfileData
 * Custom hook for profile data loading with instant cache and background refresh
 * Handles all profile loading logic, caching, and state management
 *  Consistent instruments/genres/videos formatting to prevent rendering errors
 *  Compatible with updated BackgroundDataService and cacheManager
 */

import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCurrentUserEmail } from '../utils/userUtils';
import { fetchUserProfile } from '../services/profileService';
import { getProfileCache, cacheUserProfile, clearAllCaches } from '../utils/cacheManager';
import {
    handleError,
    ERROR_MESSAGES
} from '../utils/errors';
import { createLogger } from '../utils/Logger';

const logger = createLogger('useProfileData');

/* ------------------------ Small parsing/normalization helpers ------------------------ */

/** Try JSON.parse if the value looks like JSON */
const tryParseJSON = (value) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    if (!v) return value;
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '{' && last === '}') || (first === '[' && last === ']')) {
        try { return JSON.parse(v); } catch { return value; }
    }
    return value;
};

/** Parse a *simple* Postgres TEXT[] string like "{a,b,c}" into an array of strings */
const parsePgArray = (value) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    if (!(v.startsWith('{') && v.endsWith('}'))) return value;

    // Remove braces, then split by comma not inside quotes (simple case: URLs rarely contain commas)
    const inner = v.slice(1, -1);
    // Strip optional quotes around items and unescape common sequences
    return inner
        .split(',')
        .map(item => item.trim())
        .map(item => {
            // remove wrapping quotes if present
            if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                item = item.slice(1, -1);
            }
            return item.replace(/\\"/g, '"').replace(/\\'/g, "'");
        })
        .filter(Boolean);
};

/** Ensure an array (handles JSON strings and PG array strings) */
const ensureArray = (value) => {
    if (Array.isArray(value)) return value;
    const maybeJson = tryParseJSON(value);
    if (Array.isArray(maybeJson)) return maybeJson;
    const maybePg = parsePgArray(maybeJson);
    if (Array.isArray(maybePg)) return maybePg;
    return [];
};

/** Ensure a plain object (handles JSON string) */
const ensureObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    const maybeJson = tryParseJSON(value);
    if (maybeJson && typeof maybeJson === 'object' && !Array.isArray(maybeJson)) return maybeJson;
    return null;
};

/** Safe field formatter to prevent object rendering errors (fallback to default text) */
const formatFieldSafely = (value, defaultValue = 'Not specified') => {
    if (value === null || value === undefined) return defaultValue;

    // If JSON string -> parse first
    const parsed = tryParseJSON(value);

    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        return keys.length > 0 ? keys.join(', ') : defaultValue;
    }

    if (Array.isArray(parsed)) {
        const filtered = parsed.filter(item => item !== null && item !== undefined && item !== '');
        return filtered.length > 0 ? filtered.join(', ') : defaultValue;
    }

    const stringValue = String(parsed).trim();
    return stringValue || defaultValue;
};

/* ------------------------ Profile normalization ------------------------ */

const normalizeProfileData = (profileData) => {
    if (!profileData) return null;

    // Map common naming mismatches from backend
    const addressOrLocation = profileData.location ?? profileData.address ?? null;

    // Instruments may come as object, array, JSON string, or plain string
    const asObject = ensureObject(profileData.instruments);
    const asArray = ensureArray(profileData.instruments);

    // Genres/videos may come as array, JSON array string, or PG TEXT[] string
    const genresArray = ensureArray(profileData.genres);
    const videosArray = ensureArray(profileData.videos);

    // Build a friendly instruments string
    const instrumentsString = (() => {
        if (asObject) {
            const keys = Object.keys(asObject);
            return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
        }
        if (asArray.length > 0) {
            return asArray.join(', ');
        }
        // fallback to raw string (safe format)
        return formatFieldSafely(profileData.instruments, 'Guitar, Acoustic Guitar');
    })();

    return {
        ...profileData,
        // display-safe primitives
        username: formatFieldSafely(profileData.username, 'Unknown'),
        bio: formatFieldSafely(profileData.bio, 'Music enthusiast looking to connect!'),
        location: formatFieldSafely(addressOrLocation, 'Unknown'),

        // numbers safe
        age: typeof profileData.age === 'number' ? profileData.age : null,
        rating: typeof profileData.rating === 'number' ? profileData.rating : null,
        followers: typeof profileData.followers === 'number' ? profileData.followers : 0,
        following: typeof profileData.following === 'number' ? profileData.following : 0,
        likes: typeof profileData.likes === 'number' ? profileData.likes : 0,

        // final normalized collections
        instruments: instrumentsString,      // string for easy rendering
        instruments_raw: asObject || asArray, // keep raw form if the UI needs it
        genres: genresArray,                 // stay array (chips UI, etc.)
        videos: videosArray,                 // always array
    };
};

/* ------------------------------------ Hook ------------------------------------ */

export const useProfileData = () => {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [loadSource, setLoadSource] = useState('');
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

    const backgroundRefreshTimeout = useRef(null);
    const mountedRef = useRef(true);

    /* ----------------------------- Logout with cleanup ----------------------------- */

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out? This will clear all cached data from your device.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: performLogout },
            ]
        );
    };

    const performLogout = async () => {
        setLoggingOut(true);
        try {
            // Best effort cache clear
            try { await clearAllCaches(); } catch (cacheError) {
                console.warn('⚠️ Cache clear failed during logout:', cacheError);
            }

            const result = await signOut();

            if (result.success) {
                if (mountedRef.current) {
                    setProfile(null);
                    setLoading(false);
                    setError(null);
                }
            } else {
                if (mountedRef.current) {
                    Alert.alert(
                        'Logout Failed',
                        handleError(result.error, 'useProfileData/performLogout') || ERROR_MESSAGES.AUTH.SIGNIN_FAILED,
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (err) {
            if (mountedRef.current) {
                Alert.alert(
                    'Logout Error',
                    handleError(err, 'useProfileData/performLogout') || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR,
                    [{ text: 'OK' }]
                );
            }
        } finally {
            if (mountedRef.current) setLoggingOut(false);
        }
    };

    /* ------------------------------- Load strategies ------------------------------- */

    // INSTANT cache → background refresh
    const loadProfileInstantly = async () => {
        try {
            const userEmail = user?.email || await getCurrentUserEmail();
            if (!userEmail) {
                if (mountedRef.current) setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
                return;
            }

            // STEP 1: INSTANT CACHE (no spinner)
            try {
                const cachedProfile = await getProfileCache(userEmail);
                if (cachedProfile && mountedRef.current) {
                    const normalized = normalizeProfileData(cachedProfile);
                    setProfile(normalized);
                    setLoadSource('permanent_cache');
                    setError(null);

                    logger.info('✅ Loaded normalized cached profile', {
                        username: normalized.username,
                        videos: normalized.videos?.length || 0
                    });

                    // STEP 2: SILENT BACKGROUND REFRESH
                    silentBackgroundRefresh(userEmail);
                    return normalized;
                }
            } catch (cacheError) {
                console.warn('⚠️ Cache loading failed:', cacheError);
            }

            // STEP 3: NO CACHE → FRESH LOAD
            if (mountedRef.current) setLoading(true);
            await loadFreshProfile(userEmail);

        } catch (err) {
            console.error('❌ useProfileData: Error in instant loading:', err);
            if (mountedRef.current) {
                setError(handleError(err, 'useProfileData/loadProfileInstantly'));
                setLoading(false);
            }
        }
    };

    // SILENT background refresh (no UI blocking)
    const silentBackgroundRefresh = async (userEmail) => {
        try {
            if (backgroundRefreshTimeout.current) {
                clearTimeout(backgroundRefreshTimeout.current);
            }

            backgroundRefreshTimeout.current = setTimeout(async () => {
                if (!mountedRef.current) return;

                setIsBackgroundRefreshing(true);

                try {
                    const fresh = await fetchUserProfile('email', userEmail);
                    if (!mountedRef.current) return;

                    const normalizedFresh = normalizeProfileData(fresh);
                    const normalizedCurrent = normalizeProfileData(profile);

                    const currentStr = JSON.stringify(normalizedCurrent);
                    const freshStr = JSON.stringify(normalizedFresh);

                    if (currentStr !== freshStr) {
                        setProfile(normalizedFresh);
                        setLoadSource('background_refresh');
                        logger.info('🔄 Profile updated via background refresh');
                    }

                    try {
                        await cacheUserProfile(normalizedFresh, userEmail);
                    } catch (cacheError) {
                        console.warn('⚠️ Background cache failed:', cacheError);
                    }
                } catch (refreshError) {
                    console.warn('⚠️ Background refresh failed:', refreshError);
                } finally {
                    if (mountedRef.current) setIsBackgroundRefreshing(false);
                }
            }, 100);
        } catch (error) {
            console.error('❌ Background refresh setup failed:', error);
            if (mountedRef.current) setIsBackgroundRefreshing(false);
        }
    };

    // FRESH API load (also used by pull-to-refresh and after uploads)
    const loadFreshProfile = async (userEmail) => {
        try {
            setLoadSource('fresh_api');
            const profileData = await fetchUserProfile('email', userEmail);

            if (profileData && mountedRef.current) {
                const normalized = normalizeProfileData(profileData);
                setProfile(normalized);

                logger.info('✅ Loaded normalized fresh profile', {
                    username: normalized.username,
                    videos: normalized.videos?.length || 0
                });

                try {
                    await cacheUserProfile(normalized, userEmail);
                } catch (cacheError) {
                    console.warn('⚠️ Fresh profile cache failed:', cacheError);
                }
            } else if (mountedRef.current) {
                setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
            }
        } catch (err) {
            console.error('❌ useProfileData: Fresh profile loading failed:', err);
            if (mountedRef.current) setError(handleError(err, 'useProfileData/loadFreshProfile'));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    // Pull-to-refresh (user-initiated)
    const onRefresh = async () => {
        if (!mountedRef.current) return;
        setRefreshing(true);
        try {
            const userEmail = user?.email || await getCurrentUserEmail();
            if (userEmail) await loadFreshProfile(userEmail);
            else if (mountedRef.current) setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
        } catch (err) {
            if (mountedRef.current) setError(handleError(err, 'useProfileData/onRefresh'));
        } finally {
            if (mountedRef.current) setRefreshing(false);
        }
    };

    /* ------------------------------ Instruments text ------------------------------ */

    const formatInstruments = () => {
        if (!profile?.instruments) return 'Guitar, Acoustic Guitar';
        const instruments = profile.instruments;
        if (typeof instruments === 'object' && !Array.isArray(instruments)) {
            const keys = Object.keys(instruments);
            return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
        }
        if (Array.isArray(instruments)) {
            const filtered = instruments.filter(i => i !== null && i !== undefined && i !== '');
            return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
        }
        return String(instruments) || 'Guitar, Acoustic Guitar';
    };

    /* --------------------------------- Lifecycle --------------------------------- */

    useEffect(() => {
        mountedRef.current = true;
        loadProfileInstantly();

        return () => {
            // mark unmounted
            mountedRef.current = false;

            // Clear timers only — DO NOT set state during unmount
            if (backgroundRefreshTimeout.current) {
                clearTimeout(backgroundRefreshTimeout.current);
                backgroundRefreshTimeout.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Auto-sync with AuthContext user data changes (e.g., after upload the
     * Upload screen updates the user in context → reflect here immediately).
     */
    useEffect(() => {
        if (!user || !mountedRef.current) return;

        logger.debug('🔄 AuthContext user changed; checking profile sync', {
            username: user.username,
            contextVideosCount: Array.isArray(user.videos) ? user.videos.length : 0,
            profileVideosCount: Array.isArray(profile?.videos) ? profile.videos.length : 0
        });

        if (Array.isArray(user.videos) && profile) {
            const currentVideos = profile.videos || [];
            const userVideos = user.videos;

            if (JSON.stringify(currentVideos) !== JSON.stringify(userVideos)) {
                logger.info('📹 Syncing profile.videos with context user.videos', {
                    currentCount: currentVideos.length,
                    newCount: userVideos.length
                });

                const updatedProfile = normalizeProfileData({
                    ...profile,
                    ...user,
                    videos: userVideos
                });

                setProfile(updatedProfile);

                if (user.email) {
                    cacheUserProfile(updatedProfile, user.email).catch(cacheError => {
                        logger.warn('⚠️ Failed to cache synced profile', { error: cacheError.message });
                    });
                }
            }
        }
        // Only react to the specific fields we care about
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.videos, user?.username]);

    /* ---------------------- Public method for post-upload refresh ---------------------- */

    /**
     * Force a fresh server fetch (use this right after a successful upload+DB update).
     * Example usage from VideoUploadScreen:
     *   const { refreshFromServer } = useProfileData();
     *   await refreshFromServer();
     */
    const refreshFromServer = async () => {
        const userEmail = user?.email || await getCurrentUserEmail();
        if (!userEmail) return;
        await loadFreshProfile(userEmail);
    };

    /* ----------------------------------- Return ----------------------------------- */

    return {
        // data
        profile,
        loading,
        error,
        refreshing,
        loggingOut,
        loadSource,
        isBackgroundRefreshing,

        // actions
        handleLogout,
        onRefresh,
        loadProfileInstantly,
        refreshFromServer,     // ← call this after video upload succeeds

        // utils
        formatInstruments,
    };
};
