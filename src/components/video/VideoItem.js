import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import VideoInfo from './VideoInfo';
import * as FileSystem from 'expo-file-system';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// SIMPLIFIED VIDEO MANAGER - More reliable state management
class GlobalVideoManager {
  constructor() {
    this.currentActiveVideo = null;
    this.allVideoRefs = new Map();
    this.pausedVideos = new Set(); // Track manually paused videos
  }

  registerVideo(videoRef, videoId) {
    this.allVideoRefs.set(videoId, videoRef);
  }

  unregisterVideo(videoId) {
    this.allVideoRefs.delete(videoId);
    this.pausedVideos.delete(videoId);
  }

  // FIXED: Better handling of manual pause/play
  async setActiveVideo(videoRef, videoId, isManualPlay = false) {
    try {
      // If this video was manually paused, remove it from paused set
      if (isManualPlay) {
        this.pausedVideos.delete(videoId);
      }

      // Pause all other videos
      for (const [id, ref] of this.allVideoRefs) {
        if (id !== videoId && ref.current) {
          try {
            await ref.current.pauseAsync();
          } catch (error) {
            // Silent fail
          }
        }
      }

      this.currentActiveVideo = videoId;
      
      // Start the new video
      if (videoRef.current) {
        try {
          await videoRef.current.playAsync();
          console.log(`▶️ Video playing: ${videoId}`);
        } catch (error) {
          console.warn('Failed to play video:', error);
        }
      }
    } catch (error) {
      console.error('Error setting active video:', error);
    }
  }

  async pauseVideo(videoId) {
    try {
      const ref = this.allVideoRefs.get(videoId);
      if (ref && ref.current) {
        await ref.current.pauseAsync();
        this.pausedVideos.add(videoId); // Mark as manually paused
        if (this.currentActiveVideo === videoId) {
          this.currentActiveVideo = null;
        }
        console.log(`⏸️ Video paused: ${videoId}`);
      }
    } catch (error) {
      console.error('Error pausing video:', error);
    }
  }

  async pauseAllVideos() {
    const pausePromises = [];
    
    for (const [id, ref] of this.allVideoRefs) {
      if (ref.current) {
        pausePromises.push(
          ref.current.pauseAsync().catch(() => {})
        );
      }
    }
    
    await Promise.all(pausePromises);
    this.currentActiveVideo = null;
  }

  isActive(videoId) {
    return this.currentActiveVideo === videoId;
  }

  isManuallyPaused(videoId) {
    return this.pausedVideos.has(videoId);
  }
}

const globalVideoManager = new GlobalVideoManager();

// Background cache queue
const cacheQueue = [];
let isProcessingCacheQueue = false;

