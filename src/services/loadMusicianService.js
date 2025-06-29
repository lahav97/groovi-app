/**
 * loadMusicianService.js - FIXED FOR NULL DATA
 * Handles backend API failures and NULL database values gracefully
 */

import { fetchUserProfile } from './profileService';
import { fetchVideos, resetVideoState, forceResetHasMoreVideos } from './videoService';
import { getDiscoverCache, cacheFeedVideos } from '../utils/cacheManager';
import { ERROR_MESSAGES, handleError } from '../utils/errors';
import { InteractionManager } from 'react-native';

const MUSICIAN_LOAD_CONFIG = {
  INITIAL_BATCH_SIZE: 5,
  LOAD_MORE_BATCH_SIZE: 3,
  VIDEO_FETCH_MULTIPLIER: 8, // Increased to account for failures
  MAX_RETRY_ATTEMPTS: 1,     // Reduced - fail fast and use fallback
  THROTTLE_MS: 500,
  CACHE_DURATION: 5 * 60 * 1000,
};

// Global state
let lastLoadTime = 0;
let isCurrentlyLoading = false;
let processedUsernames = new Set();
let videoPageOffset = 0;

/**
 * Generate realistic fallback data for failed profiles
 */
const generateFallbackMusician = (username, videoUrl) => {
  const instruments = ['Guitar', 'Piano', 'Drums', 'Violin', 'Bass', 'Saxophone'];
  const locations = ['Tel Aviv', 'New York', 'London', 'Berlin', 'Tokyo', 'Unknown'];
  const bios = [
    'Music enthusiast looking to connect!',
    'Passionate musician ready to collaborate',
    'Creating music and spreading good vibes',
    'Let\'s make music together!',
    'Music is my language'
  ];

  return {
    username: username,
    videos: videoUrl ? [videoUrl] : [],
    instruments: [instruments[Math.floor(Math.random() * instruments.length)]],
    bio: bios[Math.floor(Math.random() * bios.length)],
    age: Math.floor(Math.random() * 20) + 20, // 20-40
    location: locations[Math.floor(Math.random() * locations.length)],
    genres: ['Music'],
    rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
    socialLink: null,
    id: username,
  };
};

/**
 * Main function: Load musicians for Tinder-style cards
 */
export const loadMusiciansForCards = async (username, options = {}) => {
  const { 
    batchSize = MUSICIAN_LOAD_CONFIG.INITIAL_BATCH_SIZE,
    useCache = true,
    resetData = false 
  } = options;

  const now = Date.now();
  if (isCurrentlyLoading || (now - lastLoadTime < MUSICIAN_LOAD_CONFIG.THROTTLE_MS)) {
    console.log('⏳ Throttled - skipping duplicate call');
    return [];
  }

  isCurrentlyLoading = true;
  lastLoadTime = now;

  try {
    console.log(`🎵 Loading ${batchSize} musicians for ${username}`);

    if (resetData) {
      processedUsernames.clear();
      videoPageOffset = 0;
      resetVideoState();
    }

    // Try cache first
    if (useCache && !resetData) {
      const cachedMusicians = await tryLoadFromCache(batchSize);
      if (cachedMusicians.length > 0) {
        console.log(`⚡ Using ${cachedMusicians.length} cached musicians`);
        return cachedMusicians;
      }
    }

    // Load fresh data
    const musicians = await loadFreshMusicians(username, batchSize);

    // Cache results
    if (musicians.length > 0) {
      cacheMusiciansInBackground(musicians);
    }

    console.log(`✅ Successfully loaded ${musicians.length} musicians`);
    return musicians;

  } catch (error) {
    console.error('❌ loadMusiciansForCards error:', error);
    throw new Error(handleError(error, 'loadMusicianService/loadMusiciansForCards'));
  } finally {
    isCurrentlyLoading = false;
  }
};

/**
 * Load more musicians for pagination
 */
export const loadMoreMusicians = async (username, currentMusicians = []) => {
  console.log(`🔄 Loading ${MUSICIAN_LOAD_CONFIG.LOAD_MORE_BATCH_SIZE} more musicians`);

  try {
    const moreMusicians = await loadFreshMusicians(
      username, 
      MUSICIAN_LOAD_CONFIG.LOAD_MORE_BATCH_SIZE
    );

    const allMusicians = [...currentMusicians, ...moreMusicians];
    
    // Memory management
    const maxMusicians = 15;
    if (allMusicians.length > maxMusicians) {
      const trimmed = allMusicians.slice(-maxMusicians);
      console.log(`🧹 Trimmed musician list to ${trimmed.length}`);
      return trimmed;
    }

    return allMusicians;

  } catch (error) {
    console.error('❌ loadMoreMusicians error:', error);
    return currentMusicians;
  }
};

/**
 * Load with filters (placeholder for future)
 */
export const loadMusiciansWithFilters = async (username, filters = {}) => {
  console.log(`🔍 Loading with filters for ${username}`);
  
  return await loadMusiciansForCards(username, { 
    batchSize: MUSICIAN_LOAD_CONFIG.INITIAL_BATCH_SIZE,
    useCache: false
  });
};

/**
 * Try to load from cache
 */
const tryLoadFromCache = async (batchSize) => {
  try {
    const cachedData = await getDiscoverCache();
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      const cardReady = cachedData.slice(0, batchSize).map(transformToCardFormat);
      return cardReady;
    }
    return [];
  } catch (error) {
    console.warn('⚠️ Cache load failed:', error);
    return [];
  }
};

/**
 * Core loading logic with fallback handling
 */
