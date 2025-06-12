import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { handleError } from '../utils/errors';

const MUSICIAN_API_URL = 'https://yflgdontu1.execute-api.us-east-1.amazonaws.com/groovi/discover';
const DELETE_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/delete';

let fetchedVideoIds = new Set();
let currentOffset = 0;
let hasReachedActualEnd = false;

/**
 * Fetches musicians with 3 distinct patterns
 * @param {string} type - 'initial' (returns 5 users) or 'filter' (returns 3 users)
 * @param {string} username - Username for musician search
 * @param {Object} filterCriteria - Filter JSON for filtered musicians (optional)
 * @param {boolean} hasFilters - Whether this is actual filtering or just "load more"
 * @returns {Promise<Array>} - Array of musician objects (5 for initial, 3 for filter)
 */
export const fetchMusicians = async (type = 'initial', username = null, filterCriteria = null, hasFilters = false) => {
  try {
    console.log(`🎯 Fetching musicians - Type: ${type}, Username: ${username}, HasFilters: ${hasFilters}`);

    if (type === 'initial') {
      let url = `${MUSICIAN_API_URL}?type=initial&username=${encodeURIComponent(username)}`;

      const response = await axios.get(url);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.log('❌ Invalid API response format');
        return [];
      }

      console.log(`✅ Initial musicians: ${response.data.length} musicians`);
      return formatMusicianResponse(response.data);
      
    } else if (type === 'filter') {
      if (hasFilters && filterCriteria && Object.keys(filterCriteria).length > 1) {
        let url = `${MUSICIAN_API_URL}?type=filter`;
        
        console.log(`📡 Filtered musicians: POST ${url}`);
        console.log(`🔍 Filter criteria:`, filterCriteria);
        
        const response = await axios.post(url, filterCriteria, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.data || !Array.isArray(response.data)) {
          console.log('❌ Invalid API response format');
          return [];
        }

        console.log(`✅ Filtered musicians: ${response.data.length} musicians`);
        return formatMusicianResponse(response.data);
        
      } else {
        let url = `${MUSICIAN_API_URL}?type=filter&username=${encodeURIComponent(username)}`;
        
        console.log(`📡 Load more musicians (no filters)`);
        const response = await axios.get(url);
        
        if (!response.data || !Array.isArray(response.data)) {
          console.log('❌ Invalid API response format');
          return [];
        }

        console.log(`✅ Load more musicians: ${response.data.length} musicians`);
        return formatMusicianResponse(response.data);
      }
    }

  } catch (error) {
    console.error('❌ Error fetching musicians:', handleError(error, 'videoService/fetchMusicians'));
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return [];
  }
};

/**
 * Helper function to transform API response to expected format
 * @param {Array} apiData - Raw data from API
 * @returns {Array} - Transformed musician objects
 */
const formatMusicianResponse = (apiData) => {
  const musicians = apiData.map(musician => ({
    id: musician.id,
    username: musician.username,
    videos: [musician.video_url],
    instruments: musician.instruments || [],
    bio: `Music enthusiast playing ${(musician.instruments || []).slice(0, 2).join(', ')}`,
    location: 'Unknown',
    genres: [],
    age: null,
    rating: Math.floor(Math.random() * 5) + 1,
  }));

  return musicians;
};

/**
 * @param {number} offset - The starting index for fetching videos
 * @param {number} limit - How many videos to fetch
 * @returns {Promise<Array>} - Array of unique video objects
 */
export const fetchVideos = async (offset = 0, limit = 5) => {
  try {
    if (offset === 0) {
      fetchedVideoIds.clear();
      console.log('🔄 Reset video state tracking');
    }

    const musicians = await fetchMusicians('initial', 'default_user');
    
    const videos = musicians.map(musician => ({
      id: musician.id,
      user_id: musician.id,
      username: musician.username,
      user: musician.username,
      video_url: musician.videos[0],
      videoUrl: musician.videos[0],
      instruments: musician.instruments,
    }));

    console.log(`🎯 Returning ${videos.length} videos from musician API`);
    return videos;

  } catch (error) {
    console.error('❌ Error fetching videos:', handleError(error, 'videoService/fetchVideos'));
    return [];
  }
};

