import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCurrentUserEmail } from '../utils/userUtils';
import { fetchUserProfile } from '../services/profileService';
import { getProfileCache, cacheUserProfile } from '../utils/cacheManager';
import AppMemoryManager from '../utils/AppMemoryManager';
import {
    handleError,
    ERROR_MESSAGES
} from '../utils/errors';
import { createLogger } from '../utils/Logger';

const logger = createLogger('useProfileData');

/**
 * Try JSON.parse if the value looks like JSON
 */
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

/**
 * Parse a simple Postgres TEXT[] string like "{a,b,c}" into an array of strings
 */
const parsePgArray = (value) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    if (!(v.startsWith('{') && v.endsWith('}'))) return value;

    const inner = v.slice(1, -1);
    return inner
        .split(',')
        .map(item => item.trim())
        .map(item => {
            if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                item = item.slice(1, -1);
            }
            return item.replace(/\\"/g, '"').replace(/\\'/g, "'");
        })
        .filter(Boolean);
};

/**
 * Ensure an array (handles JSON strings and PG array strings)
 */
const ensureArray = (value) => {
    if (Array.isArray(value)) return value;
    const maybeJson = tryParseJSON(value);
    if (Array.isArray(maybeJson)) return maybeJson;
    const maybePg = parsePgArray(maybeJson);
    if (Array.isArray(maybePg)) return maybePg;
    return [];
};

/**
 * Ensure a plain object (handles JSON string)
 */
const ensureObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    const maybeJson = tryParseJSON(value);
    if (maybeJson && typeof maybeJson === 'object' && !Array.isArray(maybeJson)) return maybeJson;
    return null;
};

/**
 * Safe field formatter to prevent object rendering errors
 */
const formatFieldSafely = (value, defaultValue = 'Not specified') => {
    if (value === null || value === undefined) return defaultValue;

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

/**
 * Profile normalization with safe rendering
 */
const normalizeProfileData = (profileData) => {
    if (!profileData) return null;

    const addressOrLocation = profileData.location ?? profileData.address ?? null;

    const asObject = ensureObject(profileData.instruments);
    const asArray = ensureArray(profileData.instruments);

    const genresArray = ensureArray(profileData.genres);
    const videosArray = ensureArray(profileData.videos);

    const instrumentsString = (() => {
        if (asObject) {
            const keys = Object.keys(asObject);
            return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
        }
        if (asArray.length > 0) {
            return asArray.join(', ');
        }
        return formatFieldSafely(profileData.instruments, 'Guitar, Acoustic Guitar');
    })();

    return {
        ...profileData,
        username: formatFieldSafely(profileData.username, 'Unknown'),
        bio: formatFieldSafely(profileData.bio, 'Music enthusiast looking to connect!'),
        location: formatFieldSafely(addressOrLocation, 'Unknown'),

        age: typeof profileData.age === 'number' ? profileData.age : null,
        rating: typeof profileData.rating === 'number' ? profileData.rating : null,
        followers: typeof profileData.followers === 'number' ? profileData.followers : 0,
        following: typeof profileData.following === 'number' ? profileData.following : 0,
        likes: typeof profileData.likes === 'number' ? profileData.likes : 0,

        profile_picture: profileData.profile_picture || profileData.profilePicture || 'https://i.pravatar.cc/150?img=1',

        instruments: instrumentsString,
        instruments_raw: asObject || asArray,
        genres: genresArray,
        videos: videosArray,
    };
};

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

    /**
     * Logout with coordinated cleanup through single gate
     */
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
            // Request emergency cleanup through single gate instead of direct cache clearing
            logger.info('🚪 Requesting cleanup before logout');
            AppMemoryManager.forceCleanup('user_logout');

            const result = await signOut();

            if (result.success) {
                if (mountedRef.current) {
                    setProfile(null);
                    setLoading(false);
                    setError(null);
                }
                logger.info('✅ Logout completed successfully');
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
            logger.error('❌ Logout error', { error: err.message });
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

    /**
     * Instant cache load with background refresh
     */
    const loadProfileInstantly = async () => {
        try {
            const userEmail = user?.email || await getCurrentUserEmail();
            if (!userEmail) {
                if (mountedRef.current) setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
                return;
            }

            // Step 1: Instant cache load
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

                    // Step 2: Silent background refresh
                    silentBackgroundRefresh(userEmail);
                    return normalized;
                }
            } catch (cacheError) {
                logger.warn('⚠️ Cache loading failed', { error: cacheError.message });
            }

            // Step 3: Fresh load if no cache
            if (mountedRef.current) setLoading(true);
            await loadFreshProfile(userEmail);

        } catch (err) {
            logger.error('❌ Error in instant loading', { error: err.message });
            if (mountedRef.current) {
                setError(handleError(err, 'useProfileData/loadProfileInstantly'));
                setLoading(false);
            }
        }
    };

    /**
     * Silent background refresh
     */
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
                        logger.warn('⚠️ Background cache failed', { error: cacheError.message });
                    }
                } catch (refreshError) {
                    logger.warn('⚠️ Background refresh failed', { error: refreshError.message });
                } finally {
                    if (mountedRef.current) setIsBackgroundRefreshing(false);
                }
            }, 100);
        } catch (error) {
            logger.error('❌ Background refresh setup failed', { error: error.message });
            if (mountedRef.current) setIsBackgroundRefreshing(false);
        }
    };

    /**
     * Fresh API load
     */
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
                    logger.warn('⚠️ Fresh profile cache failed', { error: cacheError.message });
                }
            } else if (mountedRef.current) {
                setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
            }
        } catch (err) {
            logger.error('❌ Fresh profile loading failed', { error: err.message });
            if (mountedRef.current) setError(handleError(err, 'useProfileData/loadFreshProfile'));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    /**
     * Pull-to-refresh
     */
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

    /**
     * Format instruments for display
     */
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

    /**
     * Component lifecycle
     */
    useEffect(() => {
        mountedRef.current = true;
        loadProfileInstantly();

        return () => {
            mountedRef.current = false;

            if (backgroundRefreshTimeout.current) {
                clearTimeout(backgroundRefreshTimeout.current);
                backgroundRefreshTimeout.current = null;
            }
        };
    }, []);

    /**
     * Auto-sync with AuthContext user data changes
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
                logger.info('🔹 Syncing profile.videos with context user.videos', {
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
    }, [user?.videos, user?.username]);

    /**
     * Force server refresh after video upload
     */
    const refreshFromServer = async () => {
        const userEmail = user?.email || await getCurrentUserEmail();
        if (!userEmail) return;
        await loadFreshProfile(userEmail);
    };

    return {
        // Data
        profile,
        loading,
        error,
        refreshing,
        loggingOut,
        loadSource,
        isBackgroundRefreshing,

        // Actions
        handleLogout,
        onRefresh,
        loadProfileInstantly,
        refreshFromServer,

        // Utils
        formatInstruments,
    };
};