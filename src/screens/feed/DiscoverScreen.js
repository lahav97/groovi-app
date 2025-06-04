import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, FlatList, Dimensions, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVideos, resetVideoState, forceResetHasMoreVideos, hasMoreVideos as checkHasMoreVideos } from '../../services/videoService';
import { getFeedCache, cacheFeedVideos } from '../../utils/cacheManager';
import BackgroundDataService from '../../services/BackgroundDataService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FEED_CONFIG = {
  INITIAL_VIDEOS: 5,
  BATCH_SIZE: 3,
  MAX_FEED_VIDEOS: 8,
  CLEANUP_AT: 6,
  LOAD_WHEN: 1, 
  MIN_THROTTLE: 200,
  CACHE_PRIORITY_COUNT: 3,
};

const DiscoverScreen = () => {
  const [feedVideos, setFeedVideos] = useState([]);
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [error, setError] = useState(null);

  // Refs for control
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const touchStartRef = useRef(0);
  const isScrollingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadAttempts = useRef(0);

  const videoHeight = SCREEN_HEIGHT - insets.bottom;

  // ============================================================================
  // OPTIMIZED FEED LOADING WITH BACKGROUND SERVICE COORDINATION
  // ============================================================================

  const loadInitialFeedVideos = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    console.log('🚀 DiscoverScreen: Starting optimized initial load...');
    setIsInitialLoading(true);
    setError(null);
    isLoadingRef.current = true;
    loadAttempts.current = 0;

    try {
      //Check if BackgroundDataService already loaded feed
      const backgroundStatus = BackgroundDataService.getSeparatedSystemStatus();
      if (backgroundStatus.feed.loaded && backgroundStatus.feed.videoCount > 0) {
        const cachedFeedVideos = await getFeedCache();
        
        if (cachedFeedVideos && cachedFeedVideos.length > 0) {
          setFeedVideos(cachedFeedVideos);
          setCurrentPage(Math.ceil(cachedFeedVideos.length / FEED_CONFIG.BATCH_SIZE));
          setHasMoreVideos(checkHasMoreVideos());
          setIsInitialLoading(false);
          isLoadingRef.current = false;
          
          // Start smart caching for priority videos
          setTimeout(() => startSmartCaching(cachedFeedVideos), 500);
          return;
        }
      }

      // Check cache if BackgroundService didn't load
      const cachedFeedVideos = await getFeedCache();
      if (cachedFeedVideos && cachedFeedVideos.length > 0) {
        setFeedVideos(cachedFeedVideos);
        setCurrentPage(Math.ceil(cachedFeedVideos.length / FEED_CONFIG.BATCH_SIZE));
        setHasMoreVideos(checkHasMoreVideos());
        setIsInitialLoading(false);
        isLoadingRef.current = false;
        
        // Start smart caching
        setTimeout(() => startSmartCaching(cachedFeedVideos), 500);
        return;
      }

      // Load from API
      resetVideoState();
      const initialFeedVideos = await fetchVideos(0, FEED_CONFIG.INITIAL_VIDEOS);
      
      if (!mountedRef.current) return;
      
      if (initialFeedVideos && initialFeedVideos.length > 0) {        
        setFeedVideos(initialFeedVideos);
        setCurrentPage(1);
        setCurrentVisibleIndex(0);
        setHasMoreVideos(checkHasMoreVideos());
        
        // Cache and start smart caching
        await cacheFeedVideos(initialFeedVideos);
        setTimeout(() => startSmartCaching(initialFeedVideos), 500);
      } else {
        console.log('❌ DiscoverScreen: No videos received');
        setError('No videos available');
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error('❌ DiscoverScreen: Failed to load videos:', err);
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

  // ============================================================================
  // SMART CACHING SYSTEM FOR TAB SWITCHING
  // ============================================================================

  const startSmartCaching = useCallback((videos) => {
    if (!videos || videos.length === 0) return;
        
    // Cache priority videos (first 3) for instant playback
    const priorityVideos = videos.slice(0, FEED_CONFIG.CACHE_PRIORITY_COUNT);
    priorityVideos.forEach((video, index) => {
      if (video.video_url || video.videoUrl) {
        // Trigger video caching in VideoItem
        // This will be handled by the VideoItem component
      }
    });
  }, []);

  const loadMoreFeedVideos = useCallback(async () => {
    if (isLoadingRef.current || !mountedRef.current || isLoadingMore) {
      return;
    }

    const serviceHasMore = checkHasMoreVideos();
    if (!serviceHasMore && !hasMoreVideos) {
      return;
    }

    const now = Date.now();
    if (now - lastScrollTimeRef.current < FEED_CONFIG.MIN_THROTTLE) {
      setTimeout(() => loadMoreFeedVideos(), FEED_CONFIG.MIN_THROTTLE);
      return;
    }

    loadAttempts.current += 1;
    setIsLoadingMore(true);
    isLoadingRef.current = true;
    lastScrollTimeRef.current = now;

    try {
      const moreFeedVideos = await fetchVideos(currentPage, FEED_CONFIG.BATCH_SIZE);
      
      if (!mountedRef.current) return;
      
      if (moreFeedVideos && moreFeedVideos.length > 0) {
        loadAttempts.current = 0;
        
        setFeedVideos(prevFeedVideos => {
          const updatedFeedVideos = [...prevFeedVideos, ...moreFeedVideos];

          // OPTIMIZED memory management
          if (updatedFeedVideos.length >= FEED_CONFIG.MAX_FEED_VIDEOS) {
            const cleanedFeedVideos = updatedFeedVideos.slice(-FEED_CONFIG.CLEANUP_AT);
                        
            // Adjust current index after cleanup
            const removedCount = updatedFeedVideos.length - cleanedFeedVideos.length;
            setCurrentVisibleIndex(prevIndex => {
              const newIndex = Math.max(0, prevIndex - removedCount);
              
              // Scroll to new position
              setTimeout(() => {
                if (flatListRef.current && mountedRef.current) {
                  try {
                    flatListRef.current.scrollToOffset({
                      offset: newIndex * videoHeight,
                      animated: false
                    });
                  } catch (scrollError) {
                    // Silent fail
                  }
                }
              }, 100);
              
              return newIndex;
            });
            
            cacheFeedVideos(cleanedFeedVideos);
            return cleanedFeedVideos;
          }

          cacheFeedVideos(updatedFeedVideos);
          return updatedFeedVideos;
        });

        setCurrentPage(prev => prev + 1);
        setHasMoreVideos(checkHasMoreVideos());
        
      } else {
        if (loadAttempts.current < 3) {
          // Retry logic
        } else {
          console.log('🏁 DiscoverScreen: No more videos available');
          setHasMoreVideos(false);
        }
      }
    } catch (err) {
      console.error('❌ DiscoverScreen: Failed to load more videos:', err);
      
      if (loadAttempts.current < 3) {
        // Retry logic
      } else {
        setHasMoreVideos(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
        isLoadingRef.current = false;
      }
    }
  }, [currentPage, hasMoreVideos, videoHeight]);

  // ============================================================================
  // OPTIMIZED TOUCH HANDLING
  // ============================================================================

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentVisibleIndex) {
        setCurrentVisibleIndex(newIndex);
        
        // Check if we need to load more videos
        const feedVideosRemaining = feedVideos.length - newIndex - 1;
        
        const shouldLoadMore = (
          feedVideosRemaining <= FEED_CONFIG.LOAD_WHEN && 
          (hasMoreVideos || checkHasMoreVideos()) && 
          !isLoadingMore
        );
        
        if (shouldLoadMore) {
          loadMoreFeedVideos();
        }
      }
    }
  }, [feedVideos, currentVisibleIndex, hasMoreVideos, isLoadingMore, loadMoreFeedVideos]);

  const viewConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 100
  });

  const handleTouchStart = (e) => {
    const touchY = e.nativeEvent.pageY;
    touchStartRef.current = touchY;
  };

  const handleTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 300 || isScrollingRef.current) {
      return;
    }
    
    const touchEndY = e.nativeEvent.pageY;
    const diff = touchStartRef.current - touchEndY;
    
    if (Math.abs(diff) < 20) {
      return;
    }
    
    isScrollingRef.current = false;
    lastScrollTimeRef.current = now;
    
    if (diff > 0) { 
      moveToIndex(currentVisibleIndex + 1);
    } else { 
      moveToIndex(currentVisibleIndex - 1);
    }
  };

  const moveToIndex = (index) => {
    if (index < 0) {
      index = 0;
    } else if (index >= feedVideos.length) {
      index = feedVideos.length - 1;
    }

    if (index !== currentVisibleIndex) {
      const targetOffset = index * videoHeight;
      
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true
      });
      setCurrentVisibleIndex(index);

      // Manual load check
      setTimeout(() => {
        const feedVideosRemaining = feedVideos.length - index - 1;
        const shouldLoadMore =
          feedVideosRemaining <= FEED_CONFIG.LOAD_WHEN &&
          (hasMoreVideos || checkHasMoreVideos()) &&
          !isLoadingMore;

        if (shouldLoadMore) {
          loadMoreFeedVideos();
        }
      }, 250);
    }
  };

  const enforcePerfectAlignment = () => {
    moveToIndex(currentVisibleIndex);
  };

  const handleScrollEnd = () => {
    enforcePerfectAlignment();
  };

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('🚀 DiscoverScreen: Component mounted');
    loadInitialFeedVideos();
  }, [loadInitialFeedVideos]);

  useEffect(() => {
    if (flatListRef.current && feedVideos.length > 0) {
      enforcePerfectAlignment();
    }
  }, [videoHeight, insets]);

  useEffect(() => {
    if (isFocused && feedVideos.length > 0 && currentVisibleIndex > 0) {
      setTimeout(() => {
        if (flatListRef.current && mountedRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: currentVisibleIndex,
              animated: false
            });
          } catch (err) {
            // Silent fail
          }
        }
      }, 500);
    }
  }, [isFocused, feedVideos.length, currentVisibleIndex]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const handleRetry = useCallback(() => {
    console.log('🔄 DiscoverScreen: Retrying...');
    setError(null);
    setHasMoreVideos(true);
    setCurrentPage(0);
    setFeedVideos([]);
    setCurrentVisibleIndex(0);
    loadAttempts.current = 0;
    
    BackgroundDataService.forceRefreshAll();
    loadInitialFeedVideos();
  }, [loadInitialFeedVideos]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isInitialLoading && feedVideos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff6ec4" />
        <Text style={styles.loadingText}>Loading your feed...</Text>
      </View>
    );
  }

  if (error && feedVideos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isInitialLoading && feedVideos.length === 0) {
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
    <View 
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <View style={styles.feedContainer}>
        <FlatList
          ref={flatListRef}
          data={feedVideos}
          ListFooterComponent={
            <View style={{ height: 55 }}>
              {isLoadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#ff6ec4" />
                  <Text style={styles.loadingMoreText}>Loading more...</Text>
                </View>
              )}
              {!hasMoreVideos && !isLoadingMore && feedVideos.length > 0 && (
                <View style={styles.endContainer}>
                  <Text style={styles.endText}>You've seen all videos! 🎉</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <VideoItem
              item={{
                id: item.id || item.user_id || `feed-video-${index}`,
                user: item.username || item.user || 'Unknown',
                description: Array.isArray(item.instruments) ? item.instruments.join(', ') : (item.instruments || 'Music Video'),
                videoUrl: item.video_url || item.videoUrl,
                likes: item.likes || Math.floor(Math.random() * 1000),
                comments: item.comments || Math.floor(Math.random() * 100),
              }}
              isVisible={index === currentVisibleIndex && isFocused}
              height={videoHeight}
              shouldCache={index < FEED_CONFIG.CACHE_PRIORITY_COUNT} // Smart caching flag
            />
          )}
          scrollEnabled={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(data, index) => ({
            length: videoHeight,
            offset: videoHeight * index,
            index,
          })}
          keyExtractor={(item, index) => 
            `feed-${item.id || item.user_id || 'video'}-${index}`
          }
          showsVerticalScrollIndicator={false}
          initialScrollIndex={0}
          maxToRenderPerBatch={2} // Optimized for performance
          windowSize={3} // Smaller window for better memory usage
          removeClippedSubviews={true} // Enable view recycling
          initialNumToRender={2} // Render fewer items initially
        />
      </View>

      <View style={[styles.topNavContainer, { top: insets.top }]}>
        <TopBar />
      </View>

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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadingMoreText: {
    color: '#ff6ec4',
    fontSize: 12,
    marginLeft: 8,
  },
  endContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  endText: {
    color: '#666',
    fontSize: 14,
  },
});

export default DiscoverScreen;