/**
 * Apply filters to discovery (with actual filters)
 * @param {string} username - Username applying filters
 * @param {Object} filters - Filter object with genres, instruments, location, etc.
 * @returns {Promise<Array>} - Filtered musicians (3 results)
 */
export const fetchFilteredMusicians = async (username, filters = {}) => {
  try {
    console.log(`🔍 Applying filters for ${username}:`, filters);

    const filterCriteria = {
      username: username,
      ...filters
    };

    const hasActualFilters = Object.keys(filters).length > 0;
    
    return await fetchMusicians('filter', username, filterCriteria, hasActualFilters);
  } catch (error) {
    console.error('❌ Error applying filters:', error);
    return [];
  }
};

/**
 * Load more musicians without filters
 * @param {string} username - Username for discovery
 * @returns {Promise<Array>} - 3 random musicians
 */
export const loadMusicianWithoutFilters = async (username) => {
  try {
    console.log(`🔄 Loading more musicians (no filters) for ${username}`);
    
    return await fetchMusicians('filter', username, { username }, false);
  } catch (error) {
    console.error('❌ Error loading more musicians:', error);
    return [];
  }
};

/**
 * Get initial musicians for a user
 * @param {string} username - Username to get discovery for
 * @returns {Promise<Array>} - Initial discovery musicians
 */
export const fetchInitialMusicians = async (username) => {
  try {
    console.log(`🚀 Getting initial musicians for ${username}`);
    return await fetchMusicians('initial', username);
  } catch (error) {
    console.error('❌ Error getting initial musicians:', error);
    return [];
  }
};

/**
 * Validates a video file for upload
 * @param {Object} videoAsset - The video asset from ImagePicker
 * @param {Object} options - Validation options (maxSizeMB, maxDurationSec)
 * @returns {Promise<Object>} - Validation result with success/error
 */
export const validateVideoFile = async (videoAsset, options = {}) => {
  try {
    const {
      maxSizeMB = 20,
      maxDurationSec = 45
    } = options;

    const fileInfo = await FileSystem.getInfoAsync(videoAsset.uri, { size: true });
    const sizeBytes = fileInfo?.size || 0;
    const sizeMB = sizeBytes / (1024 * 1024);

    let durationSec = videoAsset?.duration || 0;
    
    if (durationSec > 100) {
      durationSec = durationSec / 1000;
    }

    console.log(`📊 Video validation - Size: ${sizeMB.toFixed(2)}MB, Duration: ${durationSec.toFixed(1)}s`);

    if (sizeMB > maxSizeMB) {
      return {
        success: false,
        error: `Video too large: ${sizeMB.toFixed(2)}MB. Maximum allowed: ${maxSizeMB}MB.`
      };
    }

    if (durationSec > maxDurationSec) {
      return {
        success: false,
        error: `Video too long: ${durationSec.toFixed(1)} seconds. Maximum allowed: ${maxDurationSec} seconds.`
      };
    }

    return {
      success: true,
      fileInfo: {
        sizeBytes,
        sizeMB,
        durationSec
      }
    };

  } catch (error) {
    console.error('❌ Error validating video:', error);
    return {
      success: false,
      error: 'Failed to validate video file.'
    };
  }
};

/**
 * Creates a unique key for video duplicate checking
 * @param {string} fileName - Video file name
 * @param {number} size - Video file size in bytes
 * @param {number} duration - Video duration in seconds
 * @returns {string} - Unique video key
 */
export const createVideoKey = (fileName, size, duration) => {
  return `${fileName}_${size}_${Math.round(duration * 10)}`;
};

/**
 * Checks if a video is a duplicate
 * @param {Object} videoAsset - The video asset from ImagePicker
 * @param {Set} existingKeys - Set of existing video keys
 * @param {Object} validationOptions - Options for validation
 * @returns {Promise<Object>} - Duplicate check result
 */
