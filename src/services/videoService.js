import axios from 'axios';

const FEED_API_URL = 'https://ioeunedt82.execute-api.us-east-1.amazonaws.com/groovi/load_feed';

/**
 * Fetches random videos for the feed
 * @returns {Promise<Array>} - Array of video objects
 */
export const fetchVideos = async (lastId = null) => {
  try {
    // Add any required parameters to the API call
    const response = await axios.get(FEED_API_URL, {
      params: {
        limit: 10,
        lastId: lastId
      }
    });
    
    console.log(`Fetched ${response.data.length} videos for feed`);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching videos:', error);
    
    return [];
  }
};