/**
 * Enhanced cache manager with COMPLETELY SEPARATED feed and profile caches
 * This prevents feed and profile videos from interfering with each other
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// SEPARATED cache keys - feed and profile are completely independent
const CACHE_KEYS = {
  // FEED-ONLY caches
  FEED_VIDEOS: 'feed_videos_cache_v3',
  FEED_METADATA: 'feed_metadata_cache_v3',
  FEED_TIMESTAMPS: 'feed_timestamps_v3',
  
  // PROFILE-ONLY caches (completely separate)
  USER_PROFILE: 'user_profile_cache_v3',
  PROFILE_VIDEOS: 'profile_videos_cache_v3',
  PROFILE_TIMESTAMPS: 'profile_timestamps_v3',
  
  // General timestamps
  CACHE_TIMESTAMPS: 'cache_timestamps_v3'
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
  FEED_VIDEOS: 10 * 60 * 1000,    // 10 minutes for feed
  USER_PROFILE: 30 * 60 * 1000,   // 30 minutes for profile
  PROFILE_VIDEOS: 60 * 60 * 1000, // 1 hour for profile videos (keep longer)
};

/**
 * Get current timestamp
 * @returns {number} Current timestamp
 */
const getCurrentTimestamp = () => Date.now();

/**
 * Check if cache is expired
 * @param {number} timestamp - Cache timestamp
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {boolean} True if expired
 */
const isCacheExpired = (timestamp, maxAge) => {
  return (getCurrentTimestamp() - timestamp) > maxAge;
};

/**
 * Get cache timestamp for a specific key
 * @param {string} key - Cache key
 * @returns {Promise<number|null>} Timestamp or null
 */
const getCacheTimestamp = async (key) => {
  try {
    const timestamps = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMPS);
    if (timestamps) {
      const parsed = JSON.parse(timestamps);
      return parsed[key] || null;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting cache timestamp:', error);
    return null;
  }
};

/**
 * Set cache timestamp for a specific key
 * @param {string} key - Cache key
 * @param {number} timestamp - Timestamp to set
 */
const setCacheTimestamp = async (key, timestamp = getCurrentTimestamp()) => {
  try {
    const timestamps = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMPS);
    const parsed = timestamps ? JSON.parse(timestamps) : {};
    parsed[key] = timestamp;
    await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));
  } catch (error) {
    console.error('❌ Error setting cache timestamp:', error);
  }
};

// ============================================================================
// FEED CACHE MANAGEMENT (COMPLETELY SEPARATE FROM PROFILE)
// ============================================================================

/**
 * Cache FEED videos with metadata (independent of profile videos)
 * @param {Array} feedVideos - Array of FEED video objects
 * @param {Object} metadata - Additional metadata (page, hasMore, etc.)
 */
export const cacheFeedVideos = async (feedVideos, metadata = {}) => {
  try {
    console.log(`💾 Caching ${feedVideos.length} FEED videos (separate from profile)`);
    
    // Cache FEED videos only
    await AsyncStorage.setItem(CACHE_KEYS.FEED_VIDEOS, JSON.stringify(feedVideos));
    
    // Cache FEED metadata
    const feedMetadata = {
      videoCount: feedVideos.length,
      lastUpdated: getCurrentTimestamp(),
      type: 'feed_only', // Mark as feed-only cache
      ...metadata
    };
    await AsyncStorage.setItem(CACHE_KEYS.FEED_METADATA, JSON.stringify(feedMetadata));
    
    // Set FEED timestamp
    await setCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
    
    console.log('✅ FEED videos cached successfully (profile unaffected)');
  } catch (error) {
    console.error('❌ Error caching FEED videos:', error);
  }
};

/**
 * Get cached FEED videos (independent of profile videos)
 * @returns {Promise<Array|null>} Cached FEED videos or null if expired/not found
 */