export const checkVideoDuplicate = async (videoAsset, existingKeys, validationOptions = {}) => {
  try {
    const validation = await validateVideoFile(videoAsset, validationOptions);
    
    if (!validation.success) {
      return {
        isDuplicate: false,
        videoKey: null,
        error: validation.error
      };
    }

    const fileName = videoAsset.fileName || `video_${Date.now()}.mp4`;
    const videoKey = createVideoKey(fileName, validation.fileInfo.sizeBytes, validation.fileInfo.durationSec);

    const isDuplicate = existingKeys.has(videoKey);

    return {
      isDuplicate,
      videoKey,
      error: null
    };

  } catch (error) {
    console.error('❌ Error checking video duplicate:', error);
    return {
      isDuplicate: false,
      videoKey: null,
      error: 'Failed to check for duplicates.'
    };
  }
};

/**
 * Generates a thumbnail for a video
 * @param {string} videoUri - The video URI
 * @param {number} timeMs - Time in milliseconds to capture thumbnail (default: 100ms)
 * @returns {Promise<Object>} - Thumbnail generation result
 */
export const generateVideoThumbnail = async (videoUri, timeMs = 100) => {
  try {
    const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
      videoUri,
      { time: timeMs }
    );

    return {
      success: true,
      thumbnailUri
    };

  } catch (error) {
    console.error('❌ Error generating thumbnail:', error);
    return {
      success: false,
      thumbnailUri: videoUri + "#t=0.1",
      error: 'Failed to generate thumbnail'
    };
  }
};

/**
 * Processes a selected video asset and prepares it for upload
 * @param {Object} selectedAsset - The video asset from ImagePicker
 * @param {Set} existingKeys - Set of existing video keys for duplicate checking
 * @param {Object} options - Processing options (validation limits, etc.)
 * @returns {Promise<Object>} - Processed video data or error
 */
export const processVideoAsset = async (selectedAsset, existingKeys, options = {}) => {
  try {
    console.log(`🎬 Processing video: ${selectedAsset.fileName}`);

    const duplicateCheck = await checkVideoDuplicate(selectedAsset, existingKeys, options);
    
    if (duplicateCheck.error) {
      return { success: false, error: duplicateCheck.error };
    }

    if (duplicateCheck.isDuplicate) {
      return { 
        success: false, 
        error: 'You have already added this video.',
        isDuplicate: true 
      };
    }

    const validation = await validateVideoFile(selectedAsset, options);
    
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const thumbnailResult = await generateVideoThumbnail(selectedAsset.uri);

    const videoData = {
      id: selectedAsset.assetId || Date.now().toString() + Math.random(),
      uri: selectedAsset.uri,
      fileName: selectedAsset.fileName || `video_${Date.now()}.mp4`,
      mimeType: selectedAsset.mimeType || 'video/mp4',
      duration: validation.fileInfo.durationSec,
      size: validation.fileInfo.sizeBytes,
      thumbnail: thumbnailResult.thumbnailUri,
    };

    console.log(`✅ Video processed successfully:`, {
      fileName: videoData.fileName,
      size: `${(videoData.size / (1024 * 1024)).toFixed(2)}MB`,
      duration: `${videoData.duration}s`
    });

    return {
      success: true,
      videoData,
      videoKey: duplicateCheck.videoKey
    };

  } catch (error) {
    console.error('❌ Error processing video asset:', error);
    return {
      success: false,
      error: 'Failed to process video.'
    };
  }
};

/**
 * Processes multiple video assets
 * @param {Array} videoAssets - Array of video assets from ImagePicker
 * @param {Set} existingKeys - Set of existing video keys
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback (current, total, videoData)
 * @returns {Promise<Object>} - Batch processing result
 */