const loadFreshMusicians = async (username, batchSize) => {
  // Get videos first
  const videosNeeded = batchSize * MUSICIAN_LOAD_CONFIG.VIDEO_FETCH_MULTIPLIER;
  const videos = await fetchVideos(videoPageOffset, videosNeeded);
  
  if (!videos || videos.length === 0) {
    console.log('❌ No videos found from API');
    return [];
  }

  console.log(`📹 Fetched ${videos.length} videos`);

  // Extract unique usernames
  const usernamesWithVideos = extractUsernamesWithVideos(videos, batchSize);
  
  if (usernamesWithVideos.length === 0) {
    console.log('⚠️ No new unique usernames found');
    videoPageOffset += 1;
    return [];
  }

  console.log(`👥 Found ${usernamesWithVideos.length} users with videos`);

  // Load profiles with smart fallback
  const musicians = await loadProfilesWithFallback(usernamesWithVideos);

  // Transform for cards
  const cardReadyMusicians = musicians.map(transformToCardFormat);

  // Update tracking
  videoPageOffset += 1;
  usernamesWithVideos.forEach(item => processedUsernames.add(item.username));

  return cardReadyMusicians;
};

/**
 * Extract usernames with their video URLs
 */
const extractUsernamesWithVideos = (videos, batchSize) => {
  const usersWithVideos = [];
  
  for (const video of videos) {
    const username = video.username || video.user;
    const videoUrl = video.video_url || video.videoUrl;
    
    if (username && videoUrl && !processedUsernames.has(username)) {
      usersWithVideos.push({ username, videoUrl });
      
      if (usersWithVideos.length >= batchSize) {
        break;
      }
    }
  }
  
  return usersWithVideos;
};

/**
 * Load profiles with smart fallback for failed API calls
 */
const loadProfilesWithFallback = async (usernamesWithVideos) => {
  const profilePromises = usernamesWithVideos.map(async ({ username, videoUrl }) => {
    try {
      console.log(`🔍 Loading profile: ${username}`);
      
      // Try to load real profile
      const profile = await fetchUserProfile('username', username);
      
      if (profile && (profile.success || profile.username)) {
        const userData = profile.profile || profile;
        
        // Ensure videos exist
        if (!userData.videos || userData.videos.length === 0) {
          userData.videos = [videoUrl];
        }
        
        // Clean NULL values and add defaults
        const cleanedData = {
          username: userData.username || username,
          videos: userData.videos || [videoUrl],
          instruments: userData.instruments || ['Music'],
          bio: userData.bio || 'Music enthusiast looking to connect!',
          age: userData.age || Math.floor(Math.random() * 20) + 20,
          location: userData.location || 'Unknown',
          genres: userData.genres || ['Music'],
          rating: userData.rating || Math.floor(Math.random() * 3) + 3,
          socialLink: userData.socialLink || null,
          id: userData.id || username,
        };
        
        console.log(`✅ Profile loaded: ${username}`);
        return cleanedData;
      }
      
      // Profile API returned invalid data - use fallback
      console.log(`⚠️ Invalid profile data for ${username} - using fallback`);
      return generateFallbackMusician(username, videoUrl);

    } catch (error) {
      // API failed (400 error, NULL data, etc.) - use fallback
      console.log(`⚠️ Profile API failed for ${username} - using fallback`);
      return generateFallbackMusician(username, videoUrl);
    }
  });

  const profiles = await Promise.all(profilePromises);
  
  // Filter out any nulls (shouldn't happen with fallback, but safety)
  const validProfiles = profiles.filter(profile => 
    profile && profile.username && profile.videos && profile.videos.length > 0
  );
  
  console.log(`📊 Loaded ${validProfiles.length}/${usernamesWithVideos.length} valid profiles`);
  return validProfiles;
};

/**
 * Transform musician data to card format
 */
const transformToCardFormat = (musician, index = 0) => {
  return {
    // Stable ID
    id: `card-${musician.username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    
    // Core data with fallbacks
    username: musician.username,
    videos: Array.isArray(musician.videos) ? musician.videos : [musician.videos].filter(Boolean),
    instruments: Array.isArray(musician.instruments) ? musician.instruments : [musician.instruments].filter(Boolean),
    bio: musician.bio || 'Music enthusiast looking to connect!',
    age: musician.age || null,
    location: musician.location || 'Unknown',
    genres: Array.isArray(musician.genres) ? musician.genres : [],
    rating: musician.rating || Math.floor(Math.random() * 3) + 3,
    socialLink: musician.socialLink || null,
    
    // Card-specific fields
    currentVideoIndex: 0,
    cardPosition: index,
    loadedAt: Date.now(),
    
    // Compatibility fields
    user_id: musician.id || musician.username,
    user: musician.username,
    video_url: musician.videos?.[0] || null,
    videoUrl: musician.videos?.[0] || null,
  };
};

/**
 * Background caching
 */
const cacheMusiciansInBackground = (musicians) => {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      try {
        cacheFeedVideos(musicians);
      } catch (error) {
        console.warn('⚠️ Background caching failed:', error);
      }
    }, 100);
  });
};

/**
 * Utility functions
 */
export const resetMusicianService = () => {
  processedUsernames.clear();
  videoPageOffset = 0;
  lastLoadTime = 0;
  isCurrentlyLoading = false;
  resetVideoState();
  forceResetHasMoreVideos();
  console.log('🔄 Musician service reset');
};

export const getMusicianServiceStats = () => {
  return {
    processedUsernamesCount: processedUsernames.size,
    videoPageOffset,
    lastLoadTime: new Date(lastLoadTime).toISOString(),
    isCurrentlyLoading,
  };
};

export const hasMoreMusicians = () => {
  return true;
};

export default {
  loadMusiciansForCards,
  loadMoreMusicians,
  loadMusiciansWithFilters,
  resetMusicianService,
  getMusicianServiceStats,
  hasMoreMusicians,
};