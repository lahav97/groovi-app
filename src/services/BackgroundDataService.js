import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';
import { 
  cacheFeedVideos, 
  cacheUserProfile, 
  getDiscoverCache, 
  getProfileCache,
} from '../utils/cacheManager';
import { handleError } from '../utils/errors';
import { InteractionManager } from 'react-native';

// FIX 4A: THREAD-SAFE BACKGROUND DATA SERVICE
class BackgroundDataService {
  constructor() {
    this.isLoading = false;
    this.loadingStage = 0;
    this.userData = null;
    this.stages = {
      FEED_PRIORITY: 1,
      PROFILE_BACKGROUND: 2,
    };
    this.separatedSystems = {
      feed: {
        loaded: false,
        videoCount: 0,
        lastUpdate: null,
        loading: false  // FIX 4A: Track loading state per system
      },
      profile: {
        loaded: false,
        videoCount: 0,
        lastUpdate: null,
        loading: false  // FIX 4A: Track loading state per system
      }
    };
    
    // FIX 4B: OPERATION TRACKING to prevent conflicts
    this.activeOperations = new Set();
    this.operationQueue = [];
    this.isProcessingQueue = false;
    
    // FIX 4C: STABILITY TIMERS
    this.stabilityTimers = new Map();
  }

  /**
   * FIX 4D: QUEUE-BASED OPERATION MANAGEMENT
   */
  queueOperation(operationId, operation, priority = 'normal') {
    if (this.activeOperations.has(operationId)) {
      console.log(`⚠️ Operation ${operationId} already active, skipping`);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        id: operationId,
        operation,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processOperationQueue();
    });
  }

  /**
   * FIX 4E: THREAD-SAFE OPERATION PROCESSING
   */
  async processOperationQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Sort by priority (high > normal > low)
      this.operationQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      while (this.operationQueue.length > 0) {
        const { id, operation, resolve, reject } = this.operationQueue.shift();
        
        if (this.activeOperations.has(id)) {
          resolve(); // Already processed
          continue;
        }
        
        this.activeOperations.add(id);
        
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          console.error(`❌ Operation ${id} failed:`, error);
          reject(error);
        } finally {
          this.activeOperations.delete(id);
        }
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * FIX 4F: ULTRA-STABLE STAGED LOADING with InteractionManager
   */
  async startStagedLoading(userData) {
    // Prevent duplicate loading attempts
    if (this.isLoading) {
      console.log('⚠️ Loading already in progress, skipping duplicate request');
      return;
    }

    console.log('🚀 BackgroundDataService: Starting thread-safe loading');
    this.isLoading = true;
    this.userData = userData;

    try {
      // FIX 4G: HIGH PRIORITY FEED LOADING (user needs this immediately)
      await this.queueOperation('feed-priority-load', async () => {
        return await this.stage1_LoadFeedOnly();
      }, 'high');
      
      // FIX 4H: LOW PRIORITY PROFILE LOADING (background, can wait)
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          this.queueOperation('profile-background-load', async () => {
            return await this.stage2_LoadProfileOnly();
          }, 'low');
        }, 2000); // Delayed for better user experience
      });
      
    } catch (error) {
      console.error('❌ BackgroundDataService: Loading error:', handleError(error, 'BackgroundDataService/startStagedLoading'));
    } finally {
      // Use InteractionManager to prevent blocking UI
      InteractionManager.runAfterInteractions(() => {
        this.isLoading = false;
      });
    }
  }

  /**
   * FIX 4I: THREAD-SAFE FEED LOADING with stability guards
   */
  async stage1_LoadFeedOnly() {
    // Prevent duplicate loading
    if (this.separatedSystems.feed.loaded || this.separatedSystems.feed.loading) {
      console.log('⚠️ Feed already loaded/loading, skipping');
      return [];
    }
    
    console.log('🎯 Loading feed videos with thread safety.');
    this.loadingStage = this.stages.FEED_PRIORITY;
    this.separatedSystems.feed.loading = true;

    try {
      // Fast cache check first (non-blocking)
      const cachedFeed = await getDiscoverCache();
      if (cachedFeed && cachedFeed.length > 0) {
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = cachedFeed.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        this.separatedSystems.feed.loading = false;
        
        console.log(`⚡ Feed loaded from cache: ${cachedFeed.length} videos`);
        return cachedFeed;
      }

      // Load from API if cache miss
      resetVideoState();
      const feedVideos = await fetchVideos(0, 5);

      if (feedVideos && feedVideos.length > 0) {
        // Cache in background (non-blocking)
        InteractionManager.runAfterInteractions(() => {
          cacheFeedVideos(feedVideos);
        });
        
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = feedVideos.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        
        console.log(`✅ Feed loaded from API: ${feedVideos.length} videos`);
        return feedVideos;
      } else {
        console.log('⚠️ No videos received from API');
        return [];
      }
    } catch (error) {
      console.error('❌ Feed loading failed:', handleError(error, 'BackgroundDataService/stage1_LoadFeedOnly'));
      return [];
    } finally {
      this.separatedSystems.feed.loading = false;
    }
  }

  /**
   * FIX 4J: BACKGROUND PROFILE LOADING (never blocks UI)
   */
  async stage2_LoadProfileOnly() {
    // Prevent duplicate loading
    if (this.separatedSystems.profile.loaded || this.separatedSystems.profile.loading) {
      console.log('⚠️ Profile already loaded/loading, skipping');
      return null;
    }

    console.log('👤 Loading profile in background.');
    this.loadingStage = this.stages.PROFILE_BACKGROUND;
    this.separatedSystems.profile.loading = true;

    try {
      if (!this.userData || !this.userData.email) {
        console.log('⚠️ No user email available for profile loading');
        return null;
      }

      // Check cached profile first (fast)
      const cachedProfile = await getProfileCache(this.userData.email);
      if (cachedProfile) {       
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        console.log(`⚡ Profile loaded from cache for: ${this.userData.email}`);
        return cachedProfile;
      }

      // Load from API in background
      const profileData = await fetchUserProfile('email', this.userData.email);
      
      if (profileData) {
        console.log('✅ Profile loaded from API successfully');
        
        // Cache in background (non-blocking)
        InteractionManager.runAfterInteractions(() => {
          cacheUserProfile(profileData, this.userData.email);
        });
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        return profileData;
      } else {
        console.log('⚠️ No profile data received from API');
        return null;
      }
    } catch (error) {
      console.error('❌ Profile loading failed:', handleError(error, 'BackgroundDataService/stage2_LoadProfileOnly'));
      return null;
    } finally {
      this.separatedSystems.profile.loading = false;
    }
  }

  /**
   * FIX 4K: THREAD-SAFE LOAD MORE FEED VIDEOS
   */
  async loadMoreFeedVideos(currentVideoCount) {
    return await this.queueOperation('load-more-feed', async () => {
      try {
        console.log(`🔄 Loading more feed videos (current: ${currentVideoCount})`);
        
        const moreFeedVideos = await fetchVideos(currentVideoCount, 3);

        if (moreFeedVideos && moreFeedVideos.length > 0) {
          // Update cache in background
          InteractionManager.runAfterInteractions(async () => {
            const existingFeedCache = await getDiscoverCache() || [];
            const combinedFeedVideos = [...existingFeedCache, ...moreFeedVideos];
            cacheFeedVideos(combinedFeedVideos);
          });

          this.separatedSystems.feed.videoCount += moreFeedVideos.length;
          this.separatedSystems.feed.lastUpdate = Date.now();
          
          console.log(`✅ Loaded ${moreFeedVideos.length} more feed videos`);
          return moreFeedVideos;
        } else {
          console.log('⚠️ No more feed videos available');
          return [];
        }
      } catch (error) {
        console.error('❌ BackgroundDataService: loadMoreFeedVideos failed:', handleError(error, 'BackgroundDataService/loadMoreFeedVideos'));
        return [];
      }
    }, 'normal');
  }

  /**
   * FIX 4L: STABLE STATUS GETTER (no side effects)
   */
  getSeparatedSystemStatus() {
    // Return frozen object to prevent mutations
    return Object.freeze({
      feed: Object.freeze({
        ...this.separatedSystems.feed,
        independent: true,
        systemType: 'feed_only'
      }),
      profile: Object.freeze({
        ...this.separatedSystems.profile,
        independent: true,
        systemType: 'profile_only'
      }),
      separation: Object.freeze({
        feedAffectsProfile: false,
        profileAffectsFeed: false,
        independentCaches: true,
        independentAPIs: true
      })
    });
  }

  /**
   * FIX 4M: THREAD-SAFE FORCE REFRESH operations
   */
  async forceRefreshFeedOnly() {
    return await this.queueOperation('force-refresh-feed', async () => {
      console.log('🔄 BackgroundDataService: Force refreshing feed...');
      
      try {
        this.separatedSystems.feed.loaded = false;
        this.separatedSystems.feed.loading = false;
        
        resetVideoState();
        const result = await this.stage1_LoadFeedOnly();
        
        console.log('✅ BackgroundDataService: Feed refresh completed');
        return result;
      } catch (error) {
        console.error('❌ BackgroundDataService: Feed refresh failed:', handleError(error, 'BackgroundDataService/forceRefreshFeedOnly'));
        throw error;
      }
    }, 'high');
  }

  async forceRefreshProfileOnly() {
    return await this.queueOperation('force-refresh-profile', async () => {
      console.log('🔄 BackgroundDataService: Force refreshing profile...');
      
      try {
        this.separatedSystems.profile.loaded = false;
        this.separatedSystems.profile.loading = false;
        
        const result = await this.stage2_LoadProfileOnly();
        
        console.log('✅ BackgroundDataService: Profile refresh completed');
        return result;
      } catch (error) {
        console.error('❌ BackgroundDataService: Profile refresh failed:', handleError(error, 'BackgroundDataService/forceRefreshProfileOnly'));
        throw error;
      }
    }, 'normal');
  }

  /**
   * FIX 4N: PARALLEL REFRESH with thread safety
   */
  async forceRefreshAll() {
    console.log('🔄 BackgroundDataService: Force refreshing all systems...');
    
    try {
      // Reset both systems
      this.separatedSystems.feed.loaded = false;
      this.separatedSystems.feed.loading = false;
      this.separatedSystems.profile.loaded = false;
      this.separatedSystems.profile.loading = false;
      
      // Use queue system for coordinated refresh
      const feedPromise = this.queueOperation('refresh-all-feed', async () => {
        return await this.stage1_LoadFeedOnly();
      }, 'high');
      
      const profilePromise = this.queueOperation('refresh-all-profile', async () => {
        return await this.stage2_LoadProfileOnly();
      }, 'low');
      
      // Wait for both to complete
      const [feedResult, profileResult] = await Promise.allSettled([feedPromise, profilePromise]);
      
      console.log('✅ BackgroundDataService: All systems refreshed');
      return {
        feed: feedResult.status === 'fulfilled' ? feedResult.value : null,
        profile: profileResult.status === 'fulfilled' ? profileResult.value : null
      };
    } catch (error) {
      console.error('❌ BackgroundDataService: Force refresh failed:', handleError(error, 'BackgroundDataService/forceRefreshAll'));
      throw error;
    }
  }

  /**
   * FIX 4O: ENHANCED LOADING STATUS for UI
   */
  getLoadingStatus() {
    const separatedStatus = this.getSeparatedSystemStatus();
    
    return Object.freeze({
      isLoading: this.isLoading,
      currentStage: this.loadingStage,
      stageNames: Object.freeze({
        1: 'Loading Feed',
        2: 'Loading Profile'
      }),
      systems: separatedStatus,
      totalFeedVideos: separatedStatus.feed.videoCount,
      totalProfileVideos: separatedStatus.profile.videoCount,
      systemsSeparated: true,
      activeOperations: Array.from(this.activeOperations),
      queueLength: this.operationQueue.length
    });
  }

  /**
   * FIX 4P: CLEANUP AND HEALTH CHECK
   */
  async performHealthCheck() {
    return await this.queueOperation('health-check', async () => {
      const health = {
        healthy: true,
        issues: [],
        systems: {}
      };

      // Check feed system
      health.systems.feed = {
        loaded: this.separatedSystems.feed.loaded,
        videoCount: this.separatedSystems.feed.videoCount,
        lastUpdate: this.separatedSystems.feed.lastUpdate,
        stale: this.separatedSystems.feed.lastUpdate && 
               (Date.now() - this.separatedSystems.feed.lastUpdate) > 30 * 60 * 1000 // 30 min
      };

      // Check profile system
      health.systems.profile = {
        loaded: this.separatedSystems.profile.loaded,
        videoCount: this.separatedSystems.profile.videoCount,
        lastUpdate: this.separatedSystems.profile.lastUpdate,
        stale: this.separatedSystems.profile.lastUpdate && 
               (Date.now() - this.separatedSystems.profile.lastUpdate) > 60 * 60 * 1000 // 1 hour
      };

      // Check for issues
      if (health.systems.feed.stale) {
        health.healthy = false;
        health.issues.push('Feed data is stale');
      }

      if (health.systems.profile.stale) {
        health.healthy = false;
        health.issues.push('Profile data is stale');
      }

      if (this.activeOperations.size > 5) {
        health.healthy = false;
        health.issues.push('Too many active operations');
      }

      console.log('🏥 BackgroundDataService health check:', health);
      return health;
    }, 'normal');
  }

  /**
   * FIX 4Q: GRACEFUL SHUTDOWN
   */
  shutdown() {
    console.log('🔄 BackgroundDataService: Graceful shutdown initiated');
    
    // Clear all timers
    this.stabilityTimers.forEach(timer => clearTimeout(timer));
    this.stabilityTimers.clear();
    
    // Clear operation queue
    this.operationQueue.forEach(op => op.reject(new Error('Service shutdown')));
    this.operationQueue = [];
    
    // Reset state
    this.isLoading = false;
    this.isProcessingQueue = false;
    this.activeOperations.clear();
    
    console.log('✅ BackgroundDataService: Shutdown completed');
  }

  /**
   * Get current loading stage
   */
  getCurrentStage() {
    return this.loadingStage;
  }

  /**
   * Check if specific stage is complete
   */
  isStageComplete(stage) {
    return this.loadingStage >= stage;
  }
}

// Export singleton instance
export default new BackgroundDataService();