import axios from 'axios';

const FEED_API_URL = 'https://ioeunedt82.execute-api.us-east-1.amazonaws.com/groovi/load_feed';

// Keep track of video IDs we've already fetched to avoid duplicates
let fetchedVideoIds = new Set();
let currentOffset = 0;
let hasReachedActualEnd = false; // Track if we've truly reached the end

/**
 * Fetches videos for the feed with pagination
 * @param {number} offset - The starting index for fetching videos
 * @param {number} limit - How many videos to fetch
 * @returns {Promise<Array>} - Array of unique video objects
 */
export const fetchVideos = async (offset = 0, limit = 5) => {
  try {
    console.log(`📡 Fetching videos - offset: ${offset}, limit: ${limit}`);

    // Reset tracking only if starting from offset 0 (initial load)
    if (offset === 0) {
      fetchedVideoIds.clear();
      console.log('🔄 Reset video state tracking');
    }

    const response = await axios.get(FEED_API_URL, {
      params: {
        limit: limit,
        // The backend uses lastId, so if offset is 0, we don't pass lastId.
        // Otherwise, we pass the offset as lastId to get videos after that point.
        lastId: offset > 0 ? offset : null,
      }
    });

    // Add debug logs for API response and filtering
    console.log('API returned video IDs:', response.data.map(v => v.id || v.user_id || v.video_url));
    console.log('Already fetched IDs:', Array.from(fetchedVideoIds));

    if (!response.data || !Array.isArray(response.data)) {
      console.log('❌ Invalid API response format');
      // If API returns invalid format, consider it as end of data for this call
      return [];
    }

    console.log(`✅ API returned ${response.data.length} videos`);

    // If API returns 0 videos, we've reached the actual end
    if (response.data.length === 0) {
      console.log('🏁 API returned 0 videos - reached actual end for this offset');
      hasReachedActualEnd = true;
      return [];
    }

    // Filter out videos we've already seen across all fetch calls
    const uniqueVideos = response.data.filter(video => {
      const videoId = video.id || video.user_id || video.video_url;
    
      // If we've never seen it, keep it
      if (!fetchedVideoIds.has(videoId)) return true;
    
      // If we've seen it, keep it with a low chance (10%)
      const allowRepeat = Math.random() < 0.1;
      return allowRepeat;
    });
    

    // Add new unique videos to our tracking set
    uniqueVideos.forEach(video => {
      const videoId = video.id || video.user_id || video.video_url;
      if (videoId) {
        fetchedVideoIds.add(videoId);
      }
    });

    console.log(`🎯 Returning ${uniqueVideos.length} unique videos after filtering`);
    console.log(`📊 Total unique videos fetched across all calls: ${fetchedVideoIds.size}`);

    return uniqueVideos;

  } catch (error) {
    console.error('❌ Error fetching videos:', error);
    return [];
  }
};

/**
 * Check if we have more videos available
 * @returns {boolean} True if more videos might be available
 */
export const hasMoreVideos = () => {
  return !hasReachedActualEnd;
};

/**
 * Get current pagination stats
 * @returns {Object} Current pagination information
 */
export const getPaginationStats = () => {
  return {
    totalFetched: fetchedVideoIds.size,
    currentOffset,
    hasReachedEnd: hasReachedActualEnd
  };
};

/**
 * Reset the video fetching state (useful for refresh)
 */
export const resetVideoState = () => {
  fetchedVideoIds.clear();
  currentOffset = 0;
  hasReachedActualEnd = false;
  console.log('🔄 Video state reset');
};

export const forceResetHasMoreVideos = () => {
  hasReachedActualEnd = false;
  console.log('🔁 Force reset hasReachedActualEnd');
};