export const getFeedCache = async () => {
  try {
    // Check if FEED cache exists and is not expired
    const timestamp = await getCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
    if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS)) {
      console.log('⏰ FEED cache expired or not found');
      return null;
    }

    // Get cached FEED videos
    const cachedFeedVideos = await AsyncStorage.getItem(CACHE_KEYS.FEED_VIDEOS);
    if (cachedFeedVideos) {
      const feedVideos = JSON.parse(cachedFeedVideos);
      console.log(`⚡ Retrieved ${feedVideos.length} cached FEED videos (separate from profile)`);
      return feedVideos;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting FEED cache:', error);
    return null;
  }
};

/**
 * Get FEED cache metadata (independent of profile)
 * @returns {Promise<Object|null>} FEED metadata or null
 */
export const getFeedMetadata = async () => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_KEYS.FEED_METADATA);
    if (metadata) {
      const parsed = JSON.parse(metadata);
      console.log(`📊 FEED metadata: ${parsed.videoCount} videos, type: ${parsed.type}`);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting FEED metadata:', error);
    return null;
  }
};

/**
 * Clear FEED cache only (profile cache unaffected)
 */
export const clearFeedCache = async () => {
  try {
    console.log('🧹 Clearing FEED cache only (profile cache preserved)...');
    
    await AsyncStorage.multiRemove([
      CACHE_KEYS.FEED_VIDEOS,
      CACHE_KEYS.FEED_METADATA
    ]);
    
    console.log('✅ FEED cache cleared (profile cache untouched)');
  } catch (error) {
    console.error('❌ Error clearing FEED cache:', error);
  }
};

// ============================================================================
// PROFILE CACHE MANAGEMENT (COMPLETELY SEPARATE FROM FEED)
// ============================================================================

/**
 * Cache user profile data (independent of feed videos)
 * @param {Object} profileData - User profile data
 * @param {string} userEmail - User email for cache key
 */
export const cacheUserProfile = async (profileData, userEmail) => {
  try {
    console.log(`💾 Caching profile for user: ${userEmail} (separate from feed)`);
    
    // Create PROFILE-specific cache key
    const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
    
    // Cache profile data (excluding videos for separate storage)
    const profileDataWithoutVideos = { ...profileData };
    const profileVideos = profileDataWithoutVideos.videos || [];
    delete profileDataWithoutVideos.videos; // Remove videos for separate storage
    
    await AsyncStorage.setItem(profileCacheKey, JSON.stringify(profileDataWithoutVideos));
    
    // Cache PROFILE videos SEPARATELY from feed videos
    if (profileVideos && profileVideos.length > 0) {
      const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
      await AsyncStorage.setItem(profileVideosCacheKey, JSON.stringify(profileVideos));
      await setCacheTimestamp(profileVideosCacheKey);
      console.log(`💾 Cached ${profileVideos.length} PROFILE videos separately from feed`);
    }
    
    // Set PROFILE timestamp
    await setCacheTimestamp(profileCacheKey);
    
    console.log('✅ Profile cached successfully (independent of feed)');
  } catch (error) {
    console.error('❌ Error caching profile:', error);
  }
};

/**
 * Get cached user profile (independent of feed videos)
 * @param {string} userEmail - User email
 * @returns {Promise<Object|null>} Cached profile or null if expired/not found
 */
