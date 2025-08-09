import axios from 'axios';

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
  console.log(`🧼 Profile cleaned for ${cleanedData.username}:`, {
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
    const url = `${PROFILE_API_URL}?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;
    
    console.log(`🔍 Fetching profile: ${field}=${value}`);
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Raw response received:', response.status);
    
    // FIXED: Clean the response data to handle NULL values while preserving everything
    const cleanedData = cleanProfileData(response.data);
    
    if (!cleanedData) {
      console.warn('⚠️ No valid profile data after cleaning');
      return null;
    }
    
    console.log(`✅ Profile cleaned and ready: ${cleanedData.username} (${Object.keys(cleanedData).length} fields)`);
    
    // FIXED: Return in the format expected by loadMusicianService
    return {
      success: true,
      profile: cleanedData,
      ...cleanedData // Also spread at root level for compatibility
    };
    
  } catch (error) {
    console.error('❌ Error fetching profile:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      if (error.response.status === 400 && 
          error.response.data?.error?.includes('JSON serializable')) {
        console.error('❌ Backend has NULL data causing JSON serialization error');
        throw new Error('Profile data contains invalid values. Please contact support.');
      }
      
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
      
      if (error.response.status === 400 && 
          error.response.data?.error?.includes('JSON serializable')) {
        console.error('❌ Search failed due to NULL data in database');
        return [];
      }
    }
    
    throw error;
  }
};

export default {
  fetchUserProfile,
  searchUsers
};