/**
 * @module useVideoCache
 * Custom hook for video caching and loading state management
 * Handles tiny loading spinners and smart video caching for smooth playback
 */

import { useState, useRef, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';

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

  /**
   * Generate unique video ID for consistent caching
   */
  const generateVideoId = (videoUrl, index) => {
    const urlHash = videoUrl.split('/').pop() || videoUrl.substring(videoUrl.length - 10);
    return `profile-video-${index}-${urlHash}`;
  };

  /**
   * Set video loading state with tiny spinner
   */
  const setVideoLoadingState = (videoId, state) => {
    setVideoStates(prev => ({
      ...prev,
      [videoId]: state
    }));
  };

  /**
   * Check if video is currently loading (for spinner display)
   */
  const isVideoLoading = (videoId) => {
    return videoStates[videoId] === 'loading';
  };

  /**
   * Check if video is loaded and cached
   */
  const isVideoLoaded = (videoId) => {
    return videoStates[videoId] === 'loaded';
  };

  /**
   * Handle video load start - show tiny spinner
   */
  const handleVideoLoadStart = (videoId) => {
    console.log(`🎬 useVideoCache: Loading video: ${videoId}`);
    setVideoLoadingState(videoId, 'loading');
  };

  /**
   * Handle video ready for display - hide spinner, cache ref
   */
  const handleVideoReadyForDisplay = (videoId, videoRef) => {
    console.log(`✅ useVideoCache: Video ready: ${videoId}`);
    setVideoLoadingState(videoId, 'loaded');
    
    // CACHE the video ref to prevent re-loading when swiping back
    if (videoRef) {
      videoCache.current.set(videoId, {
        ref: videoRef,
        cachedAt: Date.now(),
        loaded: true
      });
    }
  };

  /**
   * Handle video load error - show error state
   */
  const handleVideoLoadError = (videoId, error) => {
    console.error(`❌ useVideoCache: Video load error: ${videoId}`, error);
    setVideoLoadingState(videoId, 'error');
  };

  /**
   * Check if video is cached (already loaded before)
   */
  const isVideoCached = (videoId) => {
    return videoCache.current.has(videoId);
  };

  /**
   * Convert profile videos (array of URL strings) to video objects with caching info
   */
  const getVideoObjects = () => {
    if (!videos || !Array.isArray(videos)) {
      return [];
    }

    return videos.map((videoUrl, index) => {
      const videoId = generateVideoId(videoUrl, index);
      return {
        id: videoId,
        uri: videoUrl,
        index,
        isCached: isVideoCached(videoId),
        isLoading: isVideoLoading(videoId),
        isLoaded: isVideoLoaded(videoId)
      };
    });
  };

  /**
   * Toggle video pause/play
   */
  const togglePause = (id) => {
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * Handle video swiper index change with smart caching
   */
  const onIndexChanged = (index, videoObjects) => {
    setCurrentIndex(index);
    
    // Pause all videos except current one
    videoObjects.forEach(video => {
      if (video.id !== videoObjects[index].id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync();
      }
    });
    
    // Play current video if not paused and loaded
    if (!pausedStatus[videoObjects[index].id] && videoRefs.current[videoObjects[index].id]?.playAsync) {
      videoRefs.current[videoObjects[index].id].playAsync();
    }

    // PRELOAD next video in background (for smooth swiping)
    const nextIndex = index + 1;
    if (nextIndex < videoObjects.length) {
      const nextVideo = videoObjects[nextIndex];
      if (!nextVideo.isCached && !nextVideo.isLoading) {
        console.log(`🔄 useVideoCache: Preloading next video: ${nextVideo.id}`);
        // The video will start loading when rendered by Swiper
      }
    }
  };

  /**
   * Set video ref in cache
   */
  const setVideoRef = (videoId, ref) => {
    videoRefs.current[videoId] = ref;
    
    // CACHE VIDEO REF when it's ready
    if (ref && !isVideoCached(videoId)) {
      handleVideoReadyForDisplay(videoId, ref);
    }
  };

  /**
   * Get video ref from cache
   */
  const getVideoRef = (videoId) => {
    return videoRefs.current[videoId];
  };

  /**
   * Check if video should play
   */
  const shouldVideoPlay = (videoId, index) => {
    const videoObjects = getVideoObjects();
    const video = videoObjects.find(v => v.id === videoId);
    
    return (
      !pausedStatus[videoId] && 
      isFocused && 
      currentIndex === index &&
      !video?.isLoading // Don't play while loading
    );
  };

  /**
   * Clear video cache (for logout)
   */
  const clearVideoCache = () => {
    videoCache.current.clear();
    setVideoStates({});
    setPausedStatus({});
    setCurrentIndex(0);
    videoRefs.current = {};
  };

  // Pause videos when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    }
  }, [isFocused]);

  return {
    // Video objects with cache info
    videoObjects: getVideoObjects(),
    
    // State
    videoStates,
    pausedStatus,
    currentIndex,
    
    // Video state checkers
    isVideoLoading,
    isVideoLoaded,
    isVideoCached,
    
    // Event handlers
    handleVideoLoadStart,
    handleVideoReadyForDisplay,
    handleVideoLoadError,
    
    // Video controls
    togglePause,
    onIndexChanged,
    shouldVideoPlay,
    
    // Video ref management
    setVideoRef,
    getVideoRef,
    
    // Utilities
    generateVideoId,
    clearVideoCache,
  };
};