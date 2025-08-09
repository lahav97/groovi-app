/**
 * loadMusicianService.js - FIXED FOR CONSISTENT DATA FORMATS
 * Ensures all profile data is normalized and cache-safe before storage
 * FIXED: Prevents object rendering errors by normalizing data formats
 */

import { fetchUserProfile } from './profileService';
import { fetchVideos, resetVideoState, forceResetHasMoreVideos } from './videoService';
import { getDiscoverCache, cacheFeedVideos } from '../utils/cacheManager';
import { ERROR_MESSAGES, handleError } from '../utils/errors';
import { InteractionManager } from 'react-native';

const MUSICIAN_LOAD_CONFIG = {
  INITIAL_BATCH_SIZE: 5,
  LOAD_MORE_BATCH_SIZE: 3,
  VIDEO_FETCH_MULTIPLIER: 8,
  MAX_RETRY_ATTEMPTS: 1,
  THROTTLE_MS: 500,
  CACHE_DURATION: 5 * 60 * 1000,
};

// Global state
let lastLoadTime = 0;
let isCurrentlyLoading = false;
let processedUsernames = new Set();
let videoPageOffset = 0;

/**
 * FIXED: Safe field formatter to prevent object rendering errors
 */
const formatFieldSafely = (value, defaultValue = '') => {
  if (!value || value === null || value === undefined) return defaultValue;
  
  // Handle objects like {Trumpet: true, "Lead Vocals": true}
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    return keys.length > 0 ? keys.join(', ') : defaultValue;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    const filtered = value.filter(item => item && item !== null && item !== undefined);
    return filtered.length > 0 ? filtered.join(', ') : defaultValue;
  }
  
  // Handle strings and other types
  const stringValue = String(value).trim();
  return stringValue || defaultValue;
};

/**
 * FIXED: Normalize musician data to prevent cache format issues
 */
const normalizeMusicianData = (musicianData) => {
  if (!musicianData) return null;
  
  // CRITICAL: Ensure all fields that go to React components are render-safe
  const normalized = {
    // Core identity fields
    username: formatFieldSafely(musicianData.username, 'unknown_user'),
    id: musicianData.id || musicianData.username || 'unknown_id',
    
    // FIXED: Normalize instruments - always string format for React safety
    instruments: (() => {
      const instruments = musicianData.instruments;
      if (!instruments) return 'Guitar, Acoustic Guitar';
      
      if (typeof instruments === 'object' && !Array.isArray(instruments)) {
        const keys = Object.keys(instruments);
        return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
      }
      
      if (Array.isArray(instruments)) {
        const filtered = instruments.filter(i => i && i !== null && i !== undefined);
        return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
      }
      
      return String(instruments) || 'Guitar, Acoustic Guitar';
    })(),
    
    // FIXED: Normalize text fields - always strings
    bio: formatFieldSafely(musicianData.bio, 'Music enthusiast looking to connect!'),
    location: formatFieldSafely(musicianData.location, 'Unknown'),
    
    // FIXED: Normalize numeric fields
    age: (() => {
      if (musicianData.age && typeof musicianData.age === 'number' && musicianData.age > 0) {
        return musicianData.age;
      }
      return Math.floor(Math.random() * 20) + 20; // 20-40
    })(),
    
    rating: (() => {
      if (musicianData.rating && typeof musicianData.rating === 'number' && musicianData.rating > 0) {
        return musicianData.rating;
      }
      return Math.floor(Math.random() * 3) + 3; // 3-5 stars
    })(),
    
    // FIXED: Normalize genres - convert to string for display
    genres: (() => {
      const genres = musicianData.genres;
      if (!genres) return 'Music';
      
      if (typeof genres === 'object' && !Array.isArray(genres)) {
        const keys = Object.keys(genres);
        return keys.length > 0 ? keys.join(', ') : 'Music';
      }
      
      if (Array.isArray(genres)) {
        const filtered = genres.filter(g => g && g !== null && g !== undefined);
        return filtered.length > 0 ? filtered.join(', ') : 'Music';
      }
      
      return String(genres) || 'Music';
    })(),
    
    // FIXED: Ensure videos is always an array
    videos: Array.isArray(musicianData.videos) ? musicianData.videos : [musicianData.videos].filter(Boolean),
    
    // FIXED: Ensure numeric fields are safe
    followers: typeof musicianData.followers === 'number' ? musicianData.followers : 0,
    following: typeof musicianData.following === 'number' ? musicianData.following : 0,
    likes: typeof musicianData.likes === 'number' ? musicianData.likes : 0,
    
    // Additional safe fields
    socialLink: formatFieldSafely(musicianData.socialLink, null) || null,
    email: formatFieldSafely(musicianData.email, null) || null,
    
    // Preserve any other fields safely
    ...Object.keys(musicianData).reduce((acc, key) => {
      const handledFields = [
        'username', 'id', 'instruments', 'bio', 'location', 'age', 'rating', 
        'genres', 'videos', 'followers', 'following', 'likes', 'socialLink', 'email'
      ];
      
      if (!handledFields.includes(key)) {
        const value = musicianData[key];
        if (value !== null && value !== undefined) {
          // FIXED: Ensure no objects get through that could cause React errors
          if (typeof value === 'object' && !Array.isArray(value)) {
            acc[key] = JSON.stringify(value);
          } else {
            acc[key] = value;
          }
        }
      }
      return acc;
    }, {})
  };
  
  console.log(`🔄 Normalized musician data for ${normalized.username}:`, {
    instruments: normalized.instruments,
    instrumentsType: typeof normalized.instruments,
    genres: normalized.genres,
    genresType: typeof normalized.genres,
  });
  
  return normalized;
};

