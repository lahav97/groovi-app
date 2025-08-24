import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { handleError } from '../utils/errors';

const MUSICIAN_API_URL = 'https://yflgdontu1.execute-api.us-east-1.amazonaws.com/groovi/discover'; // For DiscoverScreen
const MATCH_API_URL = 'https://g25kk1qcgi.execute-api.us-east-1.amazonaws.com/groovi/match'; // For MatchScreen
const DELETE_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/delete';

// ✅ ADD THIS HERE - AFTER THE API URLS, BEFORE OTHER VARIABLES
const INSTRUMENT_VARIATIONS = {
    // Bass variations
    'Bass': ['Bass', 'Bass guitar', 'Electric bass', 'Acoustic bass', 'Upright bass', 'Double bass', 'Bass guitar electric', 'Bass guitar acoustic'],

    // Guitar variations
    'Guitar': ['Guitar', 'Electric guitar', 'Acoustic guitar', 'Classical guitar', 'Guitar electric', 'Guitar acoustic', 'Guitar classical'],

    // Piano variations
    'Piano': ['Piano', 'Piano keyboard', 'Keyboard', 'Electric piano', 'Digital piano'],

    // Drums variations
    'Drums': ['Drums', 'Drum kit', 'Percussion', 'Drum set', 'Electronic drums'],

    // Violin variations
    'Violin': ['Violin', 'Electric violin', 'Acoustic violin'],

    // Other instruments (add exact matches for now)
    'Cello': ['Cello'],
    'Cajon': ['Cajon'],
    'Bongos': ['Bongos'],
    'Synth': ['Synth', 'Synthesizer', 'Electronic keyboard'],
    'Lead Vocals': ['Lead Vocals', 'Singer', 'Vocals', 'Voice'],
    'Backing Vocals': ['Backing Vocals', 'Background vocals', 'Harmony vocals'],
    'Saxophone': ['Saxophone', 'Sax'],
    'Trumpet': ['Trumpet'],
    'Flute': ['Flute']
};

let fetchedVideoIds = new Set();
let currentOffset = 0;
let hasReachedActualEnd = false;

/**
 * Helper function for DISCOVER API (limited data)
 * Used by DiscoverScreen - keeps existing functionality
 * @param {Array} apiData - Raw data from discover API
 * @returns {Array} - Transformed musician objects with limited data
 */
const formatDiscoverResponse = (apiData) => {
    const musicians = apiData.map(musician => {
        console.log('🔍 Raw musician data from DISCOVER API:', {
            username: musician.username,
            bio: musician.bio,
            location: musician.location,
            hasLimitedData: !musician.bio || !musician.location
        });

        return {
            id: musician.user_id || musician.id,
            username: musician.username,
            videos: [musician.video_url],

            // DISCOVER API has limited data
            bio: musician.bio || null,
            location: musician.location || musician.address || null,
            age: musician.age || null,
            rating: musician.rating || null,
            instruments: musician.instruments || [],
            genres: musician.genres || [],

            // Keep any other fields from the API response
            ...musician
        };
    });

    return musicians;
};

/**
 * Helper function for MATCH API (complete data)
 * Used by MatchScreen - gets complete user data
 * @param {Array} apiData - Raw data from match API (complete user objects)
 * @returns {Array} - Transformed musician objects with complete data
 */
