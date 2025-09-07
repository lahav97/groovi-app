/**
 * loadMusicianService.js - Musician data loading and normalization service
 * Ensures all profile data is normalized and cache-safe before storage
 * Prevents object rendering errors by normalizing data formats
 * Properly handles profile pictures throughout the data flow
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
 * Safe field formatter to prevent object rendering errors
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
 * Normalize musician data to prevent cache format issues + INCLUDE PROFILE PICTURES
 */
const normalizeMusicianData = (musicianData) => {
    if (!musicianData) return null;

    // CRITICAL: Ensure all fields that go to React components are render-safe
    const normalized = {
        // Core identity fields
        username: formatFieldSafely(musicianData.username, 'unknown_user'),
        id: musicianData.id || musicianData.username || 'unknown_id',

        // ADD PROFILE PICTURE HANDLING - This was missing!
        profile_picture: (() => {
            const profilePic = musicianData.profile_picture || musicianData.profilePicture;
            if (profilePic && typeof profilePic === 'string' && profilePic.startsWith('http')) {
                console.log(`🖼️ Profile picture found for ${musicianData.username}: ${profilePic}`);
                return profilePic;
            }
            console.log(`❌ No valid profile picture for ${musicianData.username}, using fallback`);
            return 'https://via.placeholder.com/50';
        })(),

        // Normalize instruments - always string format for React safety
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

        // Normalize text fields - always strings
        bio: formatFieldSafely(musicianData.bio, 'Music enthusiast looking to connect!'),
        location: formatFieldSafely(musicianData.location, 'Unknown'),

        // Normalize numeric fields
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

        // Normalize genres - convert to string for display
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

        // Ensure videos is always an array
        videos: Array.isArray(musicianData.videos) ? musicianData.videos : [musicianData.videos].filter(Boolean),

        // Ensure numeric fields are safe
        followers: typeof musicianData.followers === 'number' ? musicianData.followers : 0,
        following: typeof musicianData.following === 'number' ? musicianData.following : 0,
        likes: typeof musicianData.likes === 'number' ? musicianData.likes : 0,

        // Additional safe fields
        socialLink: formatFieldSafely(musicianData.socialLink, null) || null,
        email: formatFieldSafely(musicianData.email, null) || null,

        // Preserve any other fields safely
        ...Object.keys(musicianData).reduce((acc, key) => {
            const handledFields = [
                'username', 'id', 'profile_picture', 'profilePicture', 'instruments', 'bio', 'location', 'age', 'rating',
                'genres', 'videos', 'followers', 'following', 'likes', 'socialLink', 'email'
            ];

            if (!handledFields.includes(key)) {
                const value = musicianData[key];
                if (value !== null && value !== undefined) {
                    // Ensure no objects get through that could cause React errors
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

    console.log(`🔧 Normalized musician data for ${normalized.username}:`, {
        profile_picture: normalized.profile_picture,
        instruments: normalized.instruments,
        instrumentsType: typeof normalized.instruments,
        genres: normalized.genres,
        genresType: typeof normalized.genres,
    });

    return normalized;
};

/**
 * Generate comprehensive fallback data with normalized format + PROFILE PICTURE
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
        // Always string format for instruments
        instruments: instruments[Math.floor(Math.random() * instruments.length)],
        bio: bios[Math.floor(Math.random() * bios.length)],
        age: Math.floor(Math.random() * 20) + 20, // 20-40
        location: locations[Math.floor(Math.random() * locations.length)],
        // Always string format for genres
        genres: 'Music',
        rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
        // ADD PROFILE PICTURE FALLBACK
        profile_picture: 'https://via.placeholder.com/50',
        socialLink: null,
        id: username,
        followers: Math.floor(Math.random() * 1000),
        following: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 5000),
    };

    // Normalize fallback data too
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
export const loadMoreMusicians = async (username, batchSize = MUSICIAN_LOAD_CONFIG.LOAD_MORE_BATCH_SIZE) => {
    console.log(`🔄 Loading ${batchSize} more musicians for ${username}`);

    try {
        const moreMusicians = await loadFreshMusicians(username, batchSize);

        console.log(`✅ Successfully loaded ${moreMusicians.length} more musicians`);
        return moreMusicians; // Return just the new musicians, let DiscoverScreen handle combining

    } catch (error) {
        console.error('❌ loadMoreMusicians error:', error);
        return []; // Always return array, never number
    }
};

/**
 * Load more musicians with filters
 */
export const loadMoreMusiciansWithFilters = async (username, filters = {}, batchSize = MUSICIAN_LOAD_CONFIG.LOAD_MORE_BATCH_SIZE) => {
    console.log(`🔄 Loading ${batchSize} more filtered musicians for ${username}`);

    try {
        // For now, use the same logic as regular loading
        // TODO: Implement actual filtering logic when ready
        const moreMusicians = await loadFreshMusicians(username, batchSize);

        console.log(`✅ Successfully loaded ${moreMusicians.length} more filtered musicians`);
        return moreMusicians;

    } catch (error) {
        console.error('❌ loadMoreMusiciansWithFilters error:', error);
        return []; // Always return array, never number
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
 * Try to load from cache with normalization and profile picture preservation
 */
const tryLoadFromCache = async (batchSize) => {
    try {
        const cachedData = await getDiscoverCache();
        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
            // Normalize cached data before returning
            const normalizedCached = cachedData.slice(0, batchSize).map(musician => {
                const normalized = normalizeMusicianData(musician);
                return transformToCardFormat(normalized);
            });

            console.log(`⚡ Normalized ${normalizedCached.length} cached musicians with profile pictures`);
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
    // Get videos first, excluding current user
    const videosNeeded = batchSize * MUSICIAN_LOAD_CONFIG.VIDEO_FETCH_MULTIPLIER;
    const videos = await fetchVideos(videoPageOffset, videosNeeded, username); // Pass username to exclude current user

    if (!videos || videos.length === 0) {
        console.log('❌ No videos found from API');
        return [];
    }

    console.log(`📹 Fetched ${videos.length} videos`);

    // Filter out current user's videos as additional safety
    const filteredVideos = videos.filter(video => {
        const videoUsername = video.username || video.user;
        return videoUsername && videoUsername !== username;
    });

    if (filteredVideos.length === 0) {
        console.log('❌ No videos found after filtering current user');
        return [];
    }

    // Extract unique usernames
    const usernamesWithVideos = extractUsernamesWithVideos(filteredVideos, batchSize);

    if (usernamesWithVideos.length === 0) {
        console.log('⚠️ No new unique usernames found');
        videoPageOffset += 1;
        return [];
    }

    console.log(`👥 Found ${usernamesWithVideos.length} users with videos`);

    // Load profiles with smart fallback and normalization
    const musicians = await loadProfilesWithFallback(usernamesWithVideos);

    // Transform for cards with normalized data
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
 * Load profiles with comprehensive data and smart fallback + normalization + profile pictures
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

                // DEBUG: Log profile picture data from API
                console.log(`🖼️ API Profile picture for ${username}:`, userData.profile_picture || userData.profilePicture);

                // Normalize the profile data before returning
                const normalizedData = normalizeMusicianData(userData);

                console.log(`✅ Profile loaded and normalized: ${username}`, {
                    profile_picture: normalizedData.profile_picture
                });
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

    console.log(`📊 Loaded ${validProfiles.length}/${usernamesWithVideos.length} valid normalized profiles with profile pictures`);
    return validProfiles;
};

/**
 * Transform musician data to card format - PRESERVE NORMALIZED DATA + PROFILE PICTURES
 */
const transformToCardFormat = (musician, index = 0) => {
    // Ensure we have normalized data
    const normalizedMusician = normalizeMusicianData(musician);

    console.log(`🔧 Transforming normalized profile for ${normalizedMusician.username}:`, {
        profile_picture: normalizedMusician.profile_picture,
        instruments: normalizedMusician.instruments,
        instrumentsType: typeof normalizedMusician.instruments,
    });

    return {
        // Stable ID
        id: `card-${normalizedMusician.username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

        // Use normalized data directly - all fields are now render-safe
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
                console.log(`💾 Cached ${musicians.length} musicians with profile pictures`);
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
    loadMoreMusiciansWithFilters,
    resetMusicianService,
    getMusicianServiceStats,
    hasMoreMusicians,
};