export const getProfileCache = async (userEmail) => {
  try {
    const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
    
    // Check if PROFILE cache exists and is not expired
    const timestamp = await getCacheTimestamp(profileCacheKey);
    if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.USER_PROFILE)) {
      console.log('⏰ PROFILE cache expired or not found for:', userEmail);
      return null;
    }

    // Get cached PROFILE data
    const cachedProfile = await AsyncStorage.getItem(profileCacheKey);
    if (cachedProfile) {
      const profile = JSON.parse(cachedProfile);
      
      // Get PROFILE videos from separate cache
      const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
      const videoTimestamp = await getCacheTimestamp(profileVideosCacheKey);
      
      if (videoTimestamp && !isCacheExpired(videoTimestamp, CACHE_EXPIRY.PROFILE_VIDEOS)) {
        const cachedProfileVideos = await AsyncStorage.getItem(profileVideosCacheKey);
        if (cachedProfileVideos) {
          profile.videos = JSON.parse(cachedProfileVideos);
          console.log(`⚡ Restored ${profile.videos.length} PROFILE videos from separate cache`);
        }
      }
      
      console.log(`⚡ Retrieved cached profile for: ${userEmail} (independent of feed)`);
      return profile;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting PROFILE cache:', error);
    return null;
  }
};

/**
 * Clear specific user's PROFILE cache only (feed cache unaffected)
 * @param {string} userEmail - User email
 */
export const clearProfileCache = async (userEmail) => {
  try {
    console.log(`🧹 Clearing PROFILE cache for: ${userEmail} (feed cache preserved)`);
    
    const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
    const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
    
    await AsyncStorage.multiRemove([profileCacheKey, profileVideosCacheKey]);
    
    console.log('✅ PROFILE cache cleared (feed cache untouched)');
  } catch (error) {
    console.error('❌ Error clearing PROFILE cache:', error);
  }
};

// ============================================================================
// CACHE MANAGEMENT & CLEANUP (SEPARATED SYSTEMS)
// ============================================================================

/**
 * Clear all caches (both feed and profile)
 */
export const clearAllCaches = async () => {
  try {
    console.log('🧹 Clearing ALL caches (both feed and profile)...');
    
    // Get all cache keys
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(key => 
      key.includes('_cache_v3') || key.includes('_metadata_v3') || key.includes('_timestamps_v3')
    );
    
    // Remove all cache keys
    await AsyncStorage.multiRemove(cacheKeys);
    
    console.log(`✅ Cleared ${cacheKeys.length} cache entries (feed + profile)`);
  } catch (error) {
    console.error('❌ Error clearing all caches:', error);
  }
};

/**
 * Get separated cache statistics
 * @returns {Promise<Object>} Cache statistics for feed and profile separately
 */
export const getCacheStats = async () => {
  try {
    const stats = {
      feedVideos: 0,
      feedCacheSize: 0,
      profileCaches: 0,
      profileVideos: 0,
      totalCacheEntries: 0,
      timestamps: {},
      separation: 'feed_and_profile_independent'
    };

    // Get all keys and separate by type
    const allKeys = await AsyncStorage.getAllKeys();
    const feedKeys = allKeys.filter(key => key.includes('feed_') && key.includes('_cache_v3'));
    const profileKeys = allKeys.filter(key => key.includes('profile_') && key.includes('_cache_v3'));
    
    // Count FEED videos
    const feedVideosKey = allKeys.find(key => key === CACHE_KEYS.FEED_VIDEOS);
    if (feedVideosKey) {
      const feedData = await AsyncStorage.getItem(feedVideosKey);
      if (feedData) {
        const feedVideos = JSON.parse(feedData);
        stats.feedVideos = feedVideos.length;
      }
    }
    
    // Count PROFILE caches
    stats.profileCaches = profileKeys.filter(key => key.includes('user_profile')).length;
    
    // Count total PROFILE videos across all users
    const profileVideoKeys = profileKeys.filter(key => key.includes('profile_videos'));
    for (const key of profileVideoKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const videos = JSON.parse(data);
        stats.profileVideos += videos.length;
      }
    }
    
    stats.feedCacheSize = feedKeys.length;
    stats.totalCacheEntries = feedKeys.length + profileKeys.length;

    // Get timestamps
    const timestamps = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMPS);
    if (timestamps) {
      stats.timestamps = JSON.parse(timestamps);
    }

    console.log('📊 Cache Stats:', {
      feed: `${stats.feedVideos} videos in ${stats.feedCacheSize} entries`,
      profile: `${stats.profileVideos} videos across ${stats.profileCaches} profiles`,
      total: `${stats.totalCacheEntries} cache entries`,
      separation: stats.separation
    });

    return stats;
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return null;
  }
};