export const processBatchVideos = async (videoAssets, existingKeys, options = {}, onProgress = null) => {
  try {
    console.log(`🎬 Processing ${videoAssets.length} videos...`);

    const processedVideos = [];
    const videoKeys = new Set(existingKeys);
    const errors = [];

    for (let i = 0; i < videoAssets.length; i++) {
      const asset = videoAssets[i];
      
      if (onProgress) {
        onProgress({ current: i + 1, total: videoAssets.length, stage: 'processing', asset });
      }

      const result = await processVideoAsset(asset, videoKeys, options);
      
      if (result.success) {
        processedVideos.push(result.videoData);
        videoKeys.add(result.videoKey);
      } else {
        errors.push({
          asset,
          error: result.error,
          isDuplicate: result.isDuplicate
        });
      }
    }

    console.log(`✅ Batch processing complete: ${processedVideos.length} successful, ${errors.length} errors`);

    return {
      success: true,
      processedVideos,
      videoKeys,
      errors,
      stats: {
        total: videoAssets.length,
        processed: processedVideos.length,
        errors: errors.length
      }
    };

  } catch (error) {
    console.error('❌ Error in batch video processing:', error);
    return {
      success: false,
      error: 'Failed to process videos.',
      processedVideos: [],
      errors: []
    };
  }
};

/**
 * Deletes a video from S3
 * @param {string} fileName - The file name to delete
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteVideoFromS3 = async (fileName) => {
  try {
    console.log(`🗑️ Deleting video from S3: ${fileName}`);
    
    const deleteUrl = `${DELETE_API_URL}?filename=${encodeURIComponent(fileName)}`;
    const response = await axios.delete(deleteUrl);

    if (response.status === 200) {
      console.log(`✅ Video ${fileName} deleted successfully from S3`);
      return {
        success: true,
        message: `Video ${fileName} deleted successfully`
      };
    } else {
      console.error(`❌ Failed to delete video ${fileName}:`, response.data);
      return {
        success: false,
        error: `Failed to delete video: ${response.status}`
      };
    }

  } catch (error) {
    console.error(`❌ Error deleting video ${fileName}:`, error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete video'
    };
  }
};

/**
 * Manages video array operations (add, remove, move)
 * @param {Array} videos - Current videos array
 * @param {Array} thumbnails - Current thumbnails array
 * @param {Array} urls - Current URLs array (optional)
 * @param {Array} statuses - Current statuses array (optional)
 * @returns {Object} - Video management utilities
 */
export const createVideoManager = (videos, thumbnails, urls = [], statuses = []) => {
  return {
    moveVideo: (fromIndex, toIndex) => {
      if (toIndex < 0 || toIndex >= videos.length || fromIndex === toIndex) {
        return { videos, thumbnails, urls, statuses };
      }
      
      const moveArray = (arr) => {
        const newArr = [...arr];
        const [movedItem] = newArr.splice(fromIndex, 1);
        newArr.splice(toIndex, 0, movedItem);
        return newArr;
      };

      return {
        videos: moveArray(videos),
        thumbnails: moveArray(thumbnails),
        urls: moveArray(urls),
        statuses: moveArray(statuses)
      };
    },

    removeVideo: (index) => {
      return {
        videos: videos.filter((_, i) => i !== index),
        thumbnails: thumbnails.filter((_, i) => i !== index),
        urls: urls.filter((_, i) => i !== index),
        statuses: statuses.filter((_, i) => i !== index)
      };
    },

    addVideo: (videoData, thumbnail, url = null, status = null) => {
      return {
        videos: [...videos, videoData],
        thumbnails: [...thumbnails, thumbnail],
        urls: url ? [...urls, url] : urls,
        statuses: status ? [...statuses, status] : statuses
      };
    },

    updateVideo: (index, updates) => {
      const newVideos = [...videos];
      const newThumbnails = [...thumbnails];
      const newUrls = [...urls];
      const newStatuses = [...statuses];

      if (updates.videoData) newVideos[index] = updates.videoData;
      if (updates.thumbnail) newThumbnails[index] = updates.thumbnail;
      if (updates.url) newUrls[index] = updates.url;
      if (updates.status) newStatuses[index] = updates.status;

      return {
        videos: newVideos,
        thumbnails: newThumbnails,
        urls: newUrls,
        statuses: newStatuses
      };
    }
  };
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
};

/**
 * Force reset has more videos flag
 */
export const forceResetHasMoreVideos = () => {
  hasReachedActualEnd = false;
  console.log('🔁 Force reset hasReachedActualEnd');
};     