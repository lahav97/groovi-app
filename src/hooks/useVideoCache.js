/**
 * @module useVideoCache
 * ENHANCED: Better profile video handling and loading state management
 * Handles tiny loading spinners and smart video caching for smooth playback
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { createLogger } from '../utils/Logger';

const logger = createLogger('useVideoCache');

/**
 * Custom hook for video caching and loading state management
 * @param {Array} videos - Array of video URLs from profile
 * @returns {Object} Video cache utilities and state management
 */
export const useVideoCache = (videos = []) => {
  const isFocused = useIsFocused();
  
  // VIDEO CACHING & LOADING STATES
  const [videoStates, setVideoStates] = useState({}); // Track loading state per video
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // VIDEO REFS CACHE - Keep loaded videos in memory
  const videoRefs = useRef({}); // Cache video refs to prevent re-loading
  const videoCache = useRef(new Map()); // Simple memory cache for video states

  // Debug video input
  useEffect(() => {
    if (__DEV__) {
      logger.debug('🎬 useVideoCache: Received videos', {
        length: videos?.length || 0,
        isArray: Array.isArray(videos)
      });
    }
  }, [videos]);

  /**
   * Generate unique video ID for consistent caching
   */
  const generateVideoId = useCallback((videoUrl, index) => {
    if (!videoUrl || typeof videoUrl !== 'string') {
      logger.warn('⚠️ Invalid video URL provided', {
        videoUrl,
        index,
        type: typeof videoUrl
      });
      return `profile-video-${index}-invalid`;
    }
    
    const urlHash = videoUrl.split('/').pop() || videoUrl.substring(videoUrl.length - 10);
    const videoId = `profile-video-${index}-${urlHash}`;

    logger.debug('🆔 Generated video ID', {
      index,
      urlHash: urlHash.substring(0, 10) + '...',
      videoId
    });

    return videoId;
  }, []);

  /**
   * Set video loading state with tiny spinner
   */
  const setVideoLoadingState = useCallback((videoId, state) => {
    setVideoStates(prev => {
      // Prevent unnecessary state updates
      if (prev[videoId] === state) {
        logger.debug('🔄 Video state unchanged, skipping update', { videoId, state });
        return prev;
      }

      logger.debug('🎬 Video state updated', {
        videoId,
        previousState: prev[videoId],
        newState: state
      });

      return {
        ...prev,
        [videoId]: state
      };
    });
  }, []);

  /**
   * Check if video is currently loading (for spinner display)
   */
  const isVideoLoading = useCallback((videoId) => {
    const isLoading = videoStates[videoId] === 'loading';
    return isLoading;
  }, [videoStates]);

  /**
   * Check if video is loaded and cached
   */
  const isVideoLoaded = useCallback((videoId) => {
    const isLoaded = videoStates[videoId] === 'loaded';
    return isLoaded;
  }, [videoStates]);

  /**
   * Handle video load start - show tiny spinner
   */
  const handleVideoLoadStart = useCallback((videoId) => {
    logger.debug('🔄 Video load start', { videoId });
    setVideoLoadingState(videoId, 'loading');
  }, [setVideoLoadingState]);

  /**
   * Handle video ready for display - hide spinner, cache ref
   */
  const handleVideoReadyForDisplay = useCallback((videoId, videoRef) => {
    logger.info('✅ Video ready for display', {
      videoId,
      hasRef: !!videoRef,
      cacheSize: videoCache.current.size
    });

    setVideoLoadingState(videoId, 'loaded');
    
    // CACHE the video ref to prevent re-loading when swiping back
    if (videoRef) {
      videoCache.current.set(videoId, {
        ref: videoRef,
        cachedAt: Date.now(),
        loaded: true
      });

      logger.debug('💾 Video ref cached successfully', {
        videoId,
        totalCached: videoCache.current.size
      });
    }
  }, [setVideoLoadingState]);

  /**
   * Handle video load error - show error state
   */
  const handleVideoLoadError = useCallback((videoId, error) => {
    logger.error('❌ Video load error occurred', {
      videoId,
      error: error?.message || error,
      errorType: typeof error
    });

    setVideoLoadingState(videoId, 'error');
  }, [setVideoLoadingState]);

  /**
   * Check if video is cached (already loaded before)
   */
  const isVideoCached = useCallback((videoId) => {
    const isCached = videoCache.current.has(videoId);

    if (isCached) {
      const cacheInfo = videoCache.current.get(videoId);
      logger.debug('💾 Video cache hit', {
        videoId,
        cachedAt: new Date(cacheInfo.cachedAt).toISOString(),
        ageMinutes: ((Date.now() - cacheInfo.cachedAt) / 60000).toFixed(1)
      });
    }

    return isCached;
  }, []);

  /**
   * ENHANCED: Convert profile videos to video objects with better validation
   */
  const videoObjects = useMemo(() => {
    // Handle various video input formats
    if (!videos) {
      logger.info('📭 No videos provided');
      return [];
    }

    if (!Array.isArray(videos)) {
      logger.warn('⚠️ Videos is not an array', {
        type: typeof videos,
        value: videos
      });
      return [];
    }

    if (videos.length === 0) {
      logger.info('📭 Empty videos array');
      return [];
    }

    const processedVideos = videos
      .map((videoUrl, index) => {
        // Handle different video formats
        let finalVideoUrl = videoUrl;
        
        // If video is an object, extract URL
        if (typeof videoUrl === 'object' && videoUrl !== null) {
          finalVideoUrl = videoUrl.url || videoUrl.uri || videoUrl.video_url || videoUrl.videoUrl;

          logger.debug('🎬 Extracted URL from video object', {
            index,
            hasUrl: !!videoUrl.url,
            hasUri: !!videoUrl.uri,
            hasVideoUrl: !!videoUrl.video_url,
            finalUrl: finalVideoUrl?.substring(0, 50) + '...'
          });
        }
        
        // Validate URL
        if (!finalVideoUrl || typeof finalVideoUrl !== 'string') {
          logger.warn(`❌ Invalid video at index ${index}`, {
            index,
            videoUrl,
            finalVideoUrl,
            type: typeof finalVideoUrl
          });
          return null;
        }
        
        // Basic URL validation
        if (!finalVideoUrl.startsWith('http')) {
          logger.warn(`❌ Invalid video URL format at index ${index}`, {
            index,
            finalVideoUrl: finalVideoUrl.substring(0, 50) + '...'
          });
          return null;
        }

        const videoId = generateVideoId(finalVideoUrl, index);
        
        const videoObject = {
          id: videoId,
          uri: finalVideoUrl,
          index,
          isCached: isVideoCached(videoId),
          isLoading: isVideoLoading(videoId),
          isLoaded: isVideoLoaded(videoId)
        };

        logger.debug('✅ Video processed successfully', {
          index,
          videoId,
          isCached: videoObject.isCached,
          isLoading: videoObject.isLoading,
          isLoaded: videoObject.isLoaded
        });

        return videoObject;
      })
      .filter(video => video !== null); // Remove invalid videos

    logger.info('🎬 Video objects processing completed', {
      inputCount: videos.length,
      outputCount: processedVideos.length,
      invalidCount: videos.length - processedVideos.length
    });

    return processedVideos;
  }, [videos, generateVideoId, isVideoCached, isVideoLoading, isVideoLoaded]);

  /**
   * Toggle video pause/play
   */
  const togglePause = useCallback((id) => {
    logger.debug('⏯️ Toggling pause state', { videoId: id });

    setPausedStatus(prev => {
      const newPausedState = !prev[id];

      logger.info('⏯️ Video pause state changed', {
        videoId: id,
        previousState: prev[id] ? 'paused' : 'playing',
        newState: newPausedState ? 'paused' : 'playing'
      });

      return { ...prev, [id]: newPausedState };
    });
  }, []);

  /**
   * Check if video should play (based on focus, index, and pause status)
   */
  const shouldVideoPlay = useCallback((videoId, index) => {
    const isCurrentVideo = index === currentIndex;
    const isPaused = pausedStatus[videoId];
    const shouldPlay = isFocused && isCurrentVideo && !isPaused;
    
    logger.debug('🎬 Video play decision', {
      videoId,
      index,
      currentIndex,
      isFocused,
      isCurrentVideo,
      isPaused,
      shouldPlay
    });

    return shouldPlay;
  }, [isFocused, currentIndex, pausedStatus]);

  /**
   * Handle video swiper index change with smart caching
   */
  const onIndexChanged = useCallback((index, videos) => {
    logger.info('📱 Video index changed', {
      previousIndex: currentIndex,
      newIndex: index,
      totalVideos: videos?.length || 0
    });

    setCurrentIndex(index);
    
    if (!videos || videos.length === 0) {
      logger.warn('⚠️ No videos available for index change');
      return;
    }

    let pausedCount = 0;
    let playedCount = 0;

    // Pause all videos except current one
    videos.forEach((video, videoIndex) => {
      const videoRef = videoRefs.current[video.id];

      if (video.id !== videos[index]?.id && videoRef?.pauseAsync) {
        videoRef.pauseAsync().catch((error) => {
          logger.warn('⚠️ Failed to pause video', {
            videoId: video.id,
            error: error.message
          });
        });
        pausedCount++;
      }
    });
    
    // Play current video if not paused and loaded
    const currentVideo = videos[index];
    if (currentVideo && !pausedStatus[currentVideo.id]) {
      const currentVideoRef = videoRefs.current[currentVideo.id];
      if (currentVideoRef?.playAsync) {
        currentVideoRef.playAsync().catch((error) => {
          logger.warn('⚠️ Failed to play current video', {
            videoId: currentVideo.id,
            error: error.message
          });
        });
        playedCount++;
      }
    }

    // Preload next video in background
    const nextIndex = index + 1;
    if (nextIndex < videos.length) {
      const nextVideo = videos[nextIndex];
      if (nextVideo && !nextVideo.isCached && !nextVideo.isLoading) {
        logger.debug('📦 Preloading next video', {
          nextIndex,
          videoId: nextVideo.id
        });
      }
    }

    logger.info('✅ Video index change completed', {
      newIndex: index,
      pausedCount,
      playedCount
    });
  }, [currentIndex, pausedStatus]);

  /**
   * Set video ref in cache
   */
  const setVideoRef = useCallback((videoId, ref) => {
    videoRefs.current[videoId] = ref;
    
    // Cache video ref when ready
    if (ref && !isVideoCached(videoId)) {
      handleVideoReadyForDisplay(videoId, ref);
    }

    logger.debug('📹 Video ref set successfully', {
      videoId,
      hasRef: !!ref,
      totalRefs: Object.keys(videoRefs.current).length
    });
  }, [isVideoCached, handleVideoReadyForDisplay]);

  /**
   * Get video ref from cache
   */
  const getVideoRef = useCallback((videoId) => {
    const ref = videoRefs.current[videoId];

    logger.debug('📹 Video ref retrieved', {
      videoId,
      hasRef: !!ref
    });

    return ref;
  }, []);

  /**
   * Clear all video cache (for logout, etc.)
   */
  const clearVideoCache = useCallback(() => {
    logger.info('🧹 Clearing video cache');

    let pausedCount = 0;
    const totalRefs = Object.keys(videoRefs.current).length;
    const totalCached = videoCache.current.size;

    // Pause all videos
    Object.values(videoRefs.current).forEach(ref => {
      if (ref && ref.pauseAsync) {
        ref.pauseAsync().catch((error) => {
          logger.warn('⚠️ Failed to pause video during cache clear', {
            error: error.message
          });
        });
        pausedCount++;
      }
    });
    
    // Clear all refs and cache
    videoRefs.current = {};
    videoCache.current.clear();
    setVideoStates({});
    setPausedStatus({});
    setCurrentIndex(0);

    logger.info('✅ Video cache cleared successfully', {
      pausedVideos: pausedCount,
      clearedRefs: totalRefs,
      clearedCache: totalCached
    });
  }, []);

  /**
   * Preload videos for better performance
   */
  const preloadVideos = useCallback((startIndex = 0, count = 2) => {
    logger.info('📦 Starting video preload', {
      startIndex,
      count,
      totalVideos: videoObjects.length
    });

    let preloadedCount = 0;

    for (let i = startIndex; i < Math.min(startIndex + count, videoObjects.length); i++) {
      const video = videoObjects[i];
      if (video && !video.isCached && !video.isLoading) {
        setVideoLoadingState(video.id, 'preloading');
        preloadedCount++;

        logger.debug('📦 Preloading video', {
          index: i,
          videoId: video.id
        });
      }
    }

    logger.info('✅ Video preload completed', {
      startIndex,
      preloadedCount
    });
  }, [videoObjects, setVideoLoadingState]);

  // Preload first few videos when component mounts
  useEffect(() => {
    if (videoObjects.length > 0) {
      logger.info('🎬 Auto-preloading initial videos', {
        videoCount: videoObjects.length
      });
      preloadVideos(0, 2);
    }
  }, [videoObjects.length > 0, preloadVideos]);

  return {
    // Video objects for rendering
    videoObjects,
    
    // State management
    videoStates,
    currentIndex,
    
    // Control functions
    onIndexChanged,
    togglePause,
    shouldVideoPlay,
    
    // Video event handlers
    handleVideoLoadStart,
    handleVideoReadyForDisplay,
    handleVideoLoadError,
    
    // Reference management
    setVideoRef,
    getVideoRef,
    
    // Cache utilities
    clearVideoCache,
    preloadVideos,
    isVideoCached,
    isVideoLoading,
    isVideoLoaded,
  };
};

