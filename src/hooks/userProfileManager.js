import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUserProfile } from '../services/profileService';
import { getCurrentUserEmail } from '../utils/userUtils';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError } from '../utils/errors';
import AppMemoryManager from '../utils/AppMemoryManager';
import { createLogger } from '../utils/Logger';

const logger = createLogger('userProfileManager');

const PROFILE_CACHE_KEY = 'profileCache';
const PROFILE_VIDEOS_KEY = 'profileVideos';

/**
 * Enhanced profile manager with cleanup coordination
 */
const userProfileManager = ({
                                email = null,
                                username = null,
                                loadOnFocus = true,
                                autoLoad = true
                            } = {}) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(autoLoad);
    const [error, setError] = useState(null);
    const isFocused = useIsFocused();
    const profileRef = useRef(null);
    const isLoadingRef = useRef(false);
    const lastFocusTimeRef = useRef(0);
    const cleanupListenerRef = useRef(null);

    // Keep a ref to the latest profile value
    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    // Register with cleanup gate for coordinated operations
    useEffect(() => {
        const cleanupListener = (cleanupType) => {
            if (cleanupType === 'emergency_cleanup') {
                logger.info('🚨 Emergency cleanup - clearing profile cache');
                handleEmergencyCleanup();
            } else if (cleanupType === 'routine_cleanup') {
                logger.debug('🧹 Routine cleanup - no action needed for profile manager');
                // Profile manager doesn't need routine cleanup actions
            }
        };

        AppMemoryManager.addNavigationListener(cleanupListener);
        cleanupListenerRef.current = cleanupListener;

        return () => {
            if (cleanupListenerRef.current) {
                AppMemoryManager.removeNavigationListener(cleanupListenerRef.current);
            }
        };
    }, []);

    /**
     * Emergency cleanup handler
     */
    const handleEmergencyCleanup = useCallback(async () => {
        logger.info('🚨 Emergency cleanup in userProfileManager');

        try {
            // Clear cached profile data
            await AsyncStorage.multiRemove([PROFILE_CACHE_KEY, PROFILE_VIDEOS_KEY]);

            // Reset component state
            if (profileRef.current) {
                setProfile(null);
                setError(null);
                setLoading(false);
            }

            // Reset refs
            profileRef.current = null;
            isLoadingRef.current = false;
            lastFocusTimeRef.current = 0;

            logger.info('✅ Emergency cleanup completed in userProfileManager');

        } catch (cleanupError) {
            logger.error('❌ Emergency cleanup failed', { error: cleanupError.message });
        }
    }, []);

    /**
     * Load user profile data with focus awareness
     */
    const loadProfile = useCallback(async (force = false) => {
        // Don't load if already loaded and not forced
        if (profileRef.current && !force) return profileRef.current;

        // Prevent multiple simultaneous loads
        if (isLoadingRef.current) {
            logger.debug('⏳ Load already in progress, skipping duplicate request');
            return null;
        }

        // Don't load if screen is not focused (unless forced)
        if (!force && loadOnFocus && !isFocused) {
            logger.debug('📱 Screen not focused, skipping profile load');
            return null;
        }

        isLoadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            // Try to load from cache first unless forced
            if (!force) {
                const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Restore videos from separate cache if needed
                    if (!parsed.videos || parsed.videos.length === 0) {
                        const cachedVideos = await AsyncStorage.getItem(PROFILE_VIDEOS_KEY);
                        if (cachedVideos) {
                            parsed.videos = JSON.parse(cachedVideos);
                            logger.info('📹 Restored videos into cached profile', {
                                videoCount: parsed.videos.length
                            });

                            // Update the cache with the restored videos
                            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(parsed));
                        }
                    }

                    setProfile(parsed);
                    setLoading(false);
                    isLoadingRef.current = false;

                    logger.info('💾 Profile loaded from cache', {
                        username: parsed.username,
                        videoCount: parsed.videos?.length || 0
                    });

                    return parsed;
                }
            }

            // If no cache or forced refresh, load from API
            let userEmail = email;
            let user = username;

            // If no email or username provided, get current user's email
            if (!userEmail && !user) {
                userEmail = await getCurrentUserEmail();

                if (!userEmail) {
                    throw new Error('User email not found');
                }
            }

            // Determine which field to use for fetching
            const field = userEmail ? 'email' : 'username';
            const value = userEmail || user;

            // Fetch profile data
            logger.info(`📡 Fetching profile for ${field}: ${value}`);
            const profileData = await fetchUserProfile(field, value);

            // Save videos separately for more reliable caching
            if (profileData.videos && profileData.videos.length > 0) {
                await AsyncStorage.setItem(PROFILE_VIDEOS_KEY, JSON.stringify(profileData.videos));
                logger.info('📹 Cached profile videos separately', {
                    videoCount: profileData.videos.length
                });
            }

            // Cache the full profile
            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));

            setProfile(profileData);

            logger.info('✅ Profile loaded successfully', {
                username: profileData.username,
                videoCount: profileData.videos?.length || 0,
                source: 'api'
            });

            return profileData;

        } catch (err) {
            logger.error('❌ Failed to load profile', { error: err.message });
            setError(handleError(err, 'userProfileManager/loadProfile') || err.message || 'Could not load profile data');

            // Try to use cached data as fallback if API fails
            try {
                const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    logger.info('💾 Using cached profile as fallback after API error');
                    setProfile(parsed);
                    return parsed;
                }
            } catch (cacheError) {
                logger.error('❌ Cache fallback also failed', { error: cacheError.message });
            }

            return null;
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
        }
    }, [email, username, loadOnFocus, isFocused]);

    /**
     * Force refresh the profile
     */
    const refreshProfile = useCallback(() => {
        logger.info('🔄 Force refreshing profile');
        return loadProfile(true);
    }, [loadProfile]);

    /**
     * Check if profile belongs to current user
     */
    const isCurrentUserProfile = useCallback(async () => {
        try {
            const currentEmail = await getCurrentUserEmail();
            return currentEmail === profileRef.current?.email || email === currentEmail;
        } catch (error) {
            logger.error('❌ Error checking if current user profile', { error: error.message });
            return false;
        }
    }, [email]);

    // Focus-aware loading
    useEffect(() => {
        if (loadOnFocus && isFocused) {
            const now = Date.now();

            // Throttle focus-based loading
            if (now - lastFocusTimeRef.current < 1000) {
                return;
            }

            lastFocusTimeRef.current = now;

            // Only load if we don't have a profile or it's been a while
            if (!profileRef.current) {
                logger.debug('📱 Screen focused - loading profile');
                loadProfile(false);
            }
        }
    }, [isFocused, loadOnFocus, loadProfile]);

    // Load profile on mount if autoLoad is true
    useEffect(() => {
        if (autoLoad) {
            logger.debug('🚀 Auto-loading profile on mount');
            loadProfile();
        }
    }, [autoLoad, loadProfile]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear refs and timers
            profileRef.current = null;
            isLoadingRef.current = false;
            lastFocusTimeRef.current = 0;

            logger.info('✅ userProfileManager cleanup completed');
        };
    }, []);

    return {
        profile,
        loading,
        error,
        loadProfile,
        refreshProfile,
        isCurrentUserProfile,

        // Additional utilities
        clearCache: handleEmergencyCleanup,
        isFocused
    };
};

export default userProfileManager;