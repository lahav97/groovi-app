/**
 * @module BackgroundDataService
 * ENHANCED VERSION - Memory leak prevention with video decoder cleanup
 * Fixed function references and added parallel loading capability + memory management
 */

import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';

// FIXED: Import functions directly with explicit names
import { 
  getFeedCache,
  cacheFeedVideos,
  getProfileCache,
  cacheUserProfile,
  forceMemoryCleanup
} from '../utils/cacheManager';

class BackgroundDataService {
  constructor() {
    this.isLoading = false;
    this.loadingStage = 0;
    this.userData = null;
    
    // SAFE REQUEST MANAGEMENT
    this.activeRequests = new Set();
    this.abortControllers = new Map();
    this.maxConcurrentRequests = 2; // INCREASED for parallel loading
    this.requestDelay = 500; // Reduced delay for faster loading
    
    // VIDEO DECODER TRACKING - Critical for memory leak prevention
    this.activeVideoDecoders = new Set();
    this.videoDecoderCleanupCallbacks = new Set();
    
    this.stages = {
      PARALLEL_LOADING: 1, // NEW: Load both simultaneously
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
  }

  /**
   * CRITICAL: Register video decoder for cleanup tracking
   */
  registerVideoDecoder(decoderId, cleanupCallback) {
    this.activeVideoDecoders.add(decoderId);
    if (cleanupCallback) {
      this.videoDecoderCleanupCallbacks.add(cleanupCallback);
    }
    console.log(`📹 Registered video decoder: ${decoderId} (total: ${this.activeVideoDecoders.size})`);
  }

  /**
   * CRITICAL: Unregister video decoder
   */
  unregisterVideoDecoder(decoderId) {
    this.activeVideoDecoders.delete(decoderId);
    console.log(`📹 Unregistered video decoder: ${decoderId} (total: ${this.activeVideoDecoders.size})`);
  }

  /**
   * CRITICAL: Emergency video decoder cleanup - prevents 2GB memory leaks
   */
  async emergencyVideoCleanup(reason = 'unknown') {
    console.log(`🚨 EMERGENCY VIDEO CLEANUP - ${reason} (${this.activeVideoDecoders.size} decoders)`);

    try {
      // 1. Execute all cleanup callbacks
      const cleanupPromises = Array.from(this.videoDecoderCleanupCallbacks).map(callback => {
        try {
          return Promise.resolve(callback());
        } catch (error) {
          console.warn('Video cleanup callback error:', error);
          return Promise.resolve();
        }
      });

      await Promise.allSettled(cleanupPromises);

      // 2. Clear all tracking
      this.activeVideoDecoders.clear();
      this.videoDecoderCleanupCallbacks.clear();

      // 3. Force memory cleanup in cache manager
      forceMemoryCleanup(reason);

      // 4. Cancel all requests that might be loading videos
      this.cancelAllRequests();

      // 5. Force garbage collection
      if (global.gc) {
        global.gc();
        console.log('♻️ Forced GC after video cleanup');
      }

      console.log('✅ Emergency video cleanup completed');

    } catch (error) {
      console.error('❌ Emergency video cleanup failed:', error);
    }
  }

  /**
   * CANCEL ALL REQUESTS - Enhanced with video cleanup
   */
  cancelAllRequests() {
    console.log('🛑 BackgroundDataService: Cancelling all requests for safe navigation');
    
    this.abortControllers.forEach((controller, id) => {
      try {
        controller.abort();
      } catch (err) {
        console.warn('Failed to abort request:', id);
      }
    });
    
    this.abortControllers.clear();
    this.activeRequests.clear();

    // Also trigger video cleanup
    if (this.activeVideoDecoders.size > 0) {
      console.log('🎬 Triggering video cleanup due to request cancellation');
      setTimeout(() => this.emergencyVideoCleanup('request_cancellation'), 100);
    }
  }

  /**
   * SAFE API REQUEST with timeout and cancellation
   */
  async makeSafeRequest(requestFunction, requestId = null) {
    const id = requestId || `req_${Date.now()}`;
    
    // Check if too many concurrent requests
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      console.log('⚠️ Too many concurrent requests, skipping:', id);
      return null;
    }

    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);
    this.activeRequests.add(id);