// ============================================================================
// VIDEO FILE CACHE MANAGEMENT (SHARED FOR EFFICIENCY)
// ============================================================================

/**
 * Manages video file cache by removing oldest files when size limit is reached
 * This is shared between feed and profile videos for efficient storage management
 * @param {number} maxCacheSizeMB - Maximum cache size in MB
 */
export const manageCacheSize = async (maxCacheSizeMB = 200) => {
  try {
    const maxCacheBytes = maxCacheSizeMB * 1024 * 1024;
    const videoCacheDir = `${FileSystem.cacheDirectory}videos`;
    
    const dirInfo = await FileSystem.getInfoAsync(videoCacheDir);
    if (!dirInfo.exists) {
      return;
    }
    
    const files = await FileSystem.readDirectoryAsync(videoCacheDir);
    
    const fileInfoPromises = files.map(async (filename) => {
      const fileUri = `${videoCacheDir}/${filename}`;
      const info = await FileSystem.getInfoAsync(fileUri);
      return {
        uri: fileUri,
        name: filename,
        modTime: info.modificationTime || 0,
        size: info.size || 0,
        type: filename.includes('feed') ? 'feed' : filename.includes('profile') ? 'profile' : 'unknown'
      };
    });
    
    const fileInfos = await Promise.all(fileInfoPromises);
    const totalCacheBytes = fileInfos.reduce((sum, file) => sum + file.size, 0);
    const feedFiles = fileInfos.filter(f => f.type === 'feed');
    const profileFiles = fileInfos.filter(f => f.type === 'profile');
    
    console.log(`📊 Video cache size: ${(totalCacheBytes / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`📊 Feed files: ${feedFiles.length}, Profile files: ${profileFiles.length}`);
    
    if (totalCacheBytes > maxCacheBytes) {
      console.log(`🧹 Video cache cleanup needed (${(totalCacheBytes / (1024 * 1024)).toFixed(2)}MB/${maxCacheSizeMB}MB)`);
      
      // Prioritize removing feed files over profile files (profile videos are more permanent)
      const sortedFiles = [
        ...feedFiles.sort((a, b) => a.modTime - b.modTime), // Feed files first (oldest first)
        ...profileFiles.sort((a, b) => a.modTime - b.modTime) // Profile files second (if needed)
      ];
      
      let bytesToFree = totalCacheBytes - maxCacheBytes;
      let freedBytes = 0;
      
      for (const file of sortedFiles) {
        if (freedBytes >= bytesToFree) break;
        
        console.log(`🗑️ Removing cached video (${file.type}): ${file.name}`);
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
        freedBytes += file.size;
      }
      
      console.log(`✅ Video cache cleanup complete. Freed ${(freedBytes / (1024 * 1024)).toFixed(2)}MB`);
    }
  } catch (error) {
    console.error('❌ Error managing video cache size:', error);
  }
};

// ============================================================================
// HELPER FUNCTIONS FOR DEBUGGING
// ============================================================================

/**
 * Log current cache separation status
 */
export const logCacheSeparation = async () => {
  try {
    const stats = await getCacheStats();
    console.log('🔍 CACHE SEPARATION STATUS:');
    console.log(`   📺 Feed: ${stats.feedVideos} videos in ${stats.feedCacheSize} cache entries`);
    console.log(`   👤 Profile: ${stats.profileVideos} videos across ${stats.profileCaches} user profiles`);
    console.log(`   🔒 Separation: ${stats.separation}`);
    console.log(`   📊 Total independent cache entries: ${stats.totalCacheEntries}`);
    
    return stats;
  } catch (error) {
    console.error('❌ Error logging cache separation:', error);
  }
};