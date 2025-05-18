import axios from 'axios';

const PROFILE_API_URL = 'https://lynqhqnijd.execute-api.us-east-1.amazonaws.com/groovi/load_profile';

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
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Received response:', response.status);
    return response.data;
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    
    // Log more detailed error information for debugging
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
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
    const response = await axios.post(`${PROFILE_API_URL}/search`, {
      query,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('Error searching users:', error.message);
    throw error;
  }
};

export default {
  fetchUserProfile,
  searchUsers
};