import axios from 'axios';

const API_URL = 'https://ioeunedt82.execute-api.us-east-1.amazonaws.com/groovi/load_feed';

export const fetchVideos = async (lastVideoId = null) => {
  try {
    // Construct the API endpoint with query parameters
    let url = API_URL;
    if (lastVideoId) {
      url += `?lastId=${lastVideoId}`;
    }
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
};