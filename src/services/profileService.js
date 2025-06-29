import axios from 'axios';

const PROFILE_API_URL = 'https://lynqhqnijd.execute-api.us-east-1.amazonaws.com/groovi/load_profile';

/**
 * Clean profile data by filling NULL values with defaults
 * @param {Object} profileData - Raw profile data from API
 * @returns {Object} - Cleaned profile data
 */
const cleanProfileData = (profileData) => {
  if (!profileData) return null;

  // Handle the nested structure - could be profile.profile or just profile
  const rawData = profileData.profile || profileData;
  
  if (!rawData) return null;

  // Clean and fill NULL values with appropriate defaults
  const cleanedData = {
    username: rawData.username || '',
    email: rawData.email || '',
    videos: (() => {
      if (Array.isArray(rawData.videos)) {
        return rawData.videos.filter(v => v !== null && v !== undefined && v !== '');
      }
      return [];
    })(),
    instruments: (() => {
      if (Array.isArray(rawData.instruments)) {
        return rawData.instruments.filter(i => i !== null && i !== undefined && i !== '');
      } else if (rawData.instruments && typeof rawData.instruments === 'object') {
        return Object.keys(rawData.instruments).filter(key => 
          rawData.instruments[key] !== null && 
          rawData.instruments[key] !== undefined &&
          rawData.instruments[key] !== ''
        );
      } else if (rawData.instruments && typeof rawData.instruments === 'string') {
        return [rawData.instruments];
      }
      return ['Music']; // Default fallback
    })(),
    bio: rawData.bio && rawData.bio !== null ? rawData.bio : 'Music enthusiast looking to connect!',
    age: rawData.age && typeof rawData.age === 'number' && rawData.age > 0 ? rawData.age : null,
    location: rawData.location && rawData.location !== null ? rawData.location : 'Unknown',
    genres: (() => {
      if (Array.isArray(rawData.genres)) {
        return rawData.genres.filter(g => g !== null && g !== undefined && g !== '');
      }
      return [];
    })(),
    rating: (() => {
      if (rawData.rating && typeof rawData.rating === 'number' && rawData.rating > 0) {
        return rawData.rating;
      }
      return Math.floor(Math.random() * 3) + 3; // Default 3-5 stars
    })(),
    socialLink: rawData.socialLink && rawData.socialLink !== null ? rawData.socialLink : null,
    id: rawData.id || rawData.username || '',
    
    // Handle numeric fields that might be Decimal objects or NULL
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
    
    // Copy any other valid fields while filtering out nulls
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

  return cleanedData;
};

/**
 * Fetches user profile data from the API
 * @param {string} field - The field to search by ('email' or 'username')
 * @param {string} value - The value to search for
 * @returns {Promise<Object>} - User profile data
 */
export const fetchUserProfile = async (field, value) => {
  try {
    // Build the URL with query parameters
    const url = `${PROFILE_API_URL}?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;
    
    console.log(`🔍 Fetching profile: ${field}=${value}`);
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Raw response received:', response.status);
    
    // Clean the response data to handle NULL values
    const cleanedData = cleanProfileData(response.data);
    
    if (!cleanedData) {
      console.warn('⚠️ No valid profile data after cleaning');
      return null;
    }
    
    console.log(`✅ Profile cleaned and ready: ${cleanedData.username}`);
    
    // Return in the format expected by loadMusicianService
    return {
      success: true,
      profile: cleanedData,
      ...cleanedData // Also spread at root level for compatibility
    };
    
  } catch (error) {
    console.error('❌ Error fetching profile:', error.message);
    
    // Log more detailed error information for debugging
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      // Handle specific JSON serialization errors
      if (error.response.status === 400 && 
          error.response.data?.error?.includes('JSON serializable')) {
        console.error('❌ Backend has NULL data causing JSON serialization error');
        throw new Error('Profile data contains invalid values. Please contact support.');
      }
      
      // Handle other 400 errors that might be NULL-related
      if (error.response.status === 400 && 
          error.response.data?.message?.includes('error checking')) {
        console.error('❌ Backend database NULL data error');
        throw new Error('Profile lookup failed due to data issues.');
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    throw error;
  }
};

/**
 * Searches for users by query
 * @param {string} query - The search query 
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching user profiles
 */
export const searchUsers = async (query, limit = 20) => {
  try {
    console.log(`🔍 Searching users: "${query}" (limit: ${limit})`);
    
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
      
      console.log(`✅ Search results: ${cleanedResults.length} valid profiles found`);
      return cleanedResults;
    }
    
    console.log('✅ Search completed - returning raw data');
    return response.data || [];
    
  } catch (error) {
    console.error('❌ Error searching users:', error.message);
    
    if (error.response) {
      console.error('Search response data:', error.response.data);
      console.error('Search response status:', error.response.status);
      
      // Handle NULL data errors in search
      if (error.response.status === 400 && 
          error.response.data?.error?.includes('JSON serializable')) {
        console.error('❌ Search failed due to NULL data in database');
        return []; // Return empty array instead of throwing
      }
    }
    
    throw error;
  }
};

export default {
  fetchUserProfile,
  searchUsers
};