    try {
      // 15 second timeout for parallel loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000);
      });

      const requestPromise = requestFunction(abortController.signal);
      const result = await Promise.race([requestPromise, timeoutPromise]);
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🛑 Request cancelled:', id);
        return null;
      }
      
      console.warn('⚠️ Request failed safely:', error.message);
      return null; // Return null instead of throwing
    } finally {
      this.activeRequests.delete(id);
      this.abortControllers.delete(id);
    }
  }

  /**
   * ENHANCED: PARALLEL LOADING with memory monitoring
   */
  async startParallelLoading(userData) {
    if (this.isLoading) {
      console.log('⚠️ Already loading, skipping duplicate request');
      return;
    }

    console.log('🚀 BackgroundDataService: Starting PARALLEL loading (Discover + Profile)');
    this.isLoading = true;
    this.userData = userData;
    this.loadingStage = this.stages.PARALLEL_LOADING;

    try {
      // Check memory before starting
      const memoryBefore = global.performance?.memory?.usedJSHeapSize;
      if (memoryBefore) {
        console.log(`📊 Memory before loading: ${Math.round(memoryBefore / 1024 / 1024)}MB`);
      }

      // ✨ NEW: Load BOTH systems in parallel for instant app experience
      const [feedResult, profileResult] = await Promise.allSettled([
        this.loadFeedSystemSafe(),
        this.loadProfileSystemSafe()
      ]);

      // Log results
      if (feedResult.status === 'fulfilled') {
        console.log('✅ Discover loading completed successfully');
      } else {
        console.error('❌ Discover loading failed:', feedResult.reason);
      }

      if (profileResult.status === 'fulfilled') {
        console.log('✅ Profile loading completed successfully');
      } else {
        console.error('❌ Profile loading failed:', profileResult.reason);
      }

      // Check memory after loading
      const memoryAfter = global.performance?.memory?.usedJSHeapSize;
      if (memoryBefore && memoryAfter) {
        const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024;
        console.log(`📊 Memory after loading: ${Math.round(memoryAfter / 1024 / 1024)}MB (+${memoryIncrease.toFixed(1)}MB)`);
        
        // Trigger cleanup if memory increase is too high
        if (memoryIncrease > 100) {
          console.log('⚠️ High memory increase detected, triggering cleanup');
          setTimeout(() => this.emergencyVideoCleanup('high_memory_increase'), 1000);
        }
      }

      // Background optimization stage
      this.loadingStage = this.stages.BACKGROUND_OPTIMIZATION;
      
    } catch (error) {
      console.error('❌ BackgroundDataService: Parallel loading error:', error);
    } finally {
      this.isLoading = false;
      console.log('🎯 BackgroundDataService: Parallel loading complete');
    }
  }

  /**
   * SAFE FEED LOADING - Independent system
   */
  async loadFeedSystemSafe() {
    if (this.separatedSystems.feed.loaded) {
      console.log('✅ Feed already loaded, skipping');
      return;
    }
    
    console.log('🎯 Loading discover videos safely...');

    try {
      // Check cache first (no network required)
      let cachedFeed = null;
      try {
        cachedFeed = await getFeedCache();
      } catch (cacheError) {
        console.warn('⚠️ Cache read failed, will load from API:', cacheError.message);
      }
      
      if (cachedFeed && cachedFeed.length > 0) {
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = cachedFeed.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        this.separatedSystems.feed.error = null;
        console.log('✅ Discover videos loaded from cache');
        return cachedFeed;
      }

      // Load from API with safe request
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
        
        console.log('✅ Discover videos loaded from API');
        return feedVideos;
      } else {
        console.log('⚠️ No discover videos received');
        return [];
      }
    } catch (error) {
      console.error('❌ Discover loading failed:', error);
      this.separatedSystems.feed.error = error.message;
      return [];
    }
  }

  /**
   * SAFE PROFILE LOADING - Independent system with videos
   */
  async loadProfileSystemSafe() {
    if (this.separatedSystems.profile.loaded) {
      console.log('✅ Profile already loaded, skipping');
      return;
    }
    
    console.log('👤 Loading profile with videos safely...');

    try {
      if (!this.userData?.email) {
        console.log('⚠️ No user email for profile loading');
        return null;
      }

      // Check cache first
      const cachedProfile = await getProfileCache(this.userData.email);
      if (cachedProfile) {
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        this.separatedSystems.profile.error = null;
        console.log('✅ Profile loaded from cache with', this.separatedSystems.profile.videoCount, 'videos');
        return cachedProfile;
      }

      // Load from API with safe request
      const profileData = await this.makeSafeRequest(async (signal) => {
        return await fetchUserProfile('email', this.userData.email);
      }, 'profile_load');
      
      if (profileData) {
        await cacheUserProfile(profileData, this.userData.email);
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        this.separatedSystems.profile.error = null;
        
        console.log('✅ Profile loaded from API with', this.separatedSystems.profile.videoCount, 'videos');
        return profileData;
      } else {
        console.log('⚠️ No profile data received');
        return null;
      }
    } catch (error) {
      console.error('❌ Profile loading failed:', error);
      this.separatedSystems.profile.error = error.message;
      return null;
    }
  }

  /**
   * LEGACY: Backwards compatibility with old single-stage loading
   */
  async startStagedLoading(userData) {
    console.log('🔄 Legacy loading detected, upgrading to parallel loading...');
    return this.startParallelLoading(userData);
  }

  // Keep all existing methods for backwards compatibility
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
      console.error('❌ Load more videos failed:', error);
      return [];
    }
  }

  /**
   * FORCE REFRESH with video cleanup
   */
  async forceRefreshFeedOnly() {
    console.log('🔄 BackgroundDataService: Safe feed refresh...');
    
    try {
      // Cleanup videos before refresh
      await this.emergencyVideoCleanup('feed_refresh');
      
      this.separatedSystems.feed.loaded = false;
      this.separatedSystems.feed.error = null;
      resetVideoState();
      await this.loadFeedSystemSafe();
      console.log('✅ Feed refresh completed');
    } catch (error) {
      console.error('❌ Feed refresh failed:', error);
    }
  }

  async forceRefreshProfileOnly() {
    try {
      // Cleanup videos before refresh
      await this.emergencyVideoCleanup('profile_refresh');
      
      this.separatedSystems.profile.loaded = false;
      this.separatedSystems.profile.error = null;
      await this.loadProfileSystemSafe();
      console.log('✅ Profile refresh completed');
    } catch (error) {
      console.error('❌ Profile refresh failed:', error);
    }
  }

  async forceRefreshAll() {
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
      
      console.log('✅ All systems refresh completed');
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
    }
  }

  /**
   * PUBLIC: Get video decoder stats for debugging
   */
  getVideoDecoderStats() {
    return {
      activeDecoders: this.activeVideoDecoders.size,
      cleanupCallbacks: this.videoDecoderCleanupCallbacks.size,
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * PUBLIC: Manual video cleanup trigger
   */
  async cleanupVideos(reason = 'manual') {
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