const formatMatchResponse = (apiData) => {
    console.log('🔄 Processing MATCH API response with', apiData.length, 'musicians');
    
    const musicians = apiData.map((musician, index) => {
        console.log(`🔍 Processing musician ${index + 1}:`, {
            username: musician.username,
            bio: musician.bio ? 'Has bio' : 'No bio',
            location: musician.location ? 'Has location' : 'No location',
            age: musician.age || 'No age',
            rating: musician.rating || 'No rating',
            videosCount: musician.videos?.length || 0,
            hasCompleteData: !!(musician.bio && musician.location)
        });

        // Pick a random video from the user's videos array
        const randomVideo = musician.videos && musician.videos.length > 0 
            ? musician.videos[Math.floor(Math.random() * musician.videos.length)]
            : null;

        const formattedMusician = {
            id: musician.id || musician.user_id || `match-${index}-${Date.now()}`,
            username: musician.username || `unknown_${index}`,
            videos: musician.videos || [],
            video_url: randomVideo, // For compatibility

            // ✅ COMPLETE DATA FROM MATCH API!
            bio: musician.bio || null,
            location: musician.location || null,
            age: musician.age || null,
            rating: musician.rating || null,
            instruments: musician.instruments || [],
            genres: musician.genres || [],
            
            // All other complete profile fields
            followers: musician.followers || 0,
            following: musician.following || 0,
            likes: musician.likes || 0,
            socialLink: musician.sociallink || null,
            email: musician.email || null,
            gender: musician.gender || null,
            profile_picture: musician.profile_picture || null,

            // Keep all other fields
            ...musician
        };

        console.log(`✅ Formatted musician ${index + 1}:`, {
            username: formattedMusician.username,
            hasBio: !!formattedMusician.bio,
            hasLocation: !!formattedMusician.location,
            hasAge: !!formattedMusician.age,
            hasRating: !!formattedMusician.rating
        });

        return formattedMusician;
    });

    console.log(`✅ Formatted ${musicians.length} musicians with COMPLETE data from MATCH API`);
    return musicians;
};

/**
 * Legacy function - keep for backward compatibility with DiscoverScreen
 * @param {Array} apiData - Raw data from API
 * @returns {Array} - Transformed musician objects
 */
const formatMusicianResponse = (apiData) => {
    return formatDiscoverResponse(apiData); // Use discover formatter for backward compatibility
};

/**
 * Fetch initial musicians (no filters) - 5 random users
 */
export const fetchInitialMusicians = async (currentUser, limit = 5) => {
    try {
        console.log('🎵 Fetching initial musicians...');

        const url = `${MUSICIAN_API_URL}?type=initial&username=${encodeURIComponent(currentUser)}`;
        console.log('🎵 GET request to:', url);

        const response = await axios.get(url);

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format');
            return [];
        }

        console.log(`✅ Fetched ${response.data.length} initial musicians`);
        return formatMusicianResponse(response.data);
    } catch (error) {
        console.error('❌ Error fetching initial musicians:', error);
        throw error;
    }
};

/**
 * Fetch filtered musicians using GET with query parameters
 */
export const fetchFilteredMusicians = async (currentUser, filters, limit = 5) => {
    try {
        console.log('🎯 Fetching filtered musicians:', filters);

        const params = new URLSearchParams();
        params.append('type', 'filter');
        params.append('username', currentUser);

        // SMART INSTRUMENT FILTERING
        if (filters.selectedInstruments && filters.selectedInstruments.length > 0) {
            // Expand each selected instrument to include all its variations
            const expandedInstruments = {};

            filters.selectedInstruments.forEach(selectedInstrument => {
                const skillLevel = filters.selectedSkill && filters.selectedSkill.length > 0 ? filters.selectedSkill[0] : "any";

                // Get all variations for this instrument
                const variations = INSTRUMENT_VARIATIONS[selectedInstrument] || [selectedInstrument];

                console.log(`🎸 Expanding "${selectedInstrument}" to:`, variations);

                // Add all variations to the filter
                variations.forEach(variation => {
                    expandedInstruments[variation] = skillLevel;
                });
            });

            console.log('🎸 Final expanded instruments:', expandedInstruments);
            params.append('instruments', JSON.stringify(expandedInstruments));
        }

        // Add genre filters as JSON string
        if (filters.selectedGenres && filters.selectedGenres.length > 0) {
            params.append('genres', JSON.stringify(filters.selectedGenres));
        }

        // Add gender filter as JSON array string
        if (filters.selectedGender && filters.selectedGender !== 'Any') {
            params.append('gender', JSON.stringify([filters.selectedGender.toLowerCase()]));
        }

        const url = `${MUSICIAN_API_URL}?${params.toString()}`;

        const response = await axios.get(url);

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format');
            return [];
        }

        // DEBUG: Show what instruments we got back
        const responseInstruments = response.data.map(musician => musician.instruments || []).flat();
        console.log('🎸 Found instruments in response:', [...new Set(responseInstruments)]);

        console.log(`✅ Fetched ${response.data.length} filtered musicians with smart matching`);
        return formatMusicianResponse(response.data);
    } catch (error) {
        console.error('❌ Error fetching filtered musicians:', error);
        throw error;
    }
};

