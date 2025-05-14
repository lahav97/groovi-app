/**
 * @module FeedScreen
 * Displays a vertically scrollable video feed, allowing swipe to switch between videos.
 * Implements infinite loading to fetch more videos as the user scrolls.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, FlatList, Dimensions, StyleSheet, ActivityIndicator, Text } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVideos } from '../../services/videoService';
import { useFocusEffect } from '@react-navigation/native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FeedScreen = () => {
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastVideoId, setLastVideoId] = useState(null);
  
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  
  // Calculate exact video height to fit the screen perfectly
  const videoHeight = SCREEN_HEIGHT - insets.bottom;
  
  // Track touch positions and scroll state
  const touchStartRef = useRef(0);
  const isScrollingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  
  /**
   * Fetch videos from the API
   */
  const loadVideos = useCallback(async (refresh = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // If refreshing, use null for lastVideoId, otherwise use the current lastVideoId
      const lastId = refresh ? null : (videos.length > 0 ? videos[videos.length - 1].user_id : null);
      
      const newVideos = await fetchVideos(lastId);
      
      if (refresh) {
        setVideos(newVideos);
      } else {
        // Append new videos to existing list, avoiding duplicates by user_id
        const uniqueNewVideos = newVideos.filter(
          newVideo => !videos.some(existingVideo => existingVideo.user_id === newVideo.user_id)
        );
        setVideos(prev => [...prev, ...uniqueNewVideos]);
      }
      
      // Store the ID of the last video for pagination
      if (newVideos.length > 0) {
        setLastVideoId(newVideos[newVideos.length - 1].user_id);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, videos]);
  
  // Load initial videos when the component mounts
  useEffect(() => {
    if (isInitialLoadRef.current) {
      loadVideos(true);
      isInitialLoadRef.current = false;
    }
  }, [loadVideos]);
  
  // Refresh videos when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isInitialLoadRef.current && videos.length === 0) {
        loadVideos(true);
      }
    }, [loadVideos, videos.length])
  );
  
  /**
   * Handle viewable items change - core pagination logic
   */
  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      if (newIndex !== currentVisibleIndex) {
        setCurrentVisibleIndex(newIndex);
        
        // Load more videos when the user reaches the 3rd video from the end
        if (newIndex >= videos.length - 3 && !loading) {
          loadVideos();
        }
      }
    }
  }).current;

  const viewConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 100
  }).current;

  /**
   * Handle touch start - record initial position
   */
  const handleTouchStart = (e) => {
    const touchY = e.nativeEvent.pageY;
    touchStartRef.current = touchY;
  };

  /**
   * Handle touch end - determine scroll direction and navigate
   */
  const handleTouchEnd = (e) => {
    // Prevent rapid consecutive scrolls
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 300 || isScrollingRef.current) {
      return;
    }
    
    const touchEndY = e.nativeEvent.pageY;
    const diff = touchStartRef.current - touchEndY;
    
    // Only respond to deliberate swipes (not small movements or taps)
    if (Math.abs(diff) < 20) {
      return;
    }
    
    isScrollingRef.current = true;
    lastScrollTimeRef.current = now;
    
    if (diff > 0) { 
      // Swipe UP - move to next video (higher index)
      moveToIndex(currentVisibleIndex + 1);
    } else { 
      // Swipe DOWN - move to previous video (lower index)
      moveToIndex(currentVisibleIndex - 1);
    }
  };

  /**
   * Move to a specific index with bounds checking
   */
  const moveToIndex = (index) => {
    // Ensure index is within bounds
    if (index < 0) {
      index = 0;  // Clamp to first video
    } else if (index >= videos.length) {
      index = videos.length - 1;  // Clamp to last video
    }
    
    // Use scrollToOffset for precise positioning
    if (index !== currentVisibleIndex) {
      flatListRef.current?.scrollToOffset({
        offset: index * videoHeight,
        animated: true
      });
      setCurrentVisibleIndex(index);
      
      // Load more videos when reaching the third video from the end
      if (index >= videos.length - 3 && !loading) {
        loadVideos();
      }
    }
    
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 300);
  };

  /**
   * Enforce perfect alignment whenever needed
   */
  const enforcePerfectAlignment = () => {
    moveToIndex(currentVisibleIndex);
  };

  // Ensure perfect alignment when component mounts or dimensions change
  useEffect(() => {
    if (flatListRef.current && videos.length > 0) {
      enforcePerfectAlignment();
    }
  }, [videoHeight, insets, videos.length]);

  /**
   * Handle any end of scrolling to enforce proper alignment
   */
  const handleScrollEnd = () => {
    enforcePerfectAlignment();
  };

  // Show loading indicator for initial load
  if (loading && videos.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Show error message if there was an error loading videos
  if (error && videos.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video Feed */}
      <View style={styles.feedContainer}>
        {videos.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={videos}
            ListFooterComponent={
              loading ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="large" color="white" />
                </View>
              ) : (
                <View style={{ height: 55 }} />
              )
            }
            renderItem={({ item, index }) => (
              <VideoItem
                item={{
                  id: item.user_id,
                  user: item.username,
                  description: `Playing ${item.instruments?.join(', ')}`,
                  videoUrl: item.video_url,
                  likes: Math.floor(Math.random() * 100), // Placeholder likes
                  comments: Math.floor(Math.random() * 50), // Placeholder comments
                }}
                isVisible={index === currentVisibleIndex && isFocused}
                height={videoHeight}
              />
            )}
            scrollEnabled={false} // Disable default scrolling - we handle it manually
            onViewableItemsChanged={onViewRef}
            viewabilityConfig={viewConfigRef}
            onMomentumScrollEnd={handleScrollEnd}
            getItemLayout={(data, index) => ({
              length: videoHeight,
              offset: videoHeight * index,
              index,
            })}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={0}
            maxToRenderPerBatch={3}
            windowSize={5}
            keyExtractor={(item, index) => `${item.user_id}-${index}`}
            />
        ) : null}
      </View>

      {/* Top Navigation */}
      <View style={[styles.topNavContainer, { top: insets.top }]}>
        <TopBar />
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
        <BottomNavigation />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  feedContainer: {
    flex: 1,
    position: 'relative',
  },
  topNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    zIndex: 10,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoading: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default FeedScreen;