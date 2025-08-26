/**
 * @module useProfileData
 * Custom hook for profile data loading with instant cache and background refresh
 * Handles all profile loading logic, caching, and state management
 *  Consistent instruments formatting to prevent object rendering errors
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
    createNetworkError,
    createAuthError,
    ERROR_MESSAGES
} from '../utils/errors';

/**
 *  Safe field formatter to prevent object rendering errors
 */
const formatFieldSafely = (value, defaultValue = 'Not specified') => {
    if (!value || value === null || value === undefined) return defaultValue;

    // Handle objects like {Trumpet: true, "Lead Vocals": true}
    if (typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        return keys.length > 0 ? keys.join(', ') : defaultValue;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        const filtered = value.filter(item => item && item !== null && item !== undefined);
        return filtered.length > 0 ? filtered.join(', ') : defaultValue;
    }

    // Handle strings and other types
    const stringValue = String(value).trim();
    return stringValue || defaultValue;
};

/**
 *  Normalize profile data to prevent rendering errors
 */
const normalizeProfileData = (profileData) => {
    if (!profileData) return null;

    return {
        ...profileData,
        //  Ensure these fields are always safe for rendering
        username: formatFieldSafely(profileData.username, 'Unknown'),
        bio: formatFieldSafely(profileData.bio, 'Music enthusiast looking to connect!'),
        location: formatFieldSafely(profileData.location, 'Unknown'),
        age: profileData.age && typeof profileData.age === 'number' ? profileData.age : null,
        rating: profileData.rating && typeof profileData.rating === 'number' ? profileData.rating : null,

        //  Normalize instruments - always safe string format
        instruments: (() => {
            const instruments = profileData.instruments;
            if (!instruments) return 'Guitar, Acoustic Guitar';

            if (typeof instruments === 'object' && !Array.isArray(instruments)) {
                const keys = Object.keys(instruments);
                return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
            }

            if (Array.isArray(instruments)) {
                const filtered = instruments.filter(i => i && i !== null && i !== undefined);
                return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
            }

            return String(instruments) || 'Guitar, Acoustic Guitar';
        })(),

        //  Normalize genres
        genres: (() => {
            const genres = profileData.genres;
            if (!genres) return [];

            if (typeof genres === 'object' && !Array.isArray(genres)) {
                return Object.keys(genres);
            }

            if (Array.isArray(genres)) {
                return genres.filter(g => g && g !== null && g !== undefined);
            }

            return [String(genres)];
        })(),

        //  Ensure videos is always an array
        videos: Array.isArray(profileData.videos) ? profileData.videos : [],

        //  Ensure numeric fields are safe
        followers: typeof profileData.followers === 'number' ? profileData.followers : 0,
        following: typeof profileData.following === 'number' ? profileData.following : 0,
        likes: typeof profileData.likes === 'number' ? profileData.likes : 0,
    };
};

/**
 * Custom hook for profile data management
 * @returns {Object} Profile data, loading states, and handler functions
 */
