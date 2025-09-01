/**
 * @module BackgroundDataService
 * Enterprise-grade background data service with memory leak prevention
 * Handles parallel loading and video decoder cleanup for optimal performance
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

    logger.info('🚀 BackgroundDataService initialized', {
      maxConcurrentRequests: this.maxConcurrentRequests,
      stages: Object.keys(this.stages)
    });
  }

  /**
   * Register video decoder for cleanup tracking
   * @param {string} decoderId - Unique decoder identifier
   * @param {Function} cleanupCallback - Cleanup function to execute
   */
  registerVideoDecoder(decoderId, cleanupCallback) {
    this.activeVideoDecoders.add(decoderId);
    if (cleanupCallback) {
      this.videoDecoderCleanupCallbacks.add(cleanupCallback);
    }
    logger.debug(`📹 Registered video decoder: ${decoderId}`, {
      total: this.activeVideoDecoders.size,
      hasCleanupCallback: !!cleanupCallback
    });
  }

  /**
   * Unregister video decoder
   * @param {string} decoderId - Decoder identifier to remove
   */
  unregisterVideoDecoder(decoderId) {
    this.activeVideoDecoders.delete(decoderId);
    logger.debug(`📹 Unregistered video decoder: ${decoderId}`, {
      remaining: this.activeVideoDecoders.size
    });
  }

  /**
   * Emergency video decoder cleanup - prevents memory leaks
   * @param {string} reason - Reason for cleanup trigger
   */
  async emergencyVideoCleanup(reason = 'unknown') {
    logger.warn(`🚨 Emergency video cleanup: ${reason}`, {
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

      // Force memory cleanup in cache manager
      forceMemoryCleanup(reason);

      // Cancel all requests that might be loading videos
      this.cancelAllRequests();

      // Force garbage collection
      if (global.gc) {
        global.gc();
        logger.debug('♻️ Forced GC after video cleanup');
      }

      logger.info('✅ Emergency video cleanup completed', {
        reason,
        callbacksProcessed: cleanupPromises.length
      });

    } catch (error) {
      logger.error('❌ Emergency video cleanup failed', {
        reason,
        error: error.message
      });
    }
  }

  /**
   * Cancel all active requests with video cleanup
   */
  cancelAllRequests() {
    logger.info('🛑 Cancelling all active requests for safe navigation', {
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
      logger.info('🎬 Triggering video cleanup due to request cancellation', {
        activeDecoders: this.activeVideoDecoders.size
      });
      setTimeout(() => this.emergencyVideoCleanup('request_cancellation'), 100);
    }

    logger.info('✅ Request cancellation completed', {
      cancelledCount,
      failedCount
    });
  }

  /**
   * Make safe API request with timeout and cancellation
   * @param {Function} requestFunction - Request function to execute
   * @param {string} requestId - Optional request identifier
   * @returns {Promise} Request result or null
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
   * @param {Object} userData - User data for profile loading
   */
  async startParallelLoading(userData) {
    if (this.isLoading) {
      logger.info('⏳ Loading already in progress, skipping duplicate request');
      return;
    }

    logger.info('🚀 Starting enhanced parallel loading (Discover + Profile)', {
      userEmail: userData?.email,
      systemsToLoad: ['feed', 'profile']
    });

    this.isLoading = true;
    this.userData = userData;
    this.loadingStage = this.stages.PARALLEL_LOADING;

    try {
      // Check memory before starting
      const memoryBefore = global.performance?.memory?.usedJSHeapSize;
      if (memoryBefore) {
        const memoryBeforeMB = Math.round(memoryBefore / 1024 / 1024);
        logger.debug(`📊 Memory before loading: ${memoryBeforeMB}MB`);
      }

      // Load both systems in parallel for instant app experience
      const [feedResult, profileResult] = await Promise.allSettled([
        this.loadFeedSystemSafe(),
        this.loadProfileSystemSafe()
      ]);

      // Enhanced result logging
      const results = {
        feed: {
          status: feedResult.status,
          success: feedResult.status === 'fulfilled',
          error: feedResult.status === 'rejected' ? feedResult.reason?.message : null
        },
        profile: {
          status: profileResult.status,
          success: profileResult.status === 'fulfilled',
          error: profileResult.status === 'rejected' ? profileResult.reason?.message : null
        }
      };

      if (results.feed.success) {
        logger.info('✅ Discover loading completed successfully');
      } else {
        logger.error('❌ Discover loading failed', {
          error: results.feed.error,
          status: results.feed.status
        });
      }

      if (results.profile.success) {
        logger.info('✅ Profile loading completed successfully');
      } else {
        logger.error('❌ Profile loading failed', {
          error: results.profile.error,
          status: results.profile.status
        });
      }

      // Enhanced memory monitoring
      const memoryAfter = global.performance?.memory?.usedJSHeapSize;
      if (memoryBefore && memoryAfter) {
        const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024;
        const memoryAfterMB = Math.round(memoryAfter / 1024 / 1024);

        logger.info(`📊 Memory impact analysis`, {
          before: `${Math.round(memoryBefore / 1024 / 1024)}MB`,
          after: `${memoryAfterMB}MB`,
          increase: `${memoryIncrease.toFixed(1)}MB`,
          percentage: `${((memoryIncrease / (memoryBefore / 1024 / 1024)) * 100).toFixed(1)}%`
        });

        // Trigger cleanup if memory increase is too high
        if (memoryIncrease > 100) {
          logger.warn('🚨 High memory increase detected, scheduling cleanup', {
            memoryIncrease: `${memoryIncrease.toFixed(1)}MB`,
            threshold: '100MB'
          });
          setTimeout(() => this.emergencyVideoCleanup('high_memory_increase'), 1000);
        }
      }

      // Background optimization stage
      this.loadingStage = this.stages.BACKGROUND_OPTIMIZATION;
      
    } catch (error) {
      logger.error('❌ Parallel loading encountered critical error', {
        error: error.message,
        userData: userData ? { email: userData.email } : null
      });
    } finally {
      this.isLoading = false;
      logger.info('🎯 Parallel loading session completed', {
        finalStage: this.loadingStage
      });
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
      // Check cache first (no network required)
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
        logger.info('📭 No discover videos received from API');
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
    
    logger.info('👤 Loading profile with videos using enhanced safety measures');

    try {
      if (!this.userData?.email) {
        logger.info('📧 No user email available for profile loading', {
          userData: !!this.userData,
          reason: 'missing_email'
        });
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
          source: 'cache'
        });
        return cachedProfile;
      }

      // Load from API with safe request
      logger.info('📡 Loading profile from API', { email: this.userData.email });
      const profileData = await this.makeSafeRequest(async (signal) => {
        return await fetchUserProfile('email', this.userData.email);
      }, 'profile_load');
      
      if (profileData) {
        await cacheUserProfile(profileData, this.userData.email);
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        this.separatedSystems.profile.error = null;
        
        logger.info(`✅ Profile loaded from API`, {
          email: this.userData.email,
          videoCount: this.separatedSystems.profile.videoCount,
          source: 'api'
        });
        return profileData;
      } else {
        logger.info('📭 No profile data received from API');
        return null;
      }
    } catch (error) {
      logger.error('❌ Profile loading failed with error', {
        email: this.userData?.email,
        error: error.message,
        errorType: error.name
      });
      this.separatedSystems.profile.error = error.message;
      return null;
    }
  }

  /**
   * Legacy backwards compatibility with old single-stage loading
   */
  async startStagedLoading(userData) {
    logger.debug('Legacy loading detected, upgrading to parallel loading');
    return this.startParallelLoading(userData);
  }

  // Keep existing methods for backwards compatibility
  async stage1_LoadFeedOnly() {
    return this.loadFeedSystemSafe();
  }

  async stage2_LoadProfileOnly() {
    return this.loadProfileSystemSafe();
  }

  /**
   * SAFE LOAD MORE VIDEOS
   */
  async loadMoreFeedVideos(currentVideoCount) {
    logger.info('📥 Loading more feed videos', {
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
        logger.info('📭 No additional feed videos available');
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
   * FORCE REFRESH with video cleanup
   */
  async forceRefreshFeedOnly() {
    logger.info('🔄 Safe feed refresh initiated with cleanup');

    try {
      // Cleanup videos before refresh
      await this.emergencyVideoCleanup('feed_refresh');
      
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
    logger.info('🔄 Safe profile refresh initiated with cleanup');

    try {
      // Cleanup videos before refresh
      await this.emergencyVideoCleanup('profile_refresh');
      
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
    logger.info('🔄 Complete system refresh initiated with emergency cleanup');

    try {
      // Emergency cleanup before refresh
      await this.emergencyVideoCleanup('force_refresh_all');
      
      // Cancel any ongoing requests first
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
   * PUBLIC: Get video decoder stats for debugging
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
   * PUBLIC: Manual video cleanup trigger
   */
  async cleanupVideos(reason = 'manual') {
    logger.info(`🧹 Manual video cleanup triggered: ${reason}`);
    await this.emergencyVideoCleanup(reason);
  }

  /**
   * GET SYSTEM STATUS - Enhanced with video info
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
