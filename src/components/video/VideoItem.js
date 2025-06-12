import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import VideoInfo from './VideoInfo';
import * as FileSystem from 'expo-file-system';
import { handleError } from '../../utils/errors';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoItem = ({ item, isVisible, height, shouldCache = false }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Essential refs for stability
  const retryCountRef = useRef(0);
  const componentMountedRef = useRef(true);
  const cacheAttemptedRef = useRef(false);
  const isUserActionRef = useRef(false);
  
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  
  // Smart video caching - only for priority videos
  const cacheVideo = async (videoUrl) => {
    if (!shouldCache || cacheAttemptedRef.current || !componentMountedRef.current) return null;
    cacheAttemptedRef.current = true;
    
    try {
      const filename = videoUrl.split('/').pop() || `video_${Date.now()}.mp4`;
      const localUri = `${FileSystem.cacheDirectory}videos/${filename}`;
      
      // Check if directory exists, create if not
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
      }

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists && componentMountedRef.current) {
        setLocalVideoUri(localUri);
        console.log('⚡ VideoItem: Using cached video');
        return localUri;
      }
      
      // Download only for priority videos
      if (shouldCache) {
        console.log('📥 VideoItem: Caching priority video...');
        const downloadResult = await FileSystem.downloadAsync(videoUrl, localUri);
        
        if (downloadResult.status === 200 && componentMountedRef.current) {
          setLocalVideoUri(localUri);
          console.log('✅ VideoItem: Video cached successfully');
          return localUri;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ VideoItem: Cache error:', handleError(error, 'VideoItem/cacheVideo'));
      return null;
    }
  };

  // Load and cache only when needed
  useEffect(() => {
    if (item.videoUrl && shouldCache && componentMountedRef.current) {
      cacheVideo(item.videoUrl);
    }
  }, [item.videoUrl, shouldCache]);

  // Simple show play icon logic (like old version)
  useEffect(() => {
    if (showPlayIcon) {
      const timeout = setTimeout(() => {
        if (componentMountedRef.current) {
          setShowPlayIcon(false);
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [showPlayIcon]);

  // Simplified visibility handling (like old version but with safety)
  useEffect(() => {
    // Reset user action flag on visibility change
    isUserActionRef.current = false;
    
    if ((!isVisible || !isFocused) && videoRef.current && componentMountedRef.current) {
      videoRef.current.pauseAsync().catch(() => {
        // Silent fail on cleanup
      });
    } else if (isVisible && isFocused && videoRef.current && !paused && componentMountedRef.current) {
      videoRef.current.playAsync().catch(() => {
        // Silent fail on cleanup
      });
    }
  }, [isVisible, isFocused, paused]);

  // Simplified loading timeout (like old version)
  useEffect(() => {
    if (isLoading && isPlaying && componentMountedRef.current) {
      const timer = setTimeout(() => {
        if (componentMountedRef.current) {
          setIsLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isPlaying]);

  // Clear error when playing (like old version)
  useEffect(() => {
    if (isPlaying && hasError && componentMountedRef.current) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  const handleTogglePlayback = async () => {
    if (!componentMountedRef.current) return;
    
    // Mark as user action (not scroll action)
    isUserActionRef.current = true;
    
    try {
      if (videoRef.current) {
        if (paused) {
          await videoRef.current.playAsync();
        } else {
          await videoRef.current.pauseAsync();
        }
        
        setPaused(!paused);
        setShowPlayIcon(true); // Always show for user actions
      }
    } catch (error) {
      console.error('❌ VideoItem: Playback toggle error:', handleError(error, 'VideoItem/handleTogglePlayback'));
    }
  };

  const handleVideoLoad = () => {
    if (!componentMountedRef.current) return;
    
    setTimeout(() => {
      if (componentMountedRef.current) {
        setIsLoading(false);
      }
    }, 200);
    setHasError(false);
    retryCountRef.current = 0;
  };

  const handleVideoError = (error) => {
    if (!componentMountedRef.current) return;
    
    const errorString = error?.toString() || '';
    
    // If using cached video and getting j7.x$b error, handle COMPLETELY silently
    if (localVideoUri && errorString.includes('j7.x$b')) {
      console.log('🚫 VideoItem: Corrupted cache detected, silent recovery in progress...');
      setLocalVideoUri(null); // Clear corrupted cache
      cacheAttemptedRef.current = false; // Allow re-caching later
      
      // Try original URL immediately WITHOUT any error state changes
      tryOriginalUrl();
      return;
    }
    
    // Use handleError for logging
    console.error('❌ VideoItem: Video error:', handleError(error, 'VideoItem/handleVideoError'));
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    retryLoadVideo();
  };

  // New function to try original URL when cache is corrupted (SILENTLY)
  const tryOriginalUrl = async () => {
    if (!componentMountedRef.current) return;
    
    // DON'T show loading or error states - keep current video state
    console.log('🔄 VideoItem: Trying original URL after cache failure (silent)');
    
    try {
      if (videoRef.current && componentMountedRef.current) {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ uri: item.videoUrl }, {}, false);
        
        // If user is currently viewing this video, start playing
        if (isVisible && isFocused && !paused) {
          await videoRef.current.playAsync();
        }
      }
    } catch (e) {
      console.error('❌ VideoItem: Original URL also failed:', handleError(e, 'VideoItem/tryOriginalUrl'));
      // Only NOW show error states
      if (componentMountedRef.current) {
        setHasError(true);
        setIsLoading(false);
        // Start normal retry process
        retryLoadVideo();
      }
    }
  };

  const handlePlaybackStatusUpdate = (status) => {
    if (!componentMountedRef.current) return;
    
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying && !status.isPaused);
      
      if (status.isPlaying) {
        setIsLoading(false);
        setHasError(false);
      }
      
      // Auto-repeat when video ends
      if (status.didJustFinish && !status.isLooping && videoRef.current) {
        videoRef.current.replayAsync().catch(() => {
          // Silent fail
        });
      }
    }
  };

  const retryLoadVideo = async () => {
    if (!componentMountedRef.current) return;
    
    retryCountRef.current += 1;
    const maxRetries = 3;
    
    if (retryCountRef.current > maxRetries) {
      console.log('❌ VideoItem: Max retries exceeded');
      setHasError(true);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`🔄 VideoItem: Retry attempt ${retryCountRef.current}`);
      
      if (videoRef.current && componentMountedRef.current) {
        await videoRef.current.unloadAsync();
        
        // Always use original URL for retries (don't retry corrupted cache)
        const videoSource = item.videoUrl;
        await videoRef.current.loadAsync({ uri: videoSource }, {}, false);
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.error('❌ VideoItem: Retry failed:', handleError(e, 'VideoItem/retryLoadVideo'));
      if (componentMountedRef.current) {
        setHasError(true);
        setIsLoading(false);
        
        if (retryCountRef.current < maxRetries) {
          setTimeout(() => {
            if (componentMountedRef.current) {
              retryLoadVideo();
            }
          }, 1000);
        }
      }
    }
  };

  // Auto-clear error after delay (like old version)
  useEffect(() => {
    if (hasError) {
      const errorTimeout = setTimeout(() => {
        if (retryCountRef.current >= 3 && componentMountedRef.current) {
          setHasError(false);
        }
      }, 2000);
      return () => clearTimeout(errorTimeout);
    }
  }, [hasError]);

  // Component cleanup
  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
      
      // Safe video cleanup
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {
          // Silent fail on cleanup
        });
      }
    };
  }, []);

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <Video
          ref={videoRef}
          source={{ uri: localVideoUri || item.videoUrl }}
          style={styles.videoPlayer}
          resizeMode="cover"
          shouldPlay={isVisible && isFocused && !paused}
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={2000}
          rate={1.0}
          volume={1.0}
          // Buffer config for smoother playback
          bufferConfig={{
            minBufferMs: 10000,
            maxBufferMs: 30000,
            bufferForPlaybackMs: 2000,
            bufferForPlaybackAfterRebufferMs: 3000
          }}
          // Prevent video component from showing its own error UI
          useNativeControls={false}
          ignoreSilentSwitch="ignore"
        />

        {/* Only show play icon for user actions (not scroll actions) */}
        {showPlayIcon && isUserActionRef.current && (
          <View style={styles.centerOverlay}>
            <View style={styles.playIconBackground}>
              <Icon
                name={paused ? 'play' : 'pause'}
                size={60}
                color="white"
                style={styles.playIcon}
              />
            </View>
          </View>
        )}

        {/* Show loading only when truly needed */}
        {isLoading && !isPlaying && !showPlayIcon && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Manual retry button for failed videos */}
        {hasError && retryCountRef.current >= 3 && (
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            retryCountRef.current = 0;
            setLocalVideoUri(null); // Clear potentially corrupted cache
            cacheAttemptedRef.current = false; // Allow re-caching
            retryLoadVideo();
          }}>
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        <VideoInfo video={{ username: item.user, description: item.description }} />
      </View>
    </TouchableWithoutFeedback>
  );
};

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
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 10,
  },
  playIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
});

export default VideoItem;