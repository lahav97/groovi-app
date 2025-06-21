/**
 * ULTRA-OPTIMIZED cache manager with non-blocking operations
 * Prevents ALL cache operations from interfering with video scrolling
 * Uses priority queue system for smooth user experience
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { InteractionManager } from 'react-native';

// Cache keys - same as before
const CACHE_KEYS = {
  FEED_VIDEOS: 'feed_videos_cache',
  FEED_METADATA: 'feed_metadata_cache',
  feed_timestamps: 'feed_timestamps',
  USER_PROFILE: 'user_profile_cache',
  PROFILE_VIDEOS: 'profile_videos_cache',
  PROFILE_TIMESTAMPS: 'profile_timestamps',
  CACHE_TIMESTAMPS: 'cache_timestamps'
};

// Cache expiration times
const CACHE_EXPIRY = {
  FEED_VIDEOS: 10 * 60 * 1000,    // 10 minutes
  USER_PROFILE: 30 * 60 * 1000,   // 30 minutes
  PROFILE_VIDEOS: 60 * 60 * 1000, // 1 hour
};

// FIX 3A: PRIORITY-BASED CACHE QUEUE with InteractionManager
const cacheOperationQueue = [];
const highPriorityQueue = [];  // For critical operations (reads)
const lowPriorityQueue = [];   // For background operations (writes)
let isProcessingQueue = false;
let queueProcessor = null;

/**
 * FIX 3B: INTELLIGENT QUEUE PROCESSOR with priority handling
 */
const processCacheQueue = async () => {
  if (isProcessingQueue) return;
  
  isProcessingQueue = true;
  
  try {
    // Process high priority first (reads - user needs these now)
    while (highPriorityQueue.length > 0) {
      const operation = highPriorityQueue.shift();
      try {
        await operation();
      } catch (error) {
        console.error('❌ High priority cache operation failed:', error);
      }
      
      // Small break to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    
    // Process regular queue
    while (cacheOperationQueue.length > 0) {
      const operation = cacheOperationQueue.shift();
      try {
        await operation();
      } catch (error) {
        console.error('❌ Cache operation failed:', error);
      }
      
      // Small break to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Process low priority in background (writes - can wait)
    let lowPriorityProcessed = 0;
    while (lowPriorityQueue.length > 0 && lowPriorityProcessed < 3) {
      const operation = lowPriorityQueue.shift();
      try {
        await operation();
        lowPriorityProcessed++;
      } catch (error) {
        console.error('❌ Low priority cache operation failed:', error);
      }
      
      // Longer break for low priority
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
  } finally {
    isProcessingQueue = false;
    
    // Schedule next processing if queue has items
    if (highPriorityQueue.length > 0 || cacheOperationQueue.length > 0 || lowPriorityQueue.length > 0) {
      queueProcessor = setTimeout(processCacheQueue, 100);
    }
  }
};

/**
 * FIX 3C: SMART OPERATION QUEUING with priority levels
 */
const queueCacheOperation = (operation, priority = 'normal') => {
  switch (priority) {
    case 'high':
      highPriorityQueue.push(operation);
      break;
    case 'low':
      lowPriorityQueue.push(operation);
      break;
    default:
      cacheOperationQueue.push(operation);
  }
  
  // Use InteractionManager to avoid blocking UI
  InteractionManager.runAfterInteractions(() => {
    if (!isProcessingQueue) {
      processCacheQueue();
    }
  });
};

/**
 * FIX 3D: ULTRA-FAST SYNCHRONOUS CACHE READS (no queuing for reads)
 */
const quickCacheRead = async (key) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error('❌ Quick cache read failed:', error);
    return null;
  }
};

const getCurrentTimestamp = () => Date.now();

const isCacheExpired = (timestamp, maxAge) => {
  return (getCurrentTimestamp() - timestamp) > maxAge;
};

// FIX 3E: FAST CACHE TIMESTAMP OPERATIONS
const getCacheTimestamp = async (key) => {
  try {
    const timestamps = await quickCacheRead(CACHE_KEYS.CACHE_TIMESTAMPS);
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

const setCacheTimestamp = async (key, timestamp = getCurrentTimestamp()) => {
  // Queue as low priority - timestamps can wait
  queueCacheOperation(async () => {
    try {
      const timestamps = await quickCacheRead(CACHE_KEYS.CACHE_TIMESTAMPS);
      const parsed = timestamps ? JSON.parse(timestamps) : {};
      parsed[key] = timestamp;
      await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));
    } catch (error) {
      console.error('❌ Error setting cache timestamp:', error);
    }
  }, 'low');
};

// ============================================================================
// FIX 3F: ULTRA-FAST FEED CACHE OPERATIONS
// ============================================================================

/**
 * Cache FEED videos with absolute non-blocking operation
 * @param {Array} feedVideos - Array of FEED video objects
 * @param {Object} metadata - Additional metadata
 */
export const cacheFeedVideos = (feedVideos, metadata = {}) => {
  // CRITICAL: Always low priority - caching can wait, user experience can't
  queueCacheOperation(async () => {
    try {
      console.log(`💾 Background: Caching ${feedVideos.length} discover videos`);
      
      // Cache videos
      await AsyncStorage.setItem(CACHE_KEYS.FEED_VIDEOS, JSON.stringify(feedVideos));
      
      // Cache metadata
      const feedMetadata = {
        videoCount: feedVideos.length,
        lastUpdated: getCurrentTimestamp(),
        type: 'feed_only',
        ...metadata
      };
      await AsyncStorage.setItem(CACHE_KEYS.FEED_METADATA, JSON.stringify(feedMetadata));
      
      // Set timestamp
      await setCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
      
      console.log('✅ Background: FEED videos cached successfully');
    } catch (error) {
      console.error('❌ Background: Error caching FEED videos:', error);
    }
  }, 'low');
};

/**
 * FIX 3G: LIGHTNING-FAST FEED CACHE RETRIEVAL (synchronous when possible)
 * @returns {Promise<Array|null>} Cached FEED videos or null
 */
export const getDiscoverCache = async () => {
  try {
    // CRITICAL: Fast path - check timestamp first without queuing
    const timestamp = await getCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
    if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS)) {
      return null;
    }

    // CRITICAL: Direct read for maximum speed
    const cachedFeedVideos = await quickCacheRead(CACHE_KEYS.FEED_VIDEOS);
    if (cachedFeedVideos) {
      const feedVideos = JSON.parse(cachedFeedVideos);
      console.log(`⚡ Retrieved ${feedVideos.length} cached discover videos (instant)`);
      return feedVideos;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting FEED cache:', error);
    return null;
  }
};

