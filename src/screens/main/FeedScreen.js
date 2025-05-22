/**
 * @module FeedScreen
 * TikTok-style video feed with smooth infinite scrolling and smart memory management
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, FlatList, Dimensions, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVideos, resetVideoState } from '../../services/videoService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFIG = {
  INITIAL_VIDEOS: 5,
  BATCH_SIZE: 3,
  MAX_VIDEOS: 15,
  CLEANUP_AT: 12,
  LOAD_WHEN: 2,
  MIN_THROTTLE: 1500,
};

const FeedScreen = () => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [error, setError] = useState(null);

  // Refs for control
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const mountedRef = useRef(true);

  const videoHeight = SCREEN_HEIGHT - insets.bottom;

  // ============================================================================
  // VIDEO LOADING FUNCTIONS
  // ============================================================================

  const loadInitialVideos = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    console.log('🚀 Loading initial 5 videos');
    setIsInitialLoading(true);
    setError(null);
    isLoadingRef.current = true;

    try {
      resetVideoState();
      
      const initialVideos = await fetchVideos(0, CONFIG.INITIAL_VIDEOS);
      
      if (!mountedRef.current) return;
      
      if (initialVideos && initialVideos.length > 0) {
        console.log(`✅ Got ${initialVideos.length} initial videos`);
        setVideos(initialVideos);
        setCurrentPage(1);
        setCurrentIndex(0);
        setHasMoreVideos(initialVideos.length === CONFIG.INITIAL_VIDEOS);
        
        AsyncStorage.setItem('feed_cache', JSON.stringify(initialVideos));
      } else {
        console.log('❌ No initial videos received');
        setError('No videos available');
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error('❌ Failed to load initial videos:', err);
      if (mountedRef.current) {
        setError('Failed to load videos. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsInitialLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, []);

  const loadMoreVideos = useCallback(async () => {
    // Safety checks
    if (isLoadingRef.current || !hasMoreVideos || !mountedRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < CONFIG.MIN_THROTTLE) {
      console.log('⏸️ Throttled - too soon since last load');
      return;
    }

    console.log(`📡 Loading more videos (batch ${currentPage})...`);
    setIsLoadingMore(true);
    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      const moreVideos = await fetchVideos(currentPage, CONFIG.BATCH_SIZE);
      
      if (!mountedRef.current) return;
      
      if (moreVideos && moreVideos.length > 0) {
        console.log(`✅ Got ${moreVideos.length} more videos`);
        
        setVideos(prevVideos => {
          const updatedVideos = [...prevVideos, ...moreVideos];
          console.log(`📊 Total videos now: ${updatedVideos.length}`);

          // Smart memory management
          if (updatedVideos.length >= CONFIG.MAX_VIDEOS) {
            const keepCount = CONFIG.CLEANUP_AT;
            const cleanedVideos = updatedVideos.slice(-keepCount); // Keep last N videos
            
            console.log(`🧹 Memory cleanup: ${updatedVideos.length} → ${cleanedVideos.length} videos`);
            
            // Adjust current index after cleanup
            const removedCount = updatedVideos.length - cleanedVideos.length;
            setCurrentIndex(prevIndex => {
              const newIndex = Math.max(0, prevIndex - removedCount);
              console.log(`📍 Index adjusted: ${prevIndex} → ${newIndex}`);
              
              // Scroll to new position
              setTimeout(() => {
                if (flatListRef.current && mountedRef.current) {
                  try {
                    flatListRef.current.scrollToOffset({
                      offset: newIndex * videoHeight,
                      animated: false
                    });
                  } catch (scrollError) {
                    console.log('⚠️ Scroll adjustment failed:', scrollError);
                  }
                }
              }, 100);
              
              return newIndex;
            });
            
            return cleanedVideos;
          }

          return updatedVideos;
        });

        setCurrentPage(prev => prev + 1);
        setHasMoreVideos(moreVideos.length === CONFIG.BATCH_SIZE);
      } else {
        console.log('🏁 No more videos available');
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error('❌ Failed to load more videos:', err);
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
        isLoadingRef.current = false;
      }
    }
  }, [currentPage, hasMoreVideos, videoHeight]);

  // ============================================================================
  // SCROLL HANDLING
  // ============================================================================

  /**
   * Handle when user scrolls to different videos
   */
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      if (newIndex !== currentIndex && newIndex >= 0) {
        setCurrentIndex(newIndex);

        // Check if we need to load more videos
        const videosRemaining = videos.length - newIndex;
        if (videosRemaining <= CONFIG.LOAD_WHEN && hasMoreVideos) {
          console.log(`🔄 Near end (${videosRemaining} videos left), loading more...`);
          loadMoreVideos();
        }
      }
    }
  }, [currentIndex, videos.length, hasMoreVideos, loadMoreVideos]);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 300
  }).current;

  // ============================================================================
  // LIFECYCLE & INITIALIZATION
  // ============================================================================

  // Component mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadInitialVideos();
  }, [loadInitialVideos]);

  // Simple cache management
  useEffect(() => {
    if (videos.length > 0) {
      // Only cache the first 10 videos to keep cache size reasonable
      const videosToCache = videos.slice(0, 10);
      AsyncStorage.setItem('feed_cache', JSON.stringify(videosToCache));
      AsyncStorage.setItem('feed_index', currentIndex.toString());
    }
  }, [videos, currentIndex]);

  // Restore position when returning to screen
  useEffect(() => {
    if (isFocused && videos.length > 0 && currentIndex > 0) {
      setTimeout(() => {
        if (flatListRef.current && mountedRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: currentIndex,
              animated: false
            });
            console.log(`🎯 Restored to video ${currentIndex}`);
          } catch (err) {
            console.log('⚠️ Position restore failed:', err);
          }
        }
      }, 500);
    }
  }, [isFocused, videos.length, currentIndex]);

  // ============================================================================
  // ERROR HANDLING & RETRY
  // ============================================================================

  const handleRetry = useCallback(() => {
    setError(null);
    setHasMoreVideos(true);
    setCurrentPage(0);
    setVideos([]);
    loadInitialVideos();
  }, [loadInitialVideos]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Initial loading
  if (isInitialLoading && videos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff6ec4" />
        <Text style={styles.loadingText}>Loading your feed...</Text>
      </View>
    );
  }

  // Error state
  if (error && videos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (!isInitialLoading && videos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>No videos found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={({ item, index }) => {          
          return (
            <VideoItem
              item={{
                id: item.id || item.user_id || `video-${index}`,
                user: item.username || item.user || 'Unknown',
                description: Array.isArray(item.instruments) ? item.instruments.join(', ') : item.instruments,
                videoUrl: item.video_url || item.videoUrl,
                likes: item.likes || Math.floor(Math.random() * 1000),
                comments: item.comments || Math.floor(Math.random() * 100),
              }}
              isVisible={index === currentIndex && isFocused}
              height={videoHeight}
            />
          );
        }}
        keyExtractor={(item, index) => 
          `${item.id || item.user_id || 'video'}-${index}`
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        pagingEnabled={true}
        snapToInterval={videoHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(data, index) => ({
          length: videoHeight,
          offset: videoHeight * index,
          index,
        })}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        initialScrollIndex={0}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#ff6ec4" />
              <Text style={styles.footerText}>Loading more videos...</Text>
            </View>
          ) : !hasMoreVideos && videos.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>You've seen it all! 🎉</Text>
            </View>
          ) : null
        }
      />

      {/* Navigation overlays */}
      <View style={[styles.topNav, { top: insets.top }]}>
        <TopBar />
      </View>

      <View style={[styles.bottomNav, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'white',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#ff6ec4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 10,
  },
  footer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default FeedScreen;