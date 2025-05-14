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

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoItem = ({ item, isVisible, height }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const initialLoadRef = useRef(true);
  const retryCountRef = useRef(0);
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  
  // Function to download and cache the video locally
  const cacheVideo = async (videoUrl) => {
    try {
      // Create a unique filename based on the video URL
      const filename = videoUrl.split('/').pop();
      const localUri = `${FileSystem.cacheDirectory}videos/${filename}`;
      
      // Check if directory exists, if not create it
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
      }

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        console.log('Video already cached');
        setLocalVideoUri(localUri);
        return localUri;
      }
      
      // Download the file
      console.log(`Downloading video from ${videoUrl} to ${localUri}`);
      const downloadResult = await FileSystem.downloadAsync(videoUrl, localUri);
      
      if (downloadResult.status === 200) {
        console.log('Video successfully cached');
        setLocalVideoUri(localUri);
        return localUri;
      } else {
        console.error('Error caching video:', downloadResult);
        setLocalVideoUri(null);
        return null;
      }
    } catch (error) {
      console.error('Error in cacheVideo:', error);
      setLocalVideoUri(null);
      return null;
    }
  };

  // Load and cache the video when the component mounts or video URL changes
  useEffect(() => {
    if (item.videoUrl) {
      cacheVideo(item.videoUrl);
    }
  }, [item.videoUrl]);

  useEffect(() => {
    let timeout;
    if (showPlayIcon) {
      timeout = setTimeout(() => setShowPlayIcon(false), 1000);
    }
    return () => clearTimeout(timeout);
  }, [showPlayIcon]);

  // Handle video visibility state changes
  useEffect(() => {
    if ((!isVisible || !isFocused) && videoRef.current) {
      videoRef.current.pauseAsync();
    } else if (isVisible && isFocused && videoRef.current && !paused) {
      // Resume playback when becoming visible again
      videoRef.current.playAsync();
    }
  }, [isVisible, isFocused, paused]);

  // Set initial loading to false after 5 seconds at most
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && isPlaying) {
        setIsLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isLoading, isPlaying]);

  // Clear error state if successfully playing
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  const handleTogglePlayback = () => {
    setPaused(!paused);
    setShowPlayIcon(true);
  };

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
    setHasError(false);
    initialLoadRef.current = false;
    retryCountRef.current = 0; // Reset retry count on successful load
  };

  const handleVideoError = (error) => {
    console.error('Video error:', error);
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    retryLoadVideo();
  };

  const handlePlaybackStatusUpdate = (status) => {
    // Only show loading indicator on initial load or if truly stalled
    // and don't show it if the video is already playing for a while
    if (status.isLoaded) {
      // Update playing state
      setIsPlaying(status.isPlaying && !status.isPaused);
      
      if (status.isPlaying && !initialLoadRef.current) {
        // Once it starts playing, hide loading indicator quickly
        setIsLoading(false);
        setHasError(false); // Clear any error once playback starts
      }
      
      // Auto-repeat if video ends (as a backup to isLooping prop)
      if (status.didJustFinish && !status.isLooping) {
        videoRef.current?.replayAsync();
      }
    }
  };

  const retryLoadVideo = async () => {
    setIsLoading(true);
    
    // Increment retry counter
    retryCountRef.current += 1;
    const maxRetries = 5;
    
    // If we've tried too many times, show error state but don't retry again automatically
    if (retryCountRef.current > maxRetries) {
      console.log(`Exceeded maximum retries (${maxRetries})`);
      setHasError(true);
      setIsLoading(false);
      return;
    }
    
    try {
      // Try to reload from cache first
      if (item.videoUrl) {
        console.log(`Retry attempt ${retryCountRef.current} for video ${item.id}`);
        
        // Try local URI first if available
        if (localVideoUri) {
          try {
            if (videoRef.current) {
              await videoRef.current.unloadAsync();
              await videoRef.current.loadAsync({ uri: localVideoUri }, {}, false);
              await videoRef.current.playAsync();
            }
            return;
          } catch (cacheError) {
            console.error('Error loading from cache, trying original URL:', cacheError);
          }
        }
        
        // If no local URI or it failed, try downloading again
        const cachedUri = await cacheVideo(item.videoUrl);
        if (cachedUri) {
          // If we have the video locally, use it
          if (videoRef.current) {
            await videoRef.current.unloadAsync();
            await videoRef.current.loadAsync({ uri: cachedUri }, {}, false);
            await videoRef.current.playAsync();
          }
        } else {
          // Fall back to original URL
          if (videoRef.current) {
            await videoRef.current.unloadAsync();
            await videoRef.current.loadAsync({ uri: item.videoUrl }, {}, false);
            await videoRef.current.playAsync();
          }
        }
      }
    } catch (e) {
      console.error('Error retrying video load:', e);
      setHasError(true);
      setIsLoading(false);
      
      // If we still have retries left, try again after a short delay
      if (retryCountRef.current < maxRetries) {
        setTimeout(() => {
          retryLoadVideo();
        }, 1000); // 1 second delay between retries
      }
    }
  };

  // Hide the error message after a few seconds
  useEffect(() => {
    let errorTimeout;
    if (hasError) {
      errorTimeout = setTimeout(() => {
        // Only clear the error visually if we're not still attempting to retry
        if (retryCountRef.current >= 5) {
          setHasError(false);
        }
      }, 3000);
    }
    return () => clearTimeout(errorTimeout);
  }, [hasError]);

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
          progressUpdateIntervalMillis={500}
          positionMillis={0}
          rate={1.0}
          volume={1.0}
          // Increased buffer size for smoother playback
          bufferConfig={{
            minBufferMs: 15000,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 5000
          }}
        />

        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <Icon
              name={paused ? 'play' : 'pause'}
              size={70}
              color={COLOR.icon}
              style={styles.playIcon}
            />
          </View>
        )}

        {/* Only show loading indicator during initial load or genuine errors */}
        {isLoading && !isPlaying && !showPlayIcon && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Auto-retry button that triggers automatically, but can be pressed manually too */}
        {hasError && retryCountRef.current >= 5 && (
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            retryCountRef.current = 0; // Reset retry counter on manual retry
            retryLoadVideo();
          }}>
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
    top: '45%',
    left: '45%',
    zIndex: 10,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 40,
    left: 18,
  },
  interactionButtons: {
    position: 'absolute',
    right: 20,
    bottom: 180,
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 15,
  },
  iconText: {
    fontSize: 12,
    marginTop: 5,
  },
  playIcon: {
    alignSelf: 'center',
  },
  retryButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default VideoItem;