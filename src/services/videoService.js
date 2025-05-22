import axios from 'axios';

const FEED_API_URL = 'https://ioeunedt82.execute-api.us-east-1.amazonaws.com/groovi/load_feed';

// Keep track of video IDs we've already fetched to avoid duplicates
let fetchedVideoIds = new Set();
let currentOffset = 0;

/**
 * Fetches videos for the feed with proper pagination
 * @param {number} page - Page number (0, 1, 2, ...)
 * @param {number} requestedLimit - How many videos we want
 * @returns {Promise<Array>} - Array of unique video objects
 */
export const fetchVideos = async (page = 0, requestedLimit = 5) => {
  try {
    console.log(`📡 Fetching videos - page: ${page}, requested: ${requestedLimit}`);
    
    // For initial load, reset our tracking
    if (page === 0) {
      fetchedVideoIds.clear();
      currentOffset = 0;
      console.log('🔄 Reset pagination tracking');
    }
    
    // We'll fetch up to 3 times to get enough unique videos
    let attempts = 0;
    let uniqueVideos = [];
    
    while (uniqueVideos.length < requestedLimit && attempts < 3) {
      attempts++;
      
      // Calculate lastId for cursor pagination
      // Use currentOffset to simulate pagination
      const lastId = currentOffset > 0 ? currentOffset : null;
      
      console.log(`📡 API call ${attempts}, lastId: ${lastId}, offset: ${currentOffset}`);
      
      const response = await axios.get(FEED_API_URL, {
        params: {
          limit: 10, // Always fetch 10 from API
          lastId: lastId
        }
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        console.log('❌ Invalid API response format');
        break;
      }
      
      console.log(`✅ API returned ${response.data.length} videos`);
      
      // Filter out videos we've already seen
      const newVideos = response.data.filter(video => {
        const videoId = video.id || video.user_id || video.video_url;
        return videoId && !fetchedVideoIds.has(videoId);
      });
      
      console.log(`🔍 Found ${newVideos.length} new unique videos`);
      
      // Add new videos to our collection
      newVideos.forEach(video => {
        const videoId = video.id || video.user_id || video.video_url;
        if (videoId) {
          fetchedVideoIds.add(videoId);
          uniqueVideos.push(video);
        }
      });
      
      // Update offset for next API call
      currentOffset += response.data.length;
      
      // If API returned fewer than 10 videos, we've reached the end
      if (response.data.length < 10) {
        console.log('🏁 Reached end of available videos');
        break;
      }
      
      // If we got no new videos, try a different offset
      if (newVideos.length === 0) {
        currentOffset += 5; // Skip ahead a bit
        console.log(`⏭️ No new videos, skipping to offset ${currentOffset}`);
      }
    }
    
    // Return only the requested number of videos
    const result = uniqueVideos.slice(0, requestedLimit);
    console.log(`🎯 Returning ${result.length} unique videos`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error fetching videos:', error);
    return [];
  }
};

/**
 * Reset the video fetching state (useful for refresh)
 */
export const resetVideoState = () => {
  fetchedVideoIds.clear();
  currentOffset = 0;
  console.log('🔄 Video state reset');
};