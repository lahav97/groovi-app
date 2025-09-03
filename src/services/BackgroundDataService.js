/**
 * @module BackgroundDataService
 * Enterprise-grade background data service with memory leak prevention
 * FIXED: Restored proper error handling from original version
 */

import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';
import { createLogger } from '../utils/Logger';

// Import functions directly with explicit names
import {
    getFeedCache,
    cacheFeedVideos,
    getProfileCache,
    cacheUserProfile,
    forceMemoryCleanup
} from '../utils/cacheManager';

const logger = createLogger('BackgroundDataService');

class BackgroundDataService {
    constructor() {
        this.isLoading = false;
        this.loadingStage = 0;
        this.userData = null;

        // Safe request management
        this.activeRequests = new Set();
        this.abortControllers = new Map();
        this.maxConcurrentRequests = 2;
        this.requestDelay = 500;

        // Video decoder tracking - Critical for memory leak prevention
        this.activeVideoDecoders = new Set();
        this.videoDecoderCleanupCallbacks = new Set();

        this.stages = {
            PARALLEL_LOADING: 1,
            BACKGROUND_OPTIMIZATION: 2,
        };

        this.separatedSystems = {
            feed: {
                loaded: false,
                videoCount: 0,
                lastUpdate: null,
                error: null
            },
            profile: {
                loaded: false,
                videoCount: 0,
                lastUpdate: null,
                error: null
            }
        };

        logger.info('BackgroundDataService initialized', {
            maxConcurrentRequests: this.maxConcurrentRequests,
            stages: Object.keys(this.stages)
        });
    }

    /**
     * Register video decoder for cleanup tracking
     */
    registerVideoDecoder(decoderId, cleanupCallback) {
        this.activeVideoDecoders.add(decoderId);
        if (cleanupCallback) {
            this.videoDecoderCleanupCallbacks.add(cleanupCallback);
        }
        logger.debug(`Registered video decoder: ${decoderId}`, {
            total: this.activeVideoDecoders.size,
            hasCleanupCallback: !!cleanupCallback
        });
    }

    /**
     * Unregister video decoder
     */
    unregisterVideoDecoder(decoderId) {
        this.activeVideoDecoders.delete(decoderId);
        logger.debug(`Unregistered video decoder: ${decoderId}`, {
            remaining: this.activeVideoDecoders.size
        });
    }

    /**
     * Emergency video decoder cleanup - prevents memory leaks
     */
    async emergencyVideoCleanup(reason = 'unknown') {
        logger.warn(`Emergency video cleanup: ${reason}`, {
            activeDecoders: this.activeVideoDecoders.size,
            cleanupCallbacks: this.videoDecoderCleanupCallbacks.size
        });

        try {
            // Execute all cleanup callbacks
            const cleanupPromises = Array.from(this.videoDecoderCleanupCallbacks).map((callback, index) => {
                try {
                    return Promise.resolve(callback());
                } catch (error) {
                    logger.warn(`Video cleanup callback error at index ${index}`, {
                        error: error.message
                    });
                    return Promise.resolve();
                }
            });

            await Promise.allSettled(cleanupPromises);

            // Clear all tracking
            this.activeVideoDecoders.clear();
            this.videoDecoderCleanupCallbacks.clear();

            // FIXED: Safe force memory cleanup
            try {
                if (typeof forceMemoryCleanup === 'function') {
                    forceMemoryCleanup(reason);
                }
            } catch (cleanupError) {
                logger.warn('Memory cleanup failed', { error: cleanupError.message });
            }

            // Cancel all requests that might be loading videos
            this.cancelAllRequests();

            // Force garbage collection
            if (global.gc) {
                global.gc();
                logger.debug('Forced GC after video cleanup');
            }

            logger.info('Emergency video cleanup completed', {
                reason,
                callbacksProcessed: cleanupPromises.length
            });

        } catch (error) {
            logger.error('Emergency video cleanup failed', {
                reason,
                error: error.message
            });
        }
    }

