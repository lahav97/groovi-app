import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';
import { createLogger } from '../utils/Logger';

// Import functions directly with explicit names
import {
    getFeedCache,
    cacheFeedVideos,
    getProfileCache,
    cacheUserProfile
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

        // Video decoder tracking for cleanup coordination
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

        logger.info('🚀 BackgroundDataService initialized', {
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
        logger.debug(`🔹 Registered video decoder: ${decoderId}`, {
            total: this.activeVideoDecoders.size,
            hasCleanupCallback: !!cleanupCallback
        });
    }

    /**
     * Unregister video decoder
     */
    unregisterVideoDecoder(decoderId) {
        this.activeVideoDecoders.delete(decoderId);
        logger.debug(`🔹 Unregistered video decoder: ${decoderId}`, {
            remaining: this.activeVideoDecoders.size
        });
    }

    /**
     * Execute video decoder cleanup callbacks only
     * Cache operations are handled by AppMemoryManager
     */
    async cleanupVideoDecoders(reason = 'unknown') {
        if (this.videoDecoderCleanupCallbacks.size === 0 && this.activeVideoDecoders.size === 0) {
            return;
        }

        logger.info(`🎬 Cleaning up video decoders: ${reason}`, {
            activeDecoders: this.activeVideoDecoders.size,
            cleanupCallbacks: this.videoDecoderCleanupCallbacks.size
        });

        try {
            // Execute video cleanup callbacks
            const cleanupPromises = Array.from(this.videoDecoderCleanupCallbacks).map((callback, index) => {
                try {
                    return Promise.resolve(callback());
                } catch (error) {
                    logger.warn(`⚠️ Video cleanup callback error at index ${index}`, {
                        error: error.message
                    });
                    return Promise.resolve();
                }
            });

            await Promise.allSettled(cleanupPromises);

            // Clear tracking
            this.activeVideoDecoders.clear();
            this.videoDecoderCleanupCallbacks.clear();

            logger.info('✅ Video decoder cleanup completed', {
                reason,
                callbacksProcessed: cleanupPromises.length
            });

        } catch (error) {
            logger.error('❌ Video decoder cleanup failed', {
                reason,
                error: error.message
            });
        }
    }

    /**
     * Cancel all active requests with clean state management
     * No longer triggers cache operations directly
     */
    cancelAllRequests() {
        if (this.activeRequests.size === 0 && this.abortControllers.size === 0) {
            return;
        }

        logger.info('🛑 Cancelling all active requests', {
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
                logger.warn(`⚠️ Failed to abort request: ${id}`, { error: err.message });
            }
        });

        this.abortControllers.clear();
        this.activeRequests.clear();

        logger.info('✅ Request cancellation completed', {
            cancelledCount,
            failedCount
        });

        // Schedule video decoder cleanup if needed
        if (this.activeVideoDecoders.size > 0) {
            logger.debug('🎬 Scheduling video decoder cleanup after request cancellation');
            setTimeout(() => this.cleanupVideoDecoders('request_cancellation'), 100);
        }
    }

    /**
     * Make safe API request with timeout and cancellation
     */
    async makeSafeRequest(requestFunction, requestId = null) {
        const id = requestId || `req_${Date.now()}`;

        // Check concurrent request limits
        if (this.activeRequests.size >= this.maxConcurrentRequests) {
            logger.info(`🚫 Request rejected due to concurrent limit: ${id}`, {
                activeRequests: this.activeRequests.size,
                maxConcurrent: this.maxConcurrentRequests
            });
            return null;
        }

        const abortController = new AbortController();
        this.abortControllers.set(id, abortController);
        this.activeRequests.add(id);

        logger.debug(`📤 Starting safe request: ${id}`, {
            activeRequests: this.activeRequests.size
        });

        try {
            // 15 second timeout for parallel loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 15000);
            });

            const requestPromise = requestFunction(abortController.signal);
            const result = await Promise.race([requestPromise, timeoutPromise]);

            logger.debug(`✅ Safe request completed: ${id}`, {
                hasResult: !!result
            });

            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.info(`🛑 Request cancelled: ${id}`);
                return null;
            }

            logger.warn(`⚠️ Safe request failed: ${id}`, {
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
            logger.info('⏳ Loading already in progress, skipping duplicate request');
            return;
        }

        logger.info('🚀 Starting discover-first loading strategy', {
            userEmail: userData?.email
        });

        this.isLoading = true;
        this.userData = userData;
        this.loadingStage = this.stages.PARALLEL_LOADING;

        try {
            const memoryBefore = global.performance?.memory?.usedJSHeapSize;
            if (memoryBefore) {
                const memoryBeforeMB = Math.round(memoryBefore / 1024 / 1024);
                logger.debug(`📊 Memory before loading: ${memoryBeforeMB}MB`);
            }

            // Priority 1: Load discover videos first
            logger.info('📱 Loading discover videos with priority');
            const feedVideos = await this.loadFeedSystemSafe();

            if (feedVideos && feedVideos.length > 0) {
                logger.info(`✅ Discover ready with ${feedVideos.length} videos`);
            }

            // Priority 2: Load profile in background
            setTimeout(() => {
                logger.info('👤 Starting profile loading in background');
                this.loadFullProfileInBackground(userData);
            }, 500);

            // Memory monitoring
            const memoryAfter = global.performance?.memory?.usedJSHeapSize;
            if (memoryBefore && memoryAfter) {
                const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024;
                const memoryAfterMB = Math.round(memoryAfter / 1024 / 1024);

                logger.info(`📊 Memory impact analysis`, {
                    before: `${Math.round(memoryBefore / 1024 / 1024)}MB`,
                    after: `${memoryAfterMB}MB`,
                    increase: `${memoryIncrease.toFixed(1)}MB`
                });

                // Only schedule video cleanup for very high memory increase
                if (memoryIncrease > 150) {
                    logger.warn('🚨 High memory increase detected, scheduling video cleanup', {
                        memoryIncrease: `${memoryIncrease.toFixed(1)}MB`
                    });
                    setTimeout(() => this.cleanupVideoDecoders('high_memory_increase'), 2000);
                }
            }

            this.loadingStage = this.stages.BACKGROUND_OPTIMIZATION;

        } catch (error) {
            logger.error('❌ Discover-first loading encountered error', {
                error: error.message
            });
        } finally {
            this.isLoading = false;
            logger.info('✅ Discover-first loading completed');
        }
    }

    /**
     * Load profile basics first, then videos in background
     */
    async loadFullProfileInBackground(userData) {
        try {
            if (!userData?.email) return;

            logger.info('👤 Loading full profile in background');

            // Check cache first
            const cachedProfile = await getProfileCache(userData.email);
            if (cachedProfile) {
                this.separatedSystems.profile.loaded = true;
                this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
                this.separatedSystems.profile.lastUpdate = Date.now();
                logger.info('💾 Profile already cached and ready');
                return cachedProfile;
            }

            // Load full profile from API
            const fullProfile = await this.makeSafeRequest(async () => {
                return await fetchUserProfile('email', userData.email);
            }, 'profile_full');

            if (fullProfile) {
                // Cache the full profile
                await cacheUserProfile(fullProfile, userData.email);

                this.separatedSystems.profile.loaded = true;
                this.separatedSystems.profile.videoCount = fullProfile.videos ? fullProfile.videos.length : 0;
                this.separatedSystems.profile.lastUpdate = Date.now();

                logger.info(`✅ Full profile cached: ${this.separatedSystems.profile.videoCount} videos`);
                return fullProfile;
            }

        } catch (error) {
            logger.error('❌ Profile loading failed', { error: error.message });
            this.separatedSystems.profile.error = error.message;
        }
    }

    /**
     * Safe feed system loading - Independent system
     */
    async loadFeedSystemSafe() {
        if (this.separatedSystems.feed.loaded) {
            logger.debug('📱 Feed system already loaded, skipping');
            return;
        }

        logger.info('🎯 Loading discover videos with enhanced safety measures');

        try {
            // Check cache first
            let cachedFeed = null;
            try {
                cachedFeed = await getFeedCache();
            } catch (cacheError) {
                logger.warn('⚠️ Cache read failed, will load from API', {
                    error: cacheError.message,
                    fallbackStrategy: 'api_load'
                });
            }

            if (cachedFeed && cachedFeed.length > 0) {
                this.separatedSystems.feed.loaded = true;
                this.separatedSystems.feed.videoCount = cachedFeed.length;
                this.separatedSystems.feed.lastUpdate = Date.now();
                this.separatedSystems.feed.error = null;

                logger.info('✅ Discover videos loaded from cache', {
                    videoCount: cachedFeed.length,
                    source: 'cache'
                });
                return cachedFeed;
            }

            // Load from API with safe request
            logger.info('📡 Loading discover videos from API');
            const feedVideos = await this.makeSafeRequest(async (signal) => {
                resetVideoState();
                return await fetchVideos(0, 5);
            }, 'feed_load');

            if (feedVideos && feedVideos.length > 0) {
                await cacheFeedVideos(feedVideos);

                this.separatedSystems.feed.loaded = true;
                this.separatedSystems.feed.videoCount = feedVideos.length;
                this.separatedSystems.feed.lastUpdate = Date.now();
                this.separatedSystems.feed.error = null;

                logger.info('✅ Discover videos loaded from API', {
                    videoCount: feedVideos.length,
                    source: 'api'
                });
                return feedVideos;
            } else {
                logger.info('🔭 No discover videos received from API');
                return [];
            }
        } catch (error) {
            logger.error('❌ Discover loading failed with error', {
                error: error.message,
                errorType: error.name
            });
            this.separatedSystems.feed.error = error.message;
            return [];
        }
    }

    /**
     * Safe profile system loading - Independent system with videos
     */
    async loadProfileSystemSafe() {
        if (this.separatedSystems.profile.loaded) {
            logger.debug('👤 Profile system already loaded, skipping');
            return;
        }

        logger.info('🔍 Checking for cached profile data');

        try {
            if (!this.userData?.email) {
                logger.info('📧 No user email available for profile loading');
                return null;
            }

            // Check cache first
            const cachedProfile = await getProfileCache(this.userData.email);

            if (cachedProfile) {
                this.separatedSystems.profile.loaded = true;
                this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
                this.separatedSystems.profile.lastUpdate = Date.now();
                this.separatedSystems.profile.error = null;

                logger.info(`✅ Profile loaded from cache`, {
                    email: this.userData.email,
                    videoCount: this.separatedSystems.profile.videoCount,
                    hasVideos: !!(cachedProfile.videos && cachedProfile.videos.length > 0)
                });
                return cachedProfile;
            }

            // If no cache, trigger background loading
            logger.info('⏳ No cached profile, triggering background load');
            this.loadFullProfileInBackground(this.userData);
            return null;

        } catch (error) {
            logger.error('❌ Profile loading failed', {
                email: this.userData?.email,
                error: error.message
            });
            this.separatedSystems.profile.error = error.message;
            return null;
        }
    }

    /**
     * Legacy backwards compatibility
     */
    async startStagedLoading(userData) {
        logger.debug('🔄 Legacy loading detected, upgrading to parallel loading');
        return this.startParallelLoading(userData);
    }

    async stage1_LoadFeedOnly() {
        return this.loadFeedSystemSafe();
    }

    async stage2_LoadProfileOnly() {
        return this.loadProfileSystemSafe();
    }

    /**
     * Safe load more videos
     */
    async loadMoreFeedVideos(currentVideoCount) {
        logger.info('🔥 Loading more feed videos', {
            currentVideoCount,
            requestedCount: 3
        });

        try {
            const moreFeedVideos = await this.makeSafeRequest(async (signal) => {
                return await fetchVideos(currentVideoCount, 3);
            }, 'load_more');

            if (moreFeedVideos && moreFeedVideos.length > 0) {
                const existingFeedCache = await getFeedCache() || [];
                const combinedFeedVideos = [...existingFeedCache, ...moreFeedVideos];
                await cacheFeedVideos(combinedFeedVideos);

                this.separatedSystems.feed.videoCount = combinedFeedVideos.length;

                logger.info('✅ More feed videos loaded successfully', {
                    newVideos: moreFeedVideos.length,
                    totalVideos: combinedFeedVideos.length
                });

                return moreFeedVideos;
            } else {
                logger.info('🔭 No additional feed videos available');
                return [];
            }
        } catch (error) {
            logger.error('❌ Load more videos failed', {
                currentVideoCount,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Force refresh with video cleanup (no direct cache operations)
     */
    async forceRefreshFeedOnly() {
        logger.info('🔄 Safe feed refresh initiated');

        try {
            // Clean up video decoders before refresh
            await this.cleanupVideoDecoders('feed_refresh');

            this.separatedSystems.feed.loaded = false;
            this.separatedSystems.feed.error = null;
            resetVideoState();
            await this.loadFeedSystemSafe();

            logger.info('✅ Feed refresh completed successfully');
        } catch (error) {
            logger.error('❌ Feed refresh failed', {
                error: error.message
            });
        }
    }

    async forceRefreshProfileOnly() {
        logger.info('🔄 Safe profile refresh initiated');

        try {
            // Clean up video decoders before refresh
            await this.cleanupVideoDecoders('profile_refresh');

            this.separatedSystems.profile.loaded = false;
            this.separatedSystems.profile.error = null;
            await this.loadProfileSystemSafe();

            logger.info('✅ Profile refresh completed successfully');
        } catch (error) {
            logger.error('❌ Profile refresh failed', {
                error: error.message
            });
        }
    }

    async forceRefreshAll() {
        logger.info('🔄 Complete system refresh initiated');

        try {
            // Clean up video decoders before refresh
            await this.cleanupVideoDecoders('force_refresh_all');

            // Cancel ongoing requests
            this.cancelAllRequests();

            // Reset both systems
            this.separatedSystems.feed.loaded = false;
            this.separatedSystems.profile.loaded = false;

            // Use parallel loading for refresh
            await this.startParallelLoading(this.userData);

            logger.info('✅ Complete system refresh completed successfully');
        } catch (error) {
            logger.error('❌ Complete refresh failed', {
                error: error.message
            });
        }
    }

    /**
     * Legacy emergency video cleanup method - now routes to video decoder cleanup only
     */
    async emergencyVideoCleanup(reason = 'legacy') {
        logger.info(`🎬 Legacy emergency video cleanup: ${reason}`);
        await this.cleanupVideoDecoders(reason);
    }

    /**
     * Get video decoder stats for debugging
     */
    getVideoDecoderStats() {
        const stats = {
            activeDecoders: this.activeVideoDecoders.size,
            cleanupCallbacks: this.videoDecoderCleanupCallbacks.size,
            activeRequests: this.activeRequests.size,
            isLoading: this.isLoading,
            currentStage: this.loadingStage
        };

        logger.debug('📊 Video decoder statistics requested', stats);
        return stats;
    }

    /**
     * Manual video cleanup trigger
     */
    async cleanupVideos(reason = 'manual') {
        logger.info(`🧹 Manual video cleanup triggered: ${reason}`);
        await this.cleanupVideoDecoders(reason);
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
                1: '🚀 Loading Discover + Profile',
                2: '⚡ Background Optimization'
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

export default new BackgroundDataService();