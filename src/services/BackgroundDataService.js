import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';
import { 
  cacheFeedVideos, 
  cacheUserProfile, 
  getFeedCache, 
  getProfileCache,
} from '../utils/cacheManager';

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
        lastUpdate: null
      },
      profile: {
        loaded: false,
        videoCount: 0,
        lastUpdate: null
      }
    };
  }

  /**
   * Start staged loading with duplicate prevention
   */
  async startStagedLoading(userData) {
    if (this.isLoading) {
      return;
    }

    console.log('🚀 BackgroundDataService: Starting optimized loading');
    this.isLoading = true;
    this.userData = userData;

    try {
      // Priority FEED loading
      await this.stage1_LoadFeedOnly();
      
      // Background PROFILE loading (delayed, non-blocking)
      setTimeout(() => this.stage2_LoadProfileOnly(), 1500);
      
    } catch (error) {
      console.error('❌ BackgroundDataService: Loading error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load FEED videos
   */
  async stage1_LoadFeedOnly() {
    if (this.separatedSystems.feed.loaded) {
      return;
    }
    
    console.log('🎯 Loading feed videos.');
    this.loadingStage = this.stages.FEED_PRIORITY;

    try {
      // Check cache first
      const cachedFeed = await getFeedCache();
      if (cachedFeed && cachedFeed.length > 0) {
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = cachedFeed.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        return cachedFeed;
      }

      // Load from API
      resetVideoState();
      const feedVideos = await fetchVideos(0, 5);

      if (feedVideos && feedVideos.length > 0) {
        await cacheFeedVideos(feedVideos);
        
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = feedVideos.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        
        return feedVideos;
      } else {
        console.log('⚠️ No videos received');
        return [];
      }
    } catch (error) {
      console.error('❌ Feed loading failed:', error);
      return [];
    }
  }

  /**
   * Load profile 
   */
  async stage2_LoadProfileOnly() {
    console.log('👤 Loading profile.');
    this.loadingStage = this.stages.PROFILE_BACKGROUND;

    try {
      if (!this.userData || !this.userData.email) {
        console.log('⚠️ No user email available');
        return;
      }

      // Check cached profile
      const cachedProfile = await getProfileCache(this.userData.email);
      if (cachedProfile) {       
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        return cachedProfile;
      }

      // Load from API
      const profileData = await fetchUserProfile('email', this.userData.email);
      
      if (profileData) {
        console.log('✅ Profile loaded successfully');
        
        await cacheUserProfile(profileData, this.userData.email);
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        return profileData;
      } else {
        console.log('⚠️ No profile data received');
      }
    } catch (error) {
      console.error('❌ Profile loading failed:', error);
    }
  }

  /**
   * Load more feed videos
   */
  async loadMoreFeedVideos(currentVideoCount) {
    try {
      const moreFeedVideos = await fetchVideos(currentVideoCount, 3); // Smaller batches

      if (moreFeedVideos && moreFeedVideos.length > 0) {
        // Update cache
        const existingFeedCache = await getFeedCache() || [];
        const combinedFeedVideos = [...existingFeedCache, ...moreFeedVideos];
        await cacheFeedVideos(combinedFeedVideos);

        this.separatedSystems.feed.videoCount = combinedFeedVideos.length;
        return moreFeedVideos;
      } else {
        return [];
      }
    } catch (error) {
      console.error('❌ BackgroundDataService: loadMoreFeedVideos failed:', error);
      return [];
    }
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

  /**
   * Get system status with less overhead
   */
  getSeparatedSystemStatus() {
    return {
      feed: {
        ...this.separatedSystems.feed,
        independent: true,
        systemType: 'feed_only'
      },
      profile: {
        ...this.separatedSystems.profile,
        independent: true,
        systemType: 'profile_only'
      },
      separation: {
        feedAffectsProfile: false,
        profileAffectsFeed: false,
        independentCaches: true,
        independentAPIs: true
      }
    };
  }

  /**
   * Force refresh feed only
   */
  async forceRefreshFeedOnly() {
    console.log('🔄 BackgroundDataService: Force refreshing feed...');
    
    try {
      this.separatedSystems.feed.loaded = false;
      resetVideoState();
      await this.stage1_LoadFeedOnly();
      console.log('✅ BackgroundDataService: Feed refresh completed');
    } catch (error) {
      console.error('❌ BackgroundDataService: Feed refresh failed:', error);
    }
  }

  /**
   * Force refresh profile only
   */
  async forceRefreshProfileOnly() {    
    try {
      this.separatedSystems.profile.loaded = false;
      await this.stage2_LoadProfileOnly();
      console.log('✅ BackgroundDataService: Profile refresh completed');
    } catch (error) {
      console.error('❌ BackgroundDataService: Profile refresh failed:', error);
    }
  }

  /**
   * Force refresh all systems
   */
  async forceRefreshAll() {    
    try {
      // Reset both systems
      this.separatedSystems.feed.loaded = false;
      this.separatedSystems.profile.loaded = false;
      
      // Refresh both systems in parallel
      await Promise.all([
        this.forceRefreshFeedOnly(),
        this.forceRefreshProfileOnly()
      ]);
      
      console.log('✅ BackgroundDataService: All systems refreshed');
    } catch (error) {
      console.error('❌ BackgroundDataService: Force refresh failed:', error);
    }
  }

  /**
   * Get loading status for UI
   */
  getLoadingStatus() {
    const separatedStatus = this.getSeparatedSystemStatus();
    
    return {
      isLoading: this.isLoading,
      currentStage: this.loadingStage,
      stageNames: {
        1: 'Loading Feed',
        2: 'Loading Profile'
      },
      systems: separatedStatus,
      totalFeedVideos: separatedStatus.feed.videoCount,
      totalProfileVideos: separatedStatus.profile.videoCount,
      systemsSeparated: true
    };
  }
}

// Export singleton instance
export default new BackgroundDataService();