/**
 * Load more filtered musicians using GET
 */
export const loadMoreFilteredMusicians = async (currentUser, filters, limit = 3) => {
    try {
        console.log('🎯 Loading more filtered musicians...');

        const params = new URLSearchParams();
        params.append('type', 'filter');
        params.append('username', currentUser);

        // SAME SMART INSTRUMENT FILTERING
        if (filters.selectedInstruments && filters.selectedInstruments.length > 0) {
            const expandedInstruments = {};

            filters.selectedInstruments.forEach(selectedInstrument => {
                const skillLevel = filters.selectedSkill && filters.selectedSkill.length > 0 ? filters.selectedSkill[0] : "any";
                const variations = INSTRUMENT_VARIATIONS[selectedInstrument] || [selectedInstrument];

                variations.forEach(variation => {
                    expandedInstruments[variation] = skillLevel;
                });
            });

            params.append('instruments', JSON.stringify(expandedInstruments));
        }

        // Add genre filters as JSON string
        if (filters.selectedGenres && filters.selectedGenres.length > 0) {
            params.append('genres', JSON.stringify(filters.selectedGenres));
        }

        // Add gender filter as JSON array string
        if (filters.selectedGender && filters.selectedGender !== 'Any') {
            params.append('gender', JSON.stringify([filters.selectedGender.toLowerCase()]));
        }

        const url = `${MUSICIAN_API_URL}?${params.toString()}`;
        console.log('🎯 Loading more with smart filtering:', url);

        const response = await axios.get(url);

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format');
            return [];
        }

        console.log(`✅ Loaded ${response.data.length} more filtered musicians with smart matching`);
        return formatMusicianResponse(response.data);
    } catch (error) {
        console.error('❌ Error loading more filtered musicians:', error);
        throw error;
    }
};

/**
 * Function to discover new instrument variations from your backend
 */
export const discoverInstrumentVariations = async (currentUser) => {
    try {
        // Get all musicians to see what instruments exist
        const response = await axios.get(`${MUSICIAN_API_URL}?type=initial&username=${currentUser}`);

        if (response.data && Array.isArray(response.data)) {
            const allInstruments = new Set();

            response.data.forEach(musician => {
                if (musician.instruments && Array.isArray(musician.instruments)) {
                    musician.instruments.forEach(instrument => {
                        allInstruments.add(instrument);
                    });
                }
            });

            const sortedInstruments = Array.from(allInstruments).sort();

            console.log('🔍 All instruments found in backend:');
            console.log(sortedInstruments);

            // Group similar instruments
            const instrumentGroups = {
                bass: sortedInstruments.filter(i => i.toLowerCase().includes('bass')),
                guitar: sortedInstruments.filter(i => i.toLowerCase().includes('guitar')),
                piano: sortedInstruments.filter(i => i.toLowerCase().includes('piano') || i.toLowerCase().includes('keyboard')),
                drums: sortedInstruments.filter(i => i.toLowerCase().includes('drum') || i.toLowerCase().includes('percussion')),
                vocals: sortedInstruments.filter(i => i.toLowerCase().includes('vocal') || i.toLowerCase().includes('singer')),
            };

            console.log('🎸 Instrument groups found:');
            Object.entries(instrumentGroups).forEach(([group, instruments]) => {
                if (instruments.length > 0) {
                    console.log(`${group}:`, instruments);
                }
            });

            return { allInstruments: sortedInstruments, instrumentGroups };
        }

        return { allInstruments: [], instrumentGroups: {} };
    } catch (error) {
        console.error('❌ Error discovering instruments:', error);
        return { allInstruments: [], instrumentGroups: {} };
    }
};

