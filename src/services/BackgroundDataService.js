/**
 * Enhanced Background Data Service with COMPLETELY SEPARATED feed and profile systems
 * STAGE 1: Feed loading (for FeedScreen) - independent system
 * STAGE 2: Profile loading (for ProfileScreen) - independent system  
 * STAGE 3: Additional feed prefetching - feed system only
 * 
 * This prevents feed and profile videos from interfering with each other
 */

import { fetchVideos, resetVideoState } from './videoService';
import { fetchUserProfile } from './profileService';
import { 
  cacheFeedVideos, 
  cacheUserProfile, 
  getFeedCache, 
  getProfileCache,
  logCacheSeparation 
} from '../utils/cacheManager';

// Keep track of video IDs we've already fetched to avoid duplicates
let fetchedVideoIds = new Set();

class BackgroundDataService {
  constructor() {
    this.isLoading = false;
    this.loadingStage = 0;
    this.userData = null;
    this.stages = {
      FEED_PRIORITY: 1,      // Feed videos only
      PROFILE_BACKGROUND: 2, // Profile data only
      // STAGE 3 handled by UI scroll
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
   * Start the separated staged loading process after successful login
   * @param {Object} userData - User data from login
   */
  async startStagedLoading(userData) {
    if (this.isLoading) {
      console.log('🔄 BackgroundDataService: Already loading, skipping');
      return;
    }

    console.log('🚀 BackgroundDataService: Starting SEPARATED staged loading for user:', userData.email);
    console.log('🔒 BackgroundDataService: Feed and Profile systems are INDEPENDENT');
    this.isLoading = true;
    this.userData = userData;

    try {
      // STAGE 1: Priority FEED loading (independent of profile)
      await this.stage1_LoadFeedOnly();
      
      // STAGE 2: Background PROFILE loading (independent of feed) - delayed
      setTimeout(() => this.stage2_LoadProfileOnly(), 2000);
      
    } catch (error) {
      console.error('❌ BackgroundDataService: Error in separated staged loading:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * STAGE 1: Load FEED videos only (completely separate from profile)
   * Priority: Get FEED content on screen as fast as possible
   */
  async stage1_LoadFeedOnly() {
    if (this.separatedSystems.feed.loaded) {
      console.log('⚠️ Feed already loaded - skipping duplicate load');
      return;
    }
    console.log('🎯 STAGE 1: Loading FEED videos only (profile system independent)...');
    this.loadingStage = this.stages.FEED_PRIORITY;

    try {
      // Check if we have recent cached FEED first
      const cachedFeed = await getFeedCache();
      if (cachedFeed && cachedFeed.length > 0) {
        console.log(`⚡ STAGE 1: Using cached FEED videos: ${cachedFeed.length} (profile cache separate)`);
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = cachedFeed.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        return cachedFeed;
      }

      // No FEED cache or cache is stale, load from API
      console.log('📡 STAGE 1: Loading fresh FEED videos from API (independent of profile)...');
      resetVideoState(); // Reset FEED pagination only

      // Load 5 initial FEED videos using offset 0
      const feedVideos = await fetchVideos(0, 5);

      if (feedVideos && feedVideos.length > 0) {
        console.log(`✅ STAGE 1: Loaded ${feedVideos.length} FEED videos (profile system unaffected)`);
        await cacheFeedVideos(feedVideos);
        
        this.separatedSystems.feed.loaded = true;
        this.separatedSystems.feed.videoCount = feedVideos.length;
        this.separatedSystems.feed.lastUpdate = Date.now();
        
        return feedVideos;
      } else {
        console.log('⚠️ STAGE 1: No FEED videos received');
        return [];
      }
    } catch (error) {
      console.error('❌ STAGE 1: FEED loading failed:', error);
      return [];
    }
  }

  /**
   * STAGE 2: Load PROFILE data only (completely separate from feed)
   * Priority: Have PROFILE ready when user navigates to it
   */
  async stage2_LoadProfileOnly() {
    console.log('👤 STAGE 2: Loading PROFILE data only (feed system independent)...');
    this.loadingStage = this.stages.PROFILE_BACKGROUND;

    try {
      if (!this.userData || !this.userData.email) {
        console.log('⚠️ STAGE 2: No user email available for PROFILE loading');
        return;
      }

      // Check if we have recent cached PROFILE first
      const cachedProfile = await getProfileCache(this.userData.email);
      if (cachedProfile) {
        console.log(`⚡ STAGE 2: PROFILE already cached for user: ${this.userData.email} (feed cache separate)`);
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = cachedProfile.videos ? cachedProfile.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        return cachedProfile;
      }

      // Load PROFILE from API (independent of feed API)
      console.log(`📡 STAGE 2: Loading PROFILE from API for: ${this.userData.email} (independent of feed)`);
      const profileData = await fetchUserProfile('email', this.userData.email);
      
      if (profileData) {
        console.log('✅ STAGE 2: PROFILE loaded successfully (feed system unaffected)');
        console.log(`📺 STAGE 2: PROFILE has ${profileData.videos ? profileData.videos.length : 0} videos (separate from feed)`);
        
        await cacheUserProfile(profileData, this.userData.email);
        
        this.separatedSystems.profile.loaded = true;
        this.separatedSystems.profile.videoCount = profileData.videos ? profileData.videos.length : 0;
        this.separatedSystems.profile.lastUpdate = Date.now();
        
        // Log separation status
        await logCacheSeparation();
        
        return profileData;
      } else {
        console.log('⚠️ STAGE 2: No PROFILE data received');
      }
    } catch (error) {
      console.error('❌ STAGE 2: PROFILE loading failed:', error);
    }
  }

  /**
   * Load more FEED videos (independent of profile)
   * This method is intended to be called by the UI component (e.g., FeedScreen) on scroll.
   * @param {number} currentVideoCount - The current number of videos loaded in the feed.
   * @returns {Promise<Array>} - Array of newly loaded unique video objects.
   */
  async loadMoreFeedVideos(currentVideoCount) {
    console.log(`📈 BackgroundDataService: Loading more FEED videos from offset ${currentVideoCount}...`);
    try {
      // Fetch the next 5 videos starting from the current count
      const moreFeedVideos = await fetchVideos(currentVideoCount, 5);

      if (moreFeedVideos && moreFeedVideos.length > 0) {
        console.log(`✅ BackgroundDataService: Loaded ${moreFeedVideos.length} additional FEED videos.`);

        // Append to existing FEED cache (profile cache separate)
        const existingFeedCache = await getFeedCache() || [];
        const combinedFeedVideos = [...existingFeedCache, ...moreFeedVideos];
        await cacheFeedVideos(combinedFeedVideos);

        this.separatedSystems.feed.videoCount = combinedFeedVideos.length;

        console.log(`📊 BackgroundDataService: Total cached FEED videos: ${combinedFeedVideos.length}`);
        console.log(`🔒 BackgroundDataService: Feed and Profile systems remain INDEPENDENT`);

        return moreFeedVideos;
      } else {
        console.log('⚠️ BackgroundDataService: No new FEED videos received in loadMoreFeedVideos.');
        return [];
      }
    } catch (error) {
      console.error('❌ BackgroundDataService: loadMoreFeedVideos failed:', error);
      return [];
    }
  }

  /**
   * Check current loading stage
   * @returns {number} Current stage number
   */
  getCurrentStage() {
    return this.loadingStage;
  }

  /**
   * Check if specific stage is complete
   * @param {number} stage - Stage to check
   * @returns {boolean}
   */
  isStageComplete(stage) {
    return this.loadingStage >= stage;
  }

  /**
   * Get separated system status
   * @returns {Object} Status of both independent systems
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
   * Force refresh FEED system only (profile system unaffected)
   */
  async forceRefreshFeedOnly() {
    console.log('🔄 BackgroundDataService: Force refreshing FEED system only (profile unaffected)...');
    
    try {
      resetVideoState(); // Reset FEED state only
      await this.stage1_LoadFeedOnly();
      
      console.log('✅ BackgroundDataService: FEED force refresh completed (profile system unchanged)');
      
      // Log separation status
      const status = this.getSeparatedSystemStatus();
      console.log('🔒 System separation maintained:', status.separation);
      
    } catch (error) {
      console.error('❌ BackgroundDataService: FEED force refresh failed:', error);
    }
  }

  /**
   * Force refresh PROFILE system only (feed system unaffected)
   */
  async forceRefreshProfileOnly() {
    console.log('🔄 BackgroundDataService: Force refreshing PROFILE system only (feed unaffected)...');
    
    try {
      await this.stage2_LoadProfileOnly();
      
      console.log('✅ BackgroundDataService: PROFILE force refresh completed (feed system unchanged)');
      
      // Log separation status
      const status = this.getSeparatedSystemStatus();
      console.log('🔒 System separation maintained:', status.separation);
      
    } catch (error) {
      console.error('❌ BackgroundDataService: PROFILE force refresh failed:', error);
    }
  }

  /**
   * Force refresh all systems (both feed and profile independently)
   */
  async forceRefreshAll() {
    console.log('🔄 BackgroundDataService: Force refreshing ALL systems (maintaining separation)...');
    
    try {
      // Refresh both systems independently (in parallel)
      await Promise.all([
        this.forceRefreshFeedOnly(),
        this.forceRefreshProfileOnly()
      ]);
      
      console.log('✅ BackgroundDataService: All systems force refresh completed (separation maintained)');
      
      // Log final separation status
      await logCacheSeparation();
      
    } catch (error) {
      console.error('❌ BackgroundDataService: Force refresh all failed:', error);
    }
  }

  /**
   * Get loading status for UI feedback (separated systems)
   */
  getLoadingStatus() {
    const separatedStatus = this.getSeparatedSystemStatus();
    
    return {
      isLoading: this.isLoading,
      currentStage: this.loadingStage,
      stageNames: {
        1: 'Loading Feed (Independent)',
        2: 'Loading Profile (Independent)'
      },
      systems: separatedStatus,
      totalFeedVideos: separatedStatus.feed.videoCount,
      totalProfileVideos: separatedStatus.profile.videoCount,
      systemsSeparated: true
    };
  }

  /**
   * Log detailed separation status for debugging
   */
  async logDetailedSeparation() {
    try {
      const status = this.getSeparatedSystemStatus();
      
      console.log('🔍 DETAILED SEPARATION STATUS:');
      console.log(`   📺 FEED System: ${status.feed.videoCount} videos, loaded: ${status.feed.loaded}`);
      console.log(`   👤 PROFILE System: ${status.profile.videoCount} videos, loaded: ${status.profile.loaded}`);
      console.log(`   🔒 Feed affects Profile: ${status.separation.feedAffectsProfile}`);
      console.log(`   🔒 Profile affects Feed: ${status.separation.profileAffectsFeed}`);
      console.log(`   🔒 Independent caches: ${status.separation.independentCaches}`);
      console.log(`   🔒 Independent APIs: ${status.separation.independentAPIs}`);
      
      // Also log cache separation
      await logCacheSeparation();
      
      return status;
    } catch (error) {
      console.error('❌ Error logging detailed separation:', error);
    }
  }
}

// Export singleton instance
export default new BackgroundDataService();