    /**
     * Cancel all active requests with video cleanup
     */
    cancelAllRequests() {
        logger.info('Cancelling all active requests for safe navigation', {
            activeRequests: this.activeRequests.size,
            abortControllers: this.abortControllers.size
        });

        let cancelledCount = 0;
        let failedCount = 0;

        this.abortControllers.forEach((controller, id) => {
            try {
                controller.abort();
                cancelledCount++;
            } catch (err) {
                failedCount++;
                logger.warn(`Failed to abort request: ${id}`, { error: err.message });
            }
        });

        this.abortControllers.clear();
        this.activeRequests.clear();

        // Trigger video cleanup if needed
        if (this.activeVideoDecoders.size > 0) {
            logger.info('Triggering video cleanup due to request cancellation', {
                activeDecoders: this.activeVideoDecoders.size
            });
            setTimeout(() => this.emergencyVideoCleanup('request_cancellation'), 100);
        }

        logger.info('Request cancellation completed', {
            cancelledCount,
            failedCount
        });
    }

    /**
     * Make safe API request with timeout and cancellation
     */
    async makeSafeRequest(requestFunction, requestId = null) {
        const id = requestId || `req_${Date.now()}`;

        // Check concurrent request limits
        if (this.activeRequests.size >= this.maxConcurrentRequests) {
            logger.info(`Request rejected due to concurrent limit: ${id}`, {
                activeRequests: this.activeRequests.size,
                maxConcurrent: this.maxConcurrentRequests
            });
            return null;
        }

        const abortController = new AbortController();
        this.abortControllers.set(id, abortController);
        this.activeRequests.add(id);

        logger.debug(`Starting safe request: ${id}`, {
            activeRequests: this.activeRequests.size
        });

        try {
            // 15 second timeout for parallel loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 15000);
            });

            const requestPromise = requestFunction(abortController.signal);
            const result = await Promise.race([requestPromise, timeoutPromise]);