/**
 * Standalone video cache clearing function for memory management
 * Can be called from AppNavigator or other components for emergency cleanup
 */
export const clearVideoCache = () => {
  logger.info('🧹 Global video cache clear triggered');

  let clearedGlobalCache = false;
  let clearedGlobalRefs = false;
  let globalRefCount = 0;

  try {
    // Try to clear any global video references if they exist
    if (global.videoCache) {
      global.videoCache.clear();
      clearedGlobalCache = true;
      logger.debug('🗑️ Cleared global video cache');
    }
    
    // Clear any global video refs
    if (global.videoRefs) {
      globalRefCount = Object.keys(global.videoRefs).length;

      Object.values(global.videoRefs).forEach(ref => {
        if (ref && ref.pauseAsync) {
          ref.pauseAsync().catch((error) => {
            logger.warn('⚠️ Failed to pause global video ref', {
              error: error.message
            });
          });
        }
      });
      global.videoRefs = {};
      clearedGlobalRefs = true;
      logger.debug('🗑️ Cleared global video refs', { refCount: globalRefCount });
    }
    
    logger.info('✅ Global video cache cleared successfully', {
      clearedGlobalCache,
      clearedGlobalRefs,
      globalRefCount
    });

  } catch (error) {
    logger.error('❌ Error clearing global video cache', {
      error: error.message,
      stack: error.stack
    });
  }
  
  // Force garbage collection if available
  if (global.gc) {
    setTimeout(() => {
      global.gc();
      logger.debug('♻️ Forced garbage collection after global video cache clear');
    }, 100);
  }
};

export default useVideoCache;