export const useProfileData = () => {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [loadSource, setLoadSource] = useState('');
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

    // Track if we've loaded from cache to avoid duplicate loads
    const hasLoadedFromCache = useRef(false);
    const backgroundRefreshTimeout = useRef(null);
    const mountedRef = useRef(true);

    /**
     * Handle logout with complete data cleanup
     */
    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out? This will clear all cached data from your device.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: performLogout,
                },
            ]
        );
    };

    /**
     * Perform the actual logout with data cleanup
     */
    const performLogout = async () => {
        setLoggingOut(true);

        try {
            //  Enhanced error handling for cache clearing
            try {
                await clearAllCaches();
            } catch (cacheError) {
                console.warn('⚠️ Cache clear failed during logout:', cacheError);
                // Continue with logout even if cache clear fails
            }

            const result = await signOut();

            if (result.success) {
                if (mountedRef.current) {
                    setProfile(null);
                    setLoading(false);
                    setError(null);
                }
            } else {
                console.error('❌ useProfileData: Logout failed:', result.error);

                if (mountedRef.current) {
                    Alert.alert(
                        'Logout Failed',
                        handleError(result.error, 'useProfileData/performLogout') || ERROR_MESSAGES.AUTH.SIGNIN_FAILED,
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (error) {
            console.error('❌ useProfileData: Error during logout:', error);

            if (mountedRef.current) {
                Alert.alert(
                    'Logout Error',
                    handleError(error, 'useProfileData/performLogout') || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR,
                    [{ text: 'OK' }]
                );
            }
        } finally {
            if (mountedRef.current) {
                setLoggingOut(false);
            }
        }
    };

    /**
     * INSTANT cache loading - shows profile immediately, refreshes in background
     *  Normalize cached data before setting state and enhanced error handling
     */
    const loadProfileInstantly = async () => {
        try {
            const userEmail = user?.email || await getCurrentUserEmail();
            if (!userEmail) {
                if (mountedRef.current) {
                    setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
                }
                return;
            }

            // STEP 1: INSTANT CACHE DISPLAY (NO LOADING SCREEN!)
            try {
                const cachedProfile = await getProfileCache(userEmail);

                if (cachedProfile && mountedRef.current) {
                    //  Normalize cached data to prevent object rendering errors
                    const normalizedProfile = normalizeProfileData(cachedProfile);
                    setProfile(normalizedProfile);
                    setLoadSource('permanent_cache');
                    setError(null);
                    hasLoadedFromCache.current = true;

                    console.log('✅ Loaded normalized cached profile:', {
                        username: normalizedProfile.username,
                        instruments: normalizedProfile.instruments,
                        instrumentsType: typeof normalizedProfile.instruments
                    });

                    // STEP 2: SILENT BACKGROUND REFRESH (user doesn't see this)
                    silentBackgroundRefresh(userEmail);

                    return normalizedProfile;
                }
            } catch (cacheError) {
                console.warn('⚠️ Cache loading failed:', cacheError);
                // Continue with fresh load
            }

            // STEP 3: NO CACHE - LOAD FRESH (first time only)
            if (mountedRef.current) {
                setLoading(true);
            }
            await loadFreshProfile(userEmail);

        } catch (err) {
            console.error('❌ useProfileData: Error in instant loading:', err);
            if (mountedRef.current) {
                setError(handleError(err, 'useProfileData/loadProfileInstantly'));
                setLoading(false);
            }
        }
    };

    /**
     * SILENT background refresh - updates data without user knowing
     *  Normalize fresh data before comparison and caching
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
                    const freshProfile = await fetchUserProfile('email', userEmail);

                    if (freshProfile && mountedRef.current) {
                        //  Normalize both profiles before comparison
                        const normalizedFresh = normalizeProfileData(freshProfile);
                        const normalizedCurrent = normalizeProfileData(profile);

                        const currentProfileString = JSON.stringify(normalizedCurrent);
                        const freshProfileString = JSON.stringify(normalizedFresh);

                        if (currentProfileString !== freshProfileString) {
                            setProfile(normalizedFresh);
                            setLoadSource('background_refresh');

                            console.log('🔄 Profile updated via background refresh');
                        }

                        //  Cache the normalized data with error handling
                        try {
                            await cacheUserProfile(normalizedFresh, userEmail);
                        } catch (cacheError) {
                            console.warn('⚠️ Background cache failed:', cacheError);
                        }
                    }
                } catch (refreshError) {
                    console.warn('⚠️ Background refresh failed:', refreshError);
                    // Silent fail for background refresh
                } finally {
                    if (mountedRef.current) {
                        setIsBackgroundRefreshing(false);
                    }
                }
            }, 100);

        } catch (error) {
            console.error('❌ Background refresh setup failed:', error);
            if (mountedRef.current) {
                setIsBackgroundRefreshing(false);
            }
        }
    };

    /**
     * Load fresh profile (only when no cache exists)
     *  Normalize fresh data before setting state and enhanced error handling
     */
    const loadFreshProfile = async (userEmail) => {
        try {
            setLoadSource('fresh_api');

            const profileData = await fetchUserProfile('email', userEmail);

            if (profileData && mountedRef.current) {
                //  Normalize fresh data to prevent object rendering errors
                const normalizedProfile = normalizeProfileData(profileData);
                setProfile(normalizedProfile);

                console.log('✅ Loaded normalized fresh profile:', {
                    username: normalizedProfile.username,
                    instruments: normalizedProfile.instruments,
                    instrumentsType: typeof normalizedProfile.instruments
                });

                //  Cache the normalized data with error handling
                try {
                    await cacheUserProfile(normalizedProfile, userEmail);
                } catch (cacheError) {
                    console.warn('⚠️ Fresh profile cache failed:', cacheError);
                }
            } else {
                if (mountedRef.current) {
                    setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
                }
            }
        } catch (err) {
            console.error('❌ useProfileData: Fresh profile loading failed:', err);
            if (mountedRef.current) {
                setError(handleError(err, 'useProfileData/loadFreshProfile'));
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

    /**
     * Handle pull-to-refresh (user-initiated refresh)
     *  Normalize refreshed data and enhanced error handling
     */
    const onRefresh = async () => {
        if (!mountedRef.current) return;

        setRefreshing(true);

        try {
            const userEmail = user?.email || await getCurrentUserEmail();
            if (userEmail) {
                await loadFreshProfile(userEmail);
            } else {
                if (mountedRef.current) {
                    setError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
                }
            }
        } catch (error) {
            console.error('❌ useProfileData: Pull-to-refresh failed:', error);
            if (mountedRef.current) {
                setError(handleError(error, 'useProfileData/onRefresh'));
            }
        } finally {
            if (mountedRef.current) {
                setRefreshing(false);
            }
        }
    };

    /**
     *  Format instruments for display - safe for all formats
     */
    const formatInstruments = () => {
        if (!profile?.instruments) return 'Guitar, Acoustic Guitar';

        // Since we normalize data, instruments should always be a string now
        // But keep safety checks for compatibility
        const instruments = profile.instruments;

        if (typeof instruments === 'object' && !Array.isArray(instruments)) {
            //  Use Object.keys() instead of Object.values()
            const keys = Object.keys(instruments);
            return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
        }

        if (Array.isArray(instruments)) {
            const filtered = instruments.filter(i => i && i !== null && i !== undefined);
            return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
        }

        return String(instruments) || 'Guitar, Acoustic Guitar';
    };

    /**
     * Initialize profile data on mount
     *  Enhanced cleanup and mount checking
     */
    useEffect(() => {
        mountedRef.current = true;

        loadProfileInstantly();

        return () => {
            mountedRef.current = false;

            // CRITICAL: Clear all timers
            if (backgroundRefreshTimeout.current) {
                clearTimeout(backgroundRefreshTimeout.current);
                backgroundRefreshTimeout.current = null;
            }

            // CRITICAL: Reset states to free memory
            setProfile(null);
            setLoading(false);
            setError(null);
            setRefreshing(false);
            setIsBackgroundRefreshing(false);
            hasLoadedFromCache.current = false;

            console.log('✅ useProfileData cleanup complete');
        };
    }, []);

    return {
        // Profile data
        profile,
        loading,
        error,
        refreshing,
        loggingOut,
        loadSource,
        isBackgroundRefreshing,

        // Handler functions
        handleLogout,
        onRefresh,
        loadProfileInstantly,

        // Utility functions
        formatInstruments,
    };
};