/**
 * Load more musicians without filters using GET
 */
export const loadMusicianWithoutFilters = async (currentUser, limit = 3) => {
    try {
        console.log('🎵 Loading more musicians without filters...');

        // Use filter endpoint with just username to get random users
        const url = `${MUSICIAN_API_URL}?type=filter&username=${encodeURIComponent(currentUser)}`;
        console.log('🎵 GET request to:', url);

        const response = await axios.get(url);

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format');
            return [];
        }

        console.log(`✅ Loaded ${response.data.length} more musicians`);
        return formatMusicianResponse(response.data);
    } catch (error) {
        console.error('❌ Error loading more musicians:', error);
        throw error;
    }
};

/**
 * Legacy function for backward compatibility
 */
export const fetchMusicians = async (type = 'initial', username = null, filterCriteria = null, hasFilters = false) => {
    try {
        if (type === 'initial') {
            return await fetchInitialMusicians(username);
        } else if (type === 'filter') {
            if (hasFilters && filterCriteria && Object.keys(filterCriteria).length > 1) {
                // This would need to be converted to the new filter format
                return await loadMusicianWithoutFilters(username);
            } else {
                return await loadMusicianWithoutFilters(username);
            }
        }
    } catch (error) {
        console.error('❌ Error in legacy fetchMusicians:', error);
        return [];
    }
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

        const musicians = await fetchInitialMusicians('default_user');

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

/**
 * NEW: Fetch initial musicians for MATCH SCREEN (complete data)
 * Gets complete user profiles for swiping/matching
 */
export const fetchInitialMusiciansForMatch = async (currentUser, limit = 5) => {
    try {
        console.log('🎵 Fetching initial musicians for MATCH SCREEN...');

        const url = `${MATCH_API_URL}?type=initial&currentUser=${encodeURIComponent(currentUser)}&limit=${limit}`;
        console.log('🎵 GET request to MATCH API:', url);

        const response = await axios.get(url);

        console.log('✅ MATCH API Response received:', {
            status: response.status,
            dataType: Array.isArray(response.data),
            dataLength: response.data?.length || 0
        });

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format from MATCH API');
            return [];
        }

        console.log(`✅ Fetched ${response.data.length} initial musicians with complete data from MATCH API`);
        console.log('🔍 Sample raw data from MATCH API:', response.data[0]);
        
        return formatMatchResponse(response.data);
    } catch (error) {
        console.error('❌ Error fetching initial musicians from MATCH API:', error);
        throw error;
    }
};

/**
 * NEW: Load more musicians for MATCH SCREEN (complete data)
 * Gets additional complete user profiles for swiping/matching
 */
export const loadMoreMusiciansForMatch = async (currentUser, limit = 3) => {
    try {
        console.log('🎵 Loading more musicians for MATCH SCREEN...');

        // Build query parameters for GET request
        const params = new URLSearchParams();
        params.append('type', 'filter');
        params.append('username', currentUser);
        
        const url = `${MATCH_API_URL}?${params.toString()}`;
        console.log('🔗 MATCH API URL:', url);
        
        const response = await axios.get(url);

        console.log('✅ MATCH API Response received:', {
            status: response.status,
            dataType: Array.isArray(response.data),
            dataLength: response.data?.length || 0
        });

        if (!response.data || !Array.isArray(response.data)) {
            console.log('❌ Invalid API response format from MATCH API');
            return [];
        }

        console.log(`✅ Loaded ${response.data.length} musicians with complete data from MATCH API`);
        console.log('🔍 Sample raw data from MATCH API:', response.data[0]);
        
        return formatMatchResponse(response.data);
    } catch (error) {
        console.error('❌ Error loading more musicians from MATCH API:', error);
        console.error('❌ Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
        });
        
        // Return empty array instead of throwing to prevent infinite loops
        console.log('🔄 Returning empty array to prevent infinite loop');
        return [];
    }
};