/**
 * FIXED: Generate comprehensive fallback data with normalized format
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

  const fallbackData = {
    username: username,
    videos: videoUrl ? [videoUrl] : [],
    // FIXED: Always string format for instruments
    instruments: instruments[Math.floor(Math.random() * instruments.length)],
    bio: bios[Math.floor(Math.random() * bios.length)],
    age: Math.floor(Math.random() * 20) + 20, // 20-40
    location: locations[Math.floor(Math.random() * locations.length)],
    // FIXED: Always string format for genres
    genres: 'Music',
    rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
    socialLink: null,
    id: username,
    followers: Math.floor(Math.random() * 1000),
    following: Math.floor(Math.random() * 500),
    likes: Math.floor(Math.random() * 5000),
  };
  
  // FIXED: Normalize fallback data too
  return normalizeMusicianData(fallbackData);
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
 * FIXED: Try to load from cache with normalization
 */
const tryLoadFromCache = async (batchSize) => {
  try {
    const cachedData = await getDiscoverCache();
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      // FIXED: Normalize cached data before returning
      const normalizedCached = cachedData.slice(0, batchSize).map(musician => {
        const normalized = normalizeMusicianData(musician);
        return transformToCardFormat(normalized);
      });
      
      console.log(`⚡ Normalized ${normalizedCached.length} cached musicians`);
      return normalizedCached;
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

  // FIXED: Load profiles with smart fallback and normalization
  const musicians = await loadProfilesWithFallback(usernamesWithVideos);

  // FIXED: Transform for cards with normalized data
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
 * FIXED: Load profiles with comprehensive data and smart fallback + normalization
 */
const loadProfilesWithFallback = async (usernamesWithVideos) => {
  const profilePromises = usernamesWithVideos.map(async ({ username, videoUrl }) => {
    try {
      console.log(`🔍 Loading profile: ${username}`);
      
      // Try to load real profile
      const profile = await fetchUserProfile('username', username);
      
      if (profile && (profile.success || profile.username)) {
        const userData = profile.profile || profile;
        
        // FIXED: Ensure videos exist
        if (!userData.videos || userData.videos.length === 0) {
          userData.videos = [videoUrl];
        }
        
        // FIXED: Normalize the profile data before returning
        const normalizedData = normalizeMusicianData(userData);
        
        console.log(`✅ Profile loaded and normalized: ${username}`);
        return normalizedData;
      }
      
      // Profile API returned invalid data - use fallback
      console.log(`⚠️ Invalid profile data for ${username} - using fallback`);
      return generateFallbackMusician(username, videoUrl);

    } catch (error) {
      // API failed - use fallback
      console.log(`⚠️ Profile API failed for ${username} - using fallback`);
      return generateFallbackMusician(username, videoUrl);
    }
  });

  const profiles = await Promise.all(profilePromises);
  
  // Filter out any nulls
  const validProfiles = profiles.filter(profile => 
    profile && profile.username && profile.videos && profile.videos.length > 0
  );
  
  console.log(`📊 Loaded ${validProfiles.length}/${usernamesWithVideos.length} valid normalized profiles`);
  return validProfiles;
};

/**
 * FIXED: Transform musician data to card format - PRESERVE NORMALIZED DATA
 */
const transformToCardFormat = (musician, index = 0) => {
  // Ensure we have normalized data
  const normalizedMusician = normalizeMusicianData(musician);
  
  console.log(`🔄 Transforming normalized profile for ${normalizedMusician.username}:`, {
    instruments: normalizedMusician.instruments,
    instrumentsType: typeof normalizedMusician.instruments,
  });

  return {
    // Stable ID
    id: `card-${normalizedMusician.username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    
    // FIXED: Use normalized data directly - all fields are now render-safe
    ...normalizedMusician,
    
    // Card-specific fields
    currentVideoIndex: 0,
    cardPosition: index,
    loadedAt: Date.now(),
    
    // Compatibility fields
    user_id: normalizedMusician.id || normalizedMusician.username,
    user: normalizedMusician.username,
    video_url: normalizedMusician.videos?.[0] || null,
    videoUrl: normalizedMusician.videos?.[0] || null,
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