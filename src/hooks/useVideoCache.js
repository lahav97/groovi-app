/**
 * @module useVideoCache
 * ENHANCED: Better profile video handling and loading state management
 * Handles tiny loading spinners and smart video caching for smooth playback
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import Logger from '../utils/Logger';

const logger = Logger.createLogger('useVideoCache');

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
      logger.debug('useVideoCache: Received videos', {
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
      logger.warn('Invalid video URL', { videoUrl, index });
      return `profile-video-${index}-invalid`;
    }
    
    const urlHash = videoUrl.split('/').pop() || videoUrl.substring(videoUrl.length - 10);
    return `profile-video-${index}-${urlHash}`;
  }, []);

  /**
   * Set video loading state with tiny spinner
   */
  const setVideoLoadingState = useCallback((videoId, state) => {
    setVideoStates(prev => {
      // Prevent unnecessary state updates
      if (prev[videoId] === state) return prev;
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
    return videoStates[videoId] === 'loading';
  }, [videoStates]);

  /**
   * Check if video is loaded and cached
   */
  const isVideoLoaded = useCallback((videoId) => {
    return videoStates[videoId] === 'loaded';
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
    logger.debug('✅ Video ready for display', { videoId });
    setVideoLoadingState(videoId, 'loaded');
    
    // CACHE the video ref to prevent re-loading when swiping back
    if (videoRef) {
      videoCache.current.set(videoId, {
        ref: videoRef,
        cachedAt: Date.now(),
        loaded: true
      });
    }
  }, [setVideoLoadingState]);

  /**
   * Handle video load error - show error state
   */
  const handleVideoLoadError = useCallback((videoId, error) => {
    logger.error('❌ Video load error', { videoId, error: error?.message || error });
    setVideoLoadingState(videoId, 'error');
  }, [setVideoLoadingState]);

  /**
   * Check if video is cached (already loaded before)
   */
  const isVideoCached = useCallback((videoId) => {
    return videoCache.current.has(videoId);
  }, []);

  /**
   * ENHANCED: Convert profile videos to video objects with better validation
   */
  const videoObjects = useMemo(() => {
    // Handle various video input formats
    if (!videos) {
      return [];
    }

    if (!Array.isArray(videos)) {
      logger.warn('Videos is not an array', { type: typeof videos });
      return [];
    }

    if (videos.length === 0) {
      return [];
    }

    const processedVideos = videos
      .map((videoUrl, index) => {
        // Handle different video formats
        let finalVideoUrl = videoUrl;
        
        // If video is an object, extract URL
        if (typeof videoUrl === 'object' && videoUrl !== null) {
          finalVideoUrl = videoUrl.url || videoUrl.uri || videoUrl.video_url || videoUrl.videoUrl;
        }
        
        // Validate URL
        if (!finalVideoUrl || typeof finalVideoUrl !== 'string') {
          logger.warn(`❌ Invalid video at index ${index}`, { videoUrl });
          return null;
        }
        
        // Basic URL validation
        if (!finalVideoUrl.startsWith('http')) {
          logger.warn(`❌ Invalid video URL format at index ${index}`, { finalVideoUrl });
          return null;
        }

        const videoId = generateVideoId(finalVideoUrl, index);
        
        return {
          id: videoId,
          uri: finalVideoUrl,
          index,
          isCached: isVideoCached(videoId),
          isLoading: isVideoLoading(videoId),
          isLoaded: isVideoLoaded(videoId)
        };
      })
      .filter(video => video !== null); // Remove invalid videos

    if (__DEV__) {
      logger.debug('✅ Processed video objects', {
        input: videos.length,
        output: processedVideos.length
      });
    }

    return processedVideos;
  }, [videos, generateVideoId, isVideoCached, isVideoLoading, isVideoLoaded]);

  /**
   * Toggle video pause/play
   */
  const togglePause = useCallback((id) => {
    logger.debug('⏯️ Toggling pause for video', { id });
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Check if video should play (based on focus, index, and pause status)
   */
  const shouldVideoPlay = useCallback((videoId, index) => {
    const isCurrentVideo = index === currentIndex;
    const isPaused = pausedStatus[videoId];
    const shouldPlay = isFocused && isCurrentVideo && !isPaused;
    
    return shouldPlay;
  }, [isFocused, currentIndex, pausedStatus]);

  /**
   * Handle video swiper index change with smart caching
   */
  const onIndexChanged = useCallback((index, videos) => {
    setCurrentIndex(index);
    
    if (!videos || videos.length === 0) return;
    
    // Pause all videos except current one
    videos.forEach(video => {
      if (video.id !== videos[index]?.id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync().catch(() => {});
      }
    });
    
    // Play current video if not paused and loaded
    const currentVideo = videos[index];
    if (currentVideo && !pausedStatus[currentVideo.id] && videoRefs.current[currentVideo.id]?.playAsync) {
      videoRefs.current[currentVideo.id].playAsync().catch(() => {});
    }

    // Preload next video in background
    const nextIndex = index + 1;
    if (nextIndex < videos.length) {
      const nextVideo = videos[nextIndex];
      if (nextVideo && !nextVideo.isCached && !nextVideo.isLoading) {
        // Silent preload
      }
    }
  }, [pausedStatus]);

  /**
   * Set video ref in cache
   */
  const setVideoRef = useCallback((videoId, ref) => {
    videoRefs.current[videoId] = ref;
    
    // Cache video ref when ready
    if (ref && !isVideoCached(videoId)) {
      handleVideoReadyForDisplay(videoId, ref);
    }
  }, [isVideoCached, handleVideoReadyForDisplay]);

  /**
   * Get video ref from cache
   */
  const getVideoRef = useCallback((videoId) => {
    return videoRefs.current[videoId];
  }, []);

  /**
   * Clear all video cache (for logout, etc.)
   */
  const clearVideoCache = useCallback(() => {
    logger.info('🧹 Clearing video cache');

    // Pause all videos
    Object.values(videoRefs.current).forEach(ref => {
      if (ref && ref.pauseAsync) {
        ref.pauseAsync().catch(() => {});
      }
    });
    
    // Clear all refs and cache
    videoRefs.current = {};
    videoCache.current.clear();
    setVideoStates({});
    setPausedStatus({});
    setCurrentIndex(0);
  }, []);

  /**
   * Preload videos for better performance
   */
  const preloadVideos = useCallback((startIndex = 0, count = 2) => {
    for (let i = startIndex; i < Math.min(startIndex + count, videoObjects.length); i++) {
      const video = videoObjects[i];
      if (video && !video.isCached && !video.isLoading) {
        setVideoLoadingState(video.id, 'preloading');
      }
    }
  }, [videoObjects, setVideoLoadingState]);

  // Preload first few videos when component mounts
  useEffect(() => {
    if (videoObjects.length > 0) {
      preloadVideos(0, 2);
    }
  }, [videoObjects.length > 0]);

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

  try {
    // Try to clear any global video references if they exist
    if (global.videoCache) {
      global.videoCache.clear();
    }
    
    // Clear any global video refs
    if (global.videoRefs) {
      Object.values(global.videoRefs).forEach(ref => {
        if (ref && ref.pauseAsync) {
          ref.pauseAsync().catch(() => {});
        }
      });
      global.videoRefs = {};
    }
    
    logger.info('✅ Global video cache cleared');
  } catch (error) {
    logger.warn('⚠️ Error clearing global video cache', { error: error.message });
  }
  
  // Force garbage collection if available
  if (global.gc) {
    setTimeout(() => {
      global.gc();
      logger.debug('♻️ Forced GC after video cache clear');
    }, 100);
  }
};

export default useVideoCache;