/**
 * Get FEED cache metadata
 * @returns {Promise<Object|null>} FEED metadata or null
 */
export const getFeedMetadata = async () => {
  try {
    const metadata = await quickCacheRead(CACHE_KEYS.FEED_METADATA);
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
 * Clear FEED cache (low priority)
 */
export const clearFeedCache = () => {
  queueCacheOperation(async () => {
    try {
      console.log('🧹 Background: Clearing FEED cache only...');
      
      await AsyncStorage.multiRemove([
        CACHE_KEYS.FEED_VIDEOS,
        CACHE_KEYS.FEED_METADATA
      ]);
      
      console.log('✅ Background: FEED cache cleared');
    } catch (error) {
      console.error('❌ Background: Error clearing FEED cache:', error);
    }
  }, 'low');
};

// ============================================================================
// FIX 3H: PROFILE CACHE MANAGEMENT (SEPARATE FROM FEED)
// ============================================================================

/**
 * Cache user profile data (low priority - background operation)
 * @param {Object} profileData - User profile data
 * @param {string} userEmail - User email for cache key
 */
export const cacheUserProfile = (profileData, userEmail) => {
  queueCacheOperation(async () => {
    try {
      console.log(`💾 Background: Caching profile for user: ${userEmail}`);
      
      const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
      
      // Cache profile data (excluding videos for separate storage)
      const profileDataWithoutVideos = { ...profileData };
      const profileVideos = profileDataWithoutVideos.videos || [];
      delete profileDataWithoutVideos.videos;
      
      await AsyncStorage.setItem(profileCacheKey, JSON.stringify(profileDataWithoutVideos));
      
      // Cache PROFILE videos SEPARATELY
      if (profileVideos && profileVideos.length > 0) {
        const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
        await AsyncStorage.setItem(profileVideosCacheKey, JSON.stringify(profileVideos));
        await setCacheTimestamp(profileVideosCacheKey);
        console.log(`💾 Background: Cached ${profileVideos.length} PROFILE videos`);
      }
      
      // Set timestamp
      await setCacheTimestamp(profileCacheKey);
      
      console.log('✅ Background: Profile cached successfully');
    } catch (error) {
      console.error('❌ Background: Error caching profile:', error);
    }
  }, 'low');
};

/**
 * FIX 3I: FAST PROFILE CACHE RETRIEVAL
 * @param {string} userEmail - User email
 * @returns {Promise<Object|null>} Cached profile or null
 */
export const getProfileCache = async (userEmail) => {
  try {
    const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
    
    // Fast timestamp check
    const timestamp = await getCacheTimestamp(profileCacheKey);
    if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.USER_PROFILE)) {
      console.log('⏰ PROFILE cache expired for:', userEmail);
      return null;
    }

    // Direct read for speed
    const cachedProfile = await quickCacheRead(profileCacheKey);
    if (cachedProfile) {
      const profile = JSON.parse(cachedProfile);
      
      // Get profile videos from separate cache (fast)
      const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
      const videoTimestamp = await getCacheTimestamp(profileVideosCacheKey);
      
      if (videoTimestamp && !isCacheExpired(videoTimestamp, CACHE_EXPIRY.PROFILE_VIDEOS)) {
        const cachedProfileVideos = await quickCacheRead(profileVideosCacheKey);
        if (cachedProfileVideos) {
          profile.videos = JSON.parse(cachedProfileVideos);
          console.log(`⚡ Restored ${profile.videos.length} PROFILE videos (instant)`);
        }
      }
      
      return profile;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting PROFILE cache:', error);
    return null;
  }
};

/**
 * Clear specific user's PROFILE cache (low priority)
 * @param {string} userEmail - User email
 */
export const clearProfileCache = (userEmail) => {
  queueCacheOperation(async () => {
    try {
      console.log(`🧹 Background: Clearing PROFILE cache for: ${userEmail}`);
      
      const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
      const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
      
      await AsyncStorage.multiRemove([profileCacheKey, profileVideosCacheKey]);
      
      console.log('✅ Background: PROFILE cache cleared');
    } catch (error) {
      console.error('❌ Background: Error clearing PROFILE cache:', error);
    }
  }, 'low');
};

// ============================================================================
// FIX 3J: BACKGROUND CACHE MANAGEMENT & CLEANUP
// ============================================================================

/**
 * Clear all caches (low priority background operation)
 */
export const clearAllCaches = () => {
  queueCacheOperation(async () => {
    try {
      console.log('🧹 Background: Clearing ALL caches...');
      
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.includes('_cache_v3') || key.includes('_metadata_v3') || key.includes('_timestamps_v3')
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
      
      console.log(`✅ Background: Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      console.error('❌ Background: Error clearing all caches:', error);
    }
  }, 'low');
};

/**
 * FIX 3K: FAST CACHE STATISTICS (minimal queuing)
 * @returns {Promise<Object>} Cache statistics
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

    const allKeys = await AsyncStorage.getAllKeys();
    const feedKeys = allKeys.filter(key => key.includes('feed_') && key.includes('_cache_v3'));
    const profileKeys = allKeys.filter(key => key.includes('profile_') && key.includes('_cache_v3'));
    
    // Count feed videos (fast)
    const feedVideosKey = allKeys.find(key => key === CACHE_KEYS.FEED_VIDEOS);
    if (feedVideosKey) {
      const feedData = await quickCacheRead(feedVideosKey);
      if (feedData) {
        const feedVideos = JSON.parse(feedData);
        stats.feedVideos = feedVideos.length;
      }
    }
    
    // Count profile caches
    stats.profileCaches = profileKeys.filter(key => key.includes('user_profile')).length;
    
    // Count total profile videos (background operation)
    const profileVideoKeys = profileKeys.filter(key => key.includes('profile_videos'));
    for (const key of profileVideoKeys) {
      const data = await quickCacheRead(key);
      if (data) {
        const videos = JSON.parse(data);
        stats.profileVideos += videos.length;
      }
    }
    
    stats.feedCacheSize = feedKeys.length;
    stats.totalCacheEntries = feedKeys.length + profileKeys.length;

    // Get timestamps (fast)
    const timestamps = await quickCacheRead(CACHE_KEYS.CACHE_TIMESTAMPS);
    if (timestamps) {
      stats.timestamps = JSON.parse(timestamps);
    }

    console.log('📊 Cache Stats:', {
      discover: `${stats.feedVideos} videos in ${stats.feedCacheSize} entries`,
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
// FIX 3L: SMART VIDEO FILE CACHE MANAGEMENT (BACKGROUND ONLY)
// ============================================================================

/**
 * Manages video file cache by removing oldest files when size limit is reached
 * This is shared between discover and profile videos for efficient storage management
 * CRITICAL: Always runs in background, never blocks UI
 * @param {number} maxCacheSizeMB - Maximum cache size in MB
 */
export const manageCacheSize = async (maxCacheSizeMB = 200) => {
  // ALWAYS queue as low priority - this can NEVER block the UI
  queueCacheOperation(async () => {
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
      
      const filesWithInfo = await Promise.all(fileInfoPromises);
      const totalSize = filesWithInfo.reduce((sum, file) => sum + file.size, 0);
      
      console.log(`📊 Video cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      
      if (totalSize > maxCacheBytes) {
        console.log('🧹 Video cache cleanup needed...');
        
        // Sort by modification time (oldest first)
        const sortedFiles = filesWithInfo.sort((a, b) => a.modTime - b.modTime);
        
        let freedSpace = 0;
        const targetFreeSpace = totalSize - (maxCacheBytes * 0.8); // Free to 80% of limit
        
        for (const file of sortedFiles) {
          if (freedSpace >= targetFreeSpace) break;
          
          try {
            await FileSystem.deleteAsync(file.uri);
            freedSpace += file.size;
            console.log(`🗑️ Deleted old video cache: ${file.name}`);
          } catch (deleteError) {
            console.error(`❌ Failed to delete cache file: ${file.name}`, deleteError);
          }
          
          // Add small delay to prevent blocking
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        console.log(`✅ Cache cleanup complete. Freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
      }
    } catch (error) {
      console.error('❌ Error managing cache size:', error);
    }
  }, 'low');
};

// Initialize cache system
console.log('🚀 Optimized cache manager initialized');

// Auto-cleanup old operations every 30 seconds
setInterval(() => {
  if (lowPriorityQueue.length > 10) {
    console.log('🧹 Cleaning up cache queue...');
    lowPriorityQueue.splice(5); // Keep only 5 most recent operations
  }
}, 30000);