            logger.debug(`Safe request completed: ${id}`, {
                hasResult: !!result
            });

            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.info(`Request cancelled: ${id}`);
                return null;
            }

            logger.warn(`Safe request failed: ${id}`, {
                error: error.message,
                errorType: error.name
            });
            return null;
        } finally {
            this.activeRequests.delete(id);
            this.abortControllers.delete(id);
        }
    }

    /**
     * Start parallel loading of both feed and profile systems
     */
    async startParallelLoading(userData) {
        if (this.isLoading) {
            logger.info('Loading already in progress, skipping duplicate request');
            return;
        }

        logger.info('Starting enhanced parallel loading (Discover + Profile)', {
            userEmail: userData?.email,
            systemsToLoad: ['feed', 'profile']
        });

        this.isLoading = true;
        this.userData = userData;
        this.loadingStage = this.stages.PARALLEL_LOADING;

        try {
            const startTime = Date.now();

            // Load both systems simultaneously
            const [feedResult, profileResult] = await Promise.allSettled([
                this.loadFeedSystemSafe(),
                this.loadProfileSystemSafe()
            ]);

            const loadTime = Date.now() - startTime;
            logger.info('Parallel loading completed', {
                totalTimeMs: loadTime,
                feedSuccess: feedResult.status === 'fulfilled',
                profileSuccess: profileResult.status === 'fulfilled'
            });

            // Continue with background optimization
            setTimeout(() => {
                this.startBackgroundOptimization();
            }, 100);

            return {
                feed: feedResult.status === 'fulfilled',
                profile: profileResult.status === 'fulfilled',
                loadTime
            };

        } catch (error) {
            logger.error('Parallel loading failed', { error: error.message });
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * FIXED: Load feed system with proper error handling like original
     */
    async loadFeedSystemSafe() {
        if (this.separatedSystems.feed.loaded) {
            logger.info('Feed already loaded, skipping');
            return;
        }

        logger.info('Loading discover videos safely...');

        try {
            // FIXED: Safe cache access with try/catch like original
            let cachedFeed = null;
            try {
                cachedFeed = await getFeedCache();
            } catch (cacheError) {
                logger.warn('Cache read failed, will load from API:', cacheError.message);
            }

            if (cachedFeed && cachedFeed.length > 0) {
                this.separatedSystems.feed.loaded = true;
                this.separatedSystems.feed.videoCount = cachedFeed.length;
                this.separatedSystems.feed.lastUpdate = Date.now();
                this.separatedSystems.feed.error = null;
                logger.info('Discover videos loaded from cache');
                return cachedFeed;
            }

            // FIXED: Use original API signature
            const feedVideos = await this.makeSafeRequest(async (signal) => {
                // FIXED: Safe resetVideoState call
                if (typeof resetVideoState === 'function') {
                    resetVideoState();
                }
                // FIXED: Use original fetchVideos signature
                return await fetchVideos(0, 5);
            }, 'feed_load');

            if (feedVideos && feedVideos.length > 0) {
                await cacheFeedVideos(feedVideos);

                this.separatedSystems.feed.loaded = true;
                this.separatedSystems.feed.videoCount = feedVideos.length;
                this.separatedSystems.feed.lastUpdate = Date.now();
                this.separatedSystems.feed.error = null;

                logger.info('Discover videos loaded from API');
                return feedVideos;
            } else {
                logger.info('No discover videos received');
                return [];
            }
        } catch (error) {
            logger.error('Discover loading failed:', error);
            this.separatedSystems.feed.error = error.message;
            return [];
        }
    }

    /**
     * FIXED: Load profile system with proper error handling
     */
    async loadProfileSystemSafe() {
        if (this.separatedSystems.profile.loaded) {
            logger.info('Profile already loaded, skipping');
            return;
        }

        logger.info('Loading profile with videos safely...');

        try {
            if (!this.userData?.email) {
                logger.info('No user email for profile loading');
                return null;
            }

            // FIXED: Safe cache access like original
            let cachedProfile = null;
            try {
                cachedProfile = await getProfileCache(this.userData.email);
            } catch (cacheError) {
                logger.warn('Profile cache read failed:', cacheError.message);
            }

            if (cachedProfile) {
                this.separatedSystems.profile.loaded = true;
                this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
                this.separatedSystems.profile.lastUpdate = Date.now();
                this.separatedSystems.profile.error = null;
                logger.info('Profile loaded from cache with', this.separatedSystems.profile.videoCount, 'videos');
                return cachedProfile;
            }

            // FIXED: Use original API signature for fetchUserProfile
            const profileData = await this.makeSafeRequest(async (signal) => {
                return await fetchUserProfile('email', this.userData.email);
            }, 'profile_load');

            if (profileData) {
                await cacheUserProfile(profileData, this.userData.email);

                this.separatedSystems.profile.loaded = true;
                this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
                this.separatedSystems.profile.lastUpdate = Date.now();
                this.separatedSystems.profile.error = null;

                logger.info('Profile loaded from API with', this.separatedSystems.profile.videoCount, 'videos');
                return profileData;
            } else {
                logger.info('No profile data received');
                return null;
            }
        } catch (error) {
            logger.error('Profile loading failed:', error);
            this.separatedSystems.profile.error = error.message;
            return null;
        }
    }

    /**
     * FIXED: Safe load more videos
     */
    async loadMoreFeedVideos(currentVideoCount) {
        try {
            const moreFeedVideos = await this.makeSafeRequest(async (signal) => {
                return await fetchVideos(currentVideoCount, 3);
            }, 'load_more');

            if (moreFeedVideos && moreFeedVideos.length > 0) {
                const existingFeedCache = await getFeedCache() || [];
                const combinedFeedVideos = [...existingFeedCache, ...moreFeedVideos];
                await cacheFeedVideos(combinedFeedVideos);

                this.separatedSystems.feed.videoCount = combinedFeedVideos.length;
                return moreFeedVideos;
            } else {
                return [];
            }
        } catch (error) {
            logger.error('Load more videos failed:', error);
            return [];
        }
    }

    /**
     * FIXED: Safe force refresh with proper cleanup
     */
    async forceRefreshFeedOnly() {
        logger.info('BackgroundDataService: Safe feed refresh...');

        try {
            // Cleanup videos before refresh
            await this.emergencyVideoCleanup('feed_refresh');

            this.separatedSystems.feed.loaded = false;
            this.separatedSystems.feed.error = null;

            // FIXED: Safe resetVideoState call
            if (typeof resetVideoState === 'function') {
                resetVideoState();
            }

            await this.loadFeedSystemSafe();
            logger.info('Feed refresh completed');
        } catch (error) {
            logger.error('Feed refresh failed:', error);
        }
    }

    async forceRefreshProfileOnly() {
        try {
            await this.emergencyVideoCleanup('profile_refresh');

            this.separatedSystems.profile.loaded = false;
            this.separatedSystems.profile.error = null;
            await this.loadProfileSystemSafe();
            logger.info('Profile refresh completed');
        } catch (error) {
            logger.error('Profile refresh failed:', error);
        }
    }

    async forceRefreshAll() {
        try {
            await this.emergencyVideoCleanup('force_refresh_all');

            this.cancelAllRequests();

            this.separatedSystems.feed.loaded = false;
            this.separatedSystems.profile.loaded = false;

            await this.startParallelLoading(this.userData);

            logger.info('All systems refresh completed');
        } catch (error) {
            logger.error('Force refresh failed:', error);
        }
    }

    /**
     * Start background optimization tasks
     */
    async startBackgroundOptimization() {
        if (this.loadingStage !== this.stages.PARALLEL_LOADING) return;

        this.loadingStage = this.stages.BACKGROUND_OPTIMIZATION;
        logger.info('Starting background optimization...');

        try {
            await Promise.allSettled([
                this.optimizeVideoCache(),
                this.cleanupOldData()
            ]);

            logger.info('Background optimization completed');
        } catch (error) {
            logger.warn('Background optimization failed', { error: error.message });
        }
    }

    /**
     * FIXED: Safe optimize video cache
     */
    async optimizeVideoCache() {
        try {
            logger.info('Optimizing video cache for memory efficiency...');

            let cachedVideos = null;
            try {
                cachedVideos = await getFeedCache();
            } catch (cacheError) {
                logger.warn('Could not access cache for optimization:', cacheError.message);
                return;
            }

            if (cachedVideos && cachedVideos.length > 50) {
                const optimizedVideos = cachedVideos.slice(-30);
                await cacheFeedVideos(optimizedVideos);
                logger.info('Video cache optimized', {
                    before: cachedVideos.length,
                    after: optimizedVideos.length
                });
            }

            // FIXED: Safe force memory cleanup
            try {
                if (typeof forceMemoryCleanup === 'function') {
                    forceMemoryCleanup('video_cache_optimization');
                }
            } catch (cleanupError) {
                logger.warn('Memory cleanup failed:', cleanupError.message);
            }

        } catch (error) {
            logger.warn('Video cache optimization failed', { error: error.message });
        }
    }

    /**
     * FIXED: Safe cleanup old data
     */
    async cleanupOldData() {
        try {
            logger.info('Cleaning up old data...');

            // FIXED: Safe resetVideoState call
            if (typeof resetVideoState === 'function') {
                resetVideoState();
            }

            // FIXED: Safe force memory cleanup
            try {
                if (typeof forceMemoryCleanup === 'function') {
                    forceMemoryCleanup('old_data_cleanup');
                }
            } catch (cleanupError) {
                logger.warn('Memory cleanup failed:', cleanupError.message);
            }

            if (global.gc) {
                global.gc();
                logger.debug('Forced garbage collection');
            }

            logger.info('Old data cleanup completed');
        } catch (error) {
            logger.warn('Old data cleanup failed', { error: error.message });
        }
    }

    /**
     * Get video decoder stats for debugging
     */
    getVideoDecoderStats() {
        return {
            activeDecoders: this.activeVideoDecoders.size,
            cleanupCallbacks: this.videoDecoderCleanupCallbacks.size,
            activeRequests: this.activeRequests.size
        };
    }

    /**
     * Manual video cleanup trigger
     */
    async cleanupVideos(reason = 'manual') {
        await this.emergencyVideoCleanup(reason);
    }

    /**
     * Get system status
     */
    getSeparatedSystemStatus() {
        return {
            feed: {
                ...this.separatedSystems.feed,
                independent: true,
                systemType: 'discover_videos',
                hasError: !!this.separatedSystems.feed.error
            },
            profile: {
                ...this.separatedSystems.profile,
                independent: true,
                systemType: 'profile_with_videos',
                hasError: !!this.separatedSystems.profile.error
            },
            separation: {
                feedAffectsProfile: false,
                profileAffectsFeed: false,
                independentCaches: true,
                independentAPIs: true,
                parallelLoading: true
            },
            video: {
                activeDecoders: this.activeVideoDecoders.size,
                cleanupCallbacks: this.videoDecoderCleanupCallbacks.size
            }
        };
    }

    getCurrentStage() {
        return this.loadingStage;
    }

    isStageComplete(stage) {
        return this.loadingStage >= stage;
    }

    getLoadingStatus() {
        const separatedStatus = this.getSeparatedSystemStatus();

        return {
            isLoading: this.isLoading,
            currentStage: this.loadingStage,
            stageNames: {
                1: 'Loading Discover + Profile',
                2: 'Background Optimization'
            },
            systems: separatedStatus,
            totalFeedVideos: separatedStatus.feed.videoCount,
            totalProfileVideos: separatedStatus.profile.videoCount,
            systemsSeparated: true,
            parallelLoadingEnabled: true,
            videoDecoderStats: this.getVideoDecoderStats()
        };
    }
}

// Export singleton instance
export default new BackgroundDataService();