const processCacheQueue = async () => {
  if (isProcessingCacheQueue || cacheQueue.length === 0) return;
  
  isProcessingCacheQueue = true;
  
  while (cacheQueue.length > 0) {
    const cacheOperation = cacheQueue.shift();
    try {
      await cacheOperation();
    } catch (error) {
      // Silent fail
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  isProcessingCacheQueue = false;
};

// FIXED: Improved VideoItem with better pause/play handling
const VideoItem = memo(({ item, isVisible, height, shouldCache = false }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  
  // SIMPLIFIED state management
  const [userPaused, setUserPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Refs
  const retryCountRef = useRef(0);
  const componentMountedRef = useRef(true);
  const cacheAttemptedRef = useRef(false);
  const stableVideoSourceRef = useRef(null);
  
  const videoId = useRef(`video-${item.id || 'unknown'}-${Date.now()}`).current;
  
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  // Stable video source
  const videoSource = stableVideoSourceRef.current || localVideoUri || item.videoUrl;
  
  // Initialize stable source
  useEffect(() => {
    if (!stableVideoSourceRef.current) {
      stableVideoSourceRef.current = item.videoUrl;
    }
  }, [item.videoUrl]);

  // Register with global video manager
  useEffect(() => {
    globalVideoManager.registerVideo(videoRef, videoId);
    return () => {
      globalVideoManager.unregisterVideo(videoId);
    };
  }, [videoId]);

  // FIXED: Simplified playback control
  const updatePlaybackState = useCallback(async () => {
    if (!componentMountedRef.current || !videoLoaded) return;

    const shouldPlay = isVisible && isFocused && !userPaused;
    const isCurrentlyActive = globalVideoManager.isActive(videoId);

    if (shouldPlay && !isCurrentlyActive) {
      // Need to start playing
      await globalVideoManager.setActiveVideo(videoRef, videoId, false);
    } else if (!shouldPlay && isCurrentlyActive) {
      // Need to stop playing (but don't mark as manually paused unless user did it)
      if (videoRef.current) {
        try {
          await videoRef.current.pauseAsync();
        } catch (error) {
          // Silent fail
        }
      }
    }
  }, [isVisible, isFocused, userPaused, videoLoaded, videoId]);

  // Update playback state when dependencies change
  useEffect(() => {
    const timeoutId = setTimeout(updatePlaybackState, 100);
    return () => clearTimeout(timeoutId);
  }, [updatePlaybackState]);

  // Screen focus handling
  useEffect(() => {
    if (!isFocused) {
      globalVideoManager.pauseAllVideos();
    }
  }, [isFocused]);

  // Background caching
  const cacheVideoInBackground = async (videoUrl) => {
    if (!shouldCache || cacheAttemptedRef.current || !componentMountedRef.current) return;
    cacheAttemptedRef.current = true;
    
    const cacheOperation = async () => {
      try {
        if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
          return null;
        }

        const filename = videoUrl.split('/').pop() || `video_${Date.now()}.mp4`;
        const localUri = `${FileSystem.cacheDirectory}videos/${filename}`;
        
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
        }

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists && componentMountedRef.current) {
          setLocalVideoUri(localUri);
          return localUri;
        }
        
        if (shouldCache && isVisible) {
          const downloadResult = await FileSystem.downloadAsync(videoUrl, localUri);
          
          if (downloadResult.status === 200 && componentMountedRef.current) {
            setLocalVideoUri(localUri);
            return localUri;
          }
        }
        
        return null;
      } catch (error) {
        return null;
      }
    };
    
    cacheQueue.push(cacheOperation);
    setTimeout(processCacheQueue, 0);
  };

  // Cache trigger
  useEffect(() => {
    if (item.videoUrl && shouldCache && isVisible && componentMountedRef.current) {
      cacheVideoInBackground(item.videoUrl);
    }
  }, [item.videoUrl, shouldCache, isVisible]);

  // Play icon timeout
  useEffect(() => {
    if (showPlayIcon) {
      const timeout = setTimeout(() => setShowPlayIcon(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [showPlayIcon]);

  // Loading timeout
  useEffect(() => {
    if (isLoading && isPlaying) {
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isPlaying]);

  // Clear error when playing
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  // FIXED: Better user pause/play toggle
  const handleTogglePlayback = useCallback(async () => {
    if (!componentMountedRef.current || !videoLoaded) return;
    
    const newUserPaused = !userPaused;
    setUserPaused(newUserPaused);
    setShowPlayIcon(true);
    
    if (newUserPaused) {
      // User wants to pause
      await globalVideoManager.pauseVideo(videoId);
    } else {
      // User wants to play
      await globalVideoManager.setActiveVideo(videoRef, videoId, true);
    }
  }, [userPaused, videoLoaded, videoId]);

  // Video load handler
  const handleVideoLoad = useCallback(() => {
    if (!componentMountedRef.current) return;
    
    setVideoLoaded(true);
    setIsLoading(false);
    setHasError(false);
    retryCountRef.current = 0;
    
    // Trigger playback state update after load
    setTimeout(updatePlaybackState, 50);
  }, [updatePlaybackState]);

  // Error handling
  const handleVideoError = useCallback((error) => {
    if (!componentMountedRef.current) return;
    
    console.warn('Video error:', error);
    
    const errorString = error?.toString() || '';
    
    // Handle corrupted cache
    if (localVideoUri && (errorString.includes('j7.x$b') || errorString.includes('could read'))) {
      if (!isPlaying) {
        setLocalVideoUri(null);
        cacheAttemptedRef.current = false;
        stableVideoSourceRef.current = item.videoUrl;
      }
    }
    
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    setVideoLoaded(false);
    
    // Retry logic
    if (retryCountRef.current < 1) {
      retryCountRef.current += 1;
      setTimeout(() => {
        if (componentMountedRef.current) {
          retryLoadVideo();
        }
      }, 1000);
    }
  }, [localVideoUri, isPlaying, item.videoUrl]);

  // Playback status handler
  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (!componentMountedRef.current) return;
    
    if (status.isLoaded) {
      const newIsPlaying = status.isPlaying && !status.isPaused;
      setIsPlaying(newIsPlaying);
      
      if (newIsPlaying) {
        setIsLoading(false);
        setHasError(false);
      }
      
      // Auto-replay when finished
      if (status.didJustFinish && !status.isLooping && videoRef.current) {
        const shouldStillPlay = isVisible && isFocused && !userPaused;
        if (shouldStillPlay) {
          videoRef.current.replayAsync();
        }
      }
    }
  }, [isVisible, isFocused, userPaused]);

  const retryLoadVideo = useCallback(async () => {
    if (!componentMountedRef.current || !item.videoUrl) return;
    
    try {
      if (videoRef.current) {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ uri: stableVideoSourceRef.current }, {}, false);
      }
    } catch (e) {
      setHasError(true);
      setIsLoading(false);
    }
  }, [item.videoUrl]);

  // Component cleanup
  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
      
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [videoId]);

  // Validate video URL
  if (!item.videoUrl || typeof item.videoUrl !== 'string' || !item.videoUrl.startsWith('http')) {
    return (
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <View style={styles.centerOverlay}>
          <Icon name="videocam-off" size={60} color="#666" />
          <Text style={styles.errorText}>Invalid video</Text>
        </View>
        <VideoInfo video={{ 
          username: item.username || item.user, 
          description: item.description,
          userId: item.user_id || item.id
        }} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <Video
          ref={videoRef}
          source={{ uri: videoSource }}
          style={styles.videoPlayer}
          resizeMode="cover"
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={500}
          rate={1.0}
          volume={1.0}
          bufferConfig={{
            minBufferMs: 2000,
            maxBufferMs: 10000,
            bufferForPlaybackMs: 500,
            bufferForPlaybackAfterRebufferMs: 1000
          }}
          useNativeControls={false}
          ignoreSilentSwitch="ignore"
        />

        {/* Play/pause icon */}
        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <View style={styles.playIconBackground}>
              <Icon
                name={userPaused ? 'play' : 'pause'}
                size={50}
                color="white"
                style={styles.playIcon}
              />
            </View>
          </View>
        )}

        {/* Loading indicator */}
        {isLoading && !isPlaying && !showPlayIcon && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Error with retry */}
        {hasError && retryCountRef.current >= 1 && (
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            retryCountRef.current = 0;
            setLocalVideoUri(null);
            cacheAttemptedRef.current = false;
            stableVideoSourceRef.current = item.videoUrl;
            setHasError(false);
            setIsLoading(true);
            setUserPaused(false); // Reset user pause state
            retryLoadVideo();
          }}>
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* ENHANCED VIDEO INFO - Pass more user data for navigation */}
        <VideoInfo video={{ 
          username: item.username || item.user, 
          description: item.description,
          userId: item.user_id || item.id
        }} />
      </View>
    </TouchableWithoutFeedback>
  );
});

VideoItem.displayName = 'VideoItem';

const styles = StyleSheet.create({
  videoContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayer: {
    width: width,
    height: SCREEN_HEIGHT,
  },
  centerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    zIndex: 10,
    alignItems: 'center',
  },
  playIconBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    alignSelf: 'center',
  },
  retryButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    top: '50%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default VideoItem;