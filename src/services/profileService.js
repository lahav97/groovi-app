import axios from 'axios';
import { createLogger } from '../utils/Logger';

const logger = createLogger('ProfileService');

const PROFILE_API_URL = 'https://lynqhqnijd.execute-api.us-east-1.amazonaws.com/groovi/load_profile';

/**
 * FIXED: Clean profile data while preserving ALL fields for MatchScreen
 */
const cleanProfileData = (profileData) => {
    if (!profileData) return null;

    // Handle the nested structure - could be profile.profile or just profile
    const rawData = profileData.profile || profileData;

    if (!rawData) return null;

    // FIXED: Clean and preserve ALL profile data
    const cleanedData = {
        username: rawData.username || '',
        email: rawData.email || '',

        // FIXED: Preserve videos properly
        videos: (() => {
            if (Array.isArray(rawData.videos)) {
                return rawData.videos.filter(v => v !== null && v !== undefined && v !== '');
            }
            return [];
        })(),

        // FIXED: Preserve instruments in original format (don't convert to array yet)
        instruments: (() => {
            if (Array.isArray(rawData.instruments)) {
                return rawData.instruments.filter(i => i !== null && i !== undefined && i !== '');
            } else if (rawData.instruments && typeof rawData.instruments === 'object') {
                // Keep as object - MatchScreen will handle conversion
                return rawData.instruments;
            } else if (rawData.instruments && typeof rawData.instruments === 'string') {
                return [rawData.instruments];
            }
            return ['Music']; // Default fallback
        })(),

        // FIXED: Preserve bio exactly as is
        bio: rawData.bio && rawData.bio !== null ? rawData.bio : 'Music enthusiast looking to connect!',

        // FIXED: Preserve age properly
        age: rawData.age && typeof rawData.age === 'number' && rawData.age > 0 ? rawData.age : null,

        // FIXED: Preserve location properly
        location: rawData.location && rawData.location !== null ? rawData.location : 'Unknown',

        // FIXED: Preserve genres properly
        genres: (() => {
            if (Array.isArray(rawData.genres)) {
                return rawData.genres.filter(g => g !== null && g !== undefined && g !== '');
            }
            return [];
        })(),

        // FIXED: Preserve rating properly
        rating: (() => {
            if (rawData.rating && typeof rawData.rating === 'number' && rawData.rating > 0) {
                return rawData.rating;
            }
            return Math.floor(Math.random() * 3) + 3; // Default 3-5 stars
        })(),

        // FIXED: Preserve social link
        socialLink: rawData.socialLink && rawData.socialLink !== null ? rawData.socialLink : null,

        // FIXED: Preserve ID
        id: rawData.id || rawData.username || '',

        // FIXED: Handle numeric fields properly
        followers: (() => {
            if (rawData.followers && typeof rawData.followers === 'number') return rawData.followers;
            if (rawData.followers && typeof rawData.followers === 'string') {
                const parsed = parseInt(rawData.followers, 10);
                return !isNaN(parsed) ? parsed : 0;
            }
            return 0;
        })(),
        following: (() => {
            if (rawData.following && typeof rawData.following === 'number') return rawData.following;
            if (rawData.following && typeof rawData.following === 'string') {
                const parsed = parseInt(rawData.following, 10);
                return !isNaN(parsed) ? parsed : 0;
            }
            return 0;
        })(),
        likes: (() => {
            if (rawData.likes && typeof rawData.likes === 'number') return rawData.likes;
            if (rawData.likes && typeof rawData.likes === 'string') {
                const parsed = parseInt(rawData.likes, 10);
                return !isNaN(parsed) ? parsed : 0;
            }
            return 0;
        })(),

        // FIXED: Preserve ALL other valid fields from the raw data
        ...Object.keys(rawData).reduce((acc, key) => {
            // Skip fields we've already handled
            const handledFields = [
                'username', 'email', 'videos', 'instruments', 'bio', 'age',
                'location', 'genres', 'rating', 'socialLink', 'id',
                'followers', 'following', 'likes'
            ];

            if (!handledFields.includes(key)) {
                const value = rawData[key];
                if (value !== null && value !== undefined && value !== '') {
                    acc[key] = value;
                }
            }
            return acc;
        }, {})
    };

    // FIXED: Log what we're returning for debugging
    logger.debug(`Profile cleaned for ${cleanedData.username}:`, {
        hasAge: !!cleanedData.age,
        hasBio: !!cleanedData.bio,
        hasRating: !!cleanedData.rating,
        hasLocation: !!cleanedData.location,
        hasInstruments: !!cleanedData.instruments,
        videosCount: cleanedData.videos?.length || 0,
        totalFields: Object.keys(cleanedData).length
    });

    return cleanedData;
};

/**
 * Fetches user profile data from the API
 */
export const fetchUserProfile = async (field, value) => {
    try {
        // CRITICAL FIX: Add parameter validation to prevent wrong field/value swapping
        if (!field || !value) {
            throw new Error('Both field and value parameters are required');
        }

        // CRITICAL FIX: Validate that field is a valid database column name
        const validFields = ['email', 'username', 'id'];
        if (!validFields.includes(field)) {
            throw new Error(`Invalid field parameter: ${field}. Must be one of: ${validFields.join(', ')}`);
        }

        // CRITICAL FIX: Log the exact parameters being sent
        logger.info(`🔍 Fetching profile with field="${field}" and value="${value}"`);

        const url = `${PROFILE_API_URL}?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        logger.info('Raw response received:', response.status);

        // FIXED: Clean the response data to handle NULL values while preserving everything
        const cleanedData = cleanProfileData(response.data);

        if (!cleanedData) {
            logger.warn('No valid profile data after cleaning');
            return null;
        }

        logger.info(`Profile cleaned and ready: ${cleanedData.username} (${Object.keys(cleanedData).length} fields)`);

        // FIXED: Return in the format expected by loadMusicianService
        return {
            success: true,
            profile: cleanedData,
            ...cleanedData // Also spread at root level for compatibility
        };

    } catch (error) {
        logger.error('Error fetching profile:', error.message);

        if (error.response) {
            logger.error('Response data:', error.response.data);
            logger.error('Response status:', error.response.status);
            logger.error('Response headers:', error.response.headers);

            if (error.response.status === 400 &&
                error.response.data?.error?.includes('JSON serializable')) {
                logger.error('Backend has NULL data causing JSON serialization error');
                throw new Error('Profile data contains invalid values. Please contact support.');
            }

            if (error.response.status === 400 &&
                error.response.data?.message?.includes('error checking')) {
                logger.error('Backend database NULL data error');
                throw new Error('Profile lookup failed due to data issues.');
            }
        } else if (error.request) {
            logger.error('No response received:', error.request);
        } else {
            logger.error('Error setting up request:', error.message);
        }

        throw error;
    }
};

/**
 * Searches for users by query
 */
export const searchUsers = async (query, limit = 20) => {
    try {
        logger.info(`Searching users: "${query}" (limit: ${limit})`);

        const response = await axios.post(`${PROFILE_API_URL}/search`, {
            query,
            limit
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Clean each profile in the search results
        if (response.data && Array.isArray(response.data)) {
            const cleanedResults = response.data
                .map(profile => cleanProfileData(profile))
                .filter(profile => profile !== null && profile.username);

            logger.info(`Search results: ${cleanedResults.length} valid profiles found`);
            return cleanedResults;
        }

        logger.info('Search completed - returning raw data');
        return response.data || [];

    } catch (error) {
        logger.error('Error searching users:', error.message);

        if (error.response) {
            logger.error('Search response data:', error.response.data);
            logger.error('Search response status:', error.response.status);

            if (error.response.status === 400 &&
                error.response.data?.error?.includes('JSON serializable')) {
                logger.error('Search failed due to NULL data in database');
                return [];
            }
        }

        throw error;
    }
};

/**
 * Get user profile by user ID (convenience wrapper)
 */
export const getProfile = async (userId) => {
    try {
        logger.info(`Getting profile for user ID: ${userId}`);

        // First, try to fetch by email (most common case for user IDs)
        try {
            const emailResult = await fetchUserProfile('email', userId);
            if (emailResult && emailResult.profile) {
                return emailResult.profile;
            }
        } catch (emailError) {
            logger.debug(`Failed to fetch by email: ${emailError.message}`);
        }

        // If email fails, try by username (in case userId is actually a username)
        try {
            const usernameResult = await fetchUserProfile('username', userId);
            if (usernameResult && usernameResult.profile) {
                return usernameResult.profile;
            }
        } catch (usernameError) {
            logger.debug(`Failed to fetch by username: ${usernameError.message}`);
        }

        // If both fail, try by user ID field (if your backend supports it)
        try {
            const idResult = await fetchUserProfile('id', userId);
            if (idResult && idResult.profile) {
                return idResult.profile;
            }
        } catch (idError) {
            logger.debug(`Failed to fetch by id: ${idError.message}`);
        }

        // If all attempts fail, throw an error
        throw new Error(`User profile not found for ID: ${userId}`);

    } catch (error) {
        logger.error(`Failed to get profile for ${userId}:`, error.message);
        throw error;
    }
};

/**
 * FIXED: Get just the username for chat purposes (lightweight version)
 */
export const getUsernameForChat = async (userEmail) => {
    try {
        // CRITICAL FIX: Move validation to the beginning of the function
        if (!userEmail || userEmail === 'undefined' || userEmail === 'null' || userEmail === undefined || userEmail === null) {
            logger.error(`Invalid userEmail parameter for getUsernameForChat: "${userEmail}"`);
            throw new Error('userEmail parameter is required and cannot be undefined, null, or string "undefined"');
        }

        logger.info(`Getting username for chat: ${userEmail}`);

        const result = await fetchUserProfile('email', userEmail);

        if (result && result.profile && result.profile.username) {
            return result.profile.username;
        } else if (result && result.username) {
            return result.username;
        }

        return null;

    } catch (error) {
        logger.error(`Failed to get username for chat: ${error.message}`);
        return null;
    }
};

export default {
    fetchUserProfile,
    searchUsers,
    getProfile,
    getUsernameForChat
};