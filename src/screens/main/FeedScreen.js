/**
 * @module FeedScreen
 * TikTok-style video feed with completely separated video management
 * Feed videos are managed independently from profile videos
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, FlatList, Dimensions, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVideos, resetVideoState,forceResetHasMoreVideos, hasMoreVideos as checkHasMoreVideos } from '../../services/videoService';
import { getFeedCache, cacheFeedVideos } from '../../utils/cacheManager';
import BackgroundDataService from '../../services/BackgroundDataService';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// FEED-ONLY configuration - completely separate from profile videos
const FEED_CONFIG = {
  INITIAL_VIDEOS: 5,
  BATCH_SIZE: 5,
  MAX_FEED_VIDEOS: 10,
  CLEANUP_AT: 10,
  LOAD_WHEN: 2,
  MIN_THROTTLE: 300,
};

const FeedScreen = () => {
  // Core state - ONLY for feed videos
  const [feedVideos, setFeedVideos] = useState([]); // Renamed for clarity
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
  const lastLoggedRenderIndex = useRef(null); // Ref to track the last index we logged a render for

  const videoHeight = SCREEN_HEIGHT - insets.bottom;

  // ============================================================================
  // FEED VIDEO LOADING FUNCTIONS (SEPARATE FROM PROFILE)
  // ============================================================================

  const loadInitialFeedVideos = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    console.log('🚀 FeedScreen: Loading initial FEED videos (separate from profile)...');
    setIsInitialLoading(true);
    setError(null);
    isLoadingRef.current = true;
    loadAttempts.current = 0;

    try {
      // STEP 1: Check FEED cache first (separate from profile cache)
      console.log('📦 FeedScreen: Checking FEED cache...');
      const cachedFeedVideos = await getFeedCache();
      
      if (cachedFeedVideos && cachedFeedVideos.length > 0) {
        console.log(`⚡ FeedScreen: Using ${cachedFeedVideos.length} cached FEED videos`);
        setFeedVideos(cachedFeedVideos);
        setCurrentPage(Math.ceil(cachedFeedVideos.length / FEED_CONFIG.BATCH_SIZE));
        setHasMoreVideos(checkHasMoreVideos());
        setIsInitialLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // STEP 2: Load from API (FEED videos only)
      console.log('📡 FeedScreen: Loading FEED videos from API...');
      resetVideoState();
      const initialFeedVideos = await fetchVideos(0, FEED_CONFIG.INITIAL_VIDEOS);
      
      if (!mountedRef.current) return;
      
      if (initialFeedVideos && initialFeedVideos.length > 0) {
        console.log(`✅ FeedScreen: Got ${initialFeedVideos.length} initial FEED videos`);
        console.log(`🔍 DEBUG: Initial FEED videos:`, initialFeedVideos.map(v => ({ 
          id: v.id || v.user_id, 
          user: v.username || v.user, 
          hasUrl: !!(v.video_url || v.videoUrl) 
        })));
        
        setFeedVideos(initialFeedVideos);
        setCurrentPage(1);
        setCurrentVisibleIndex(0);
        
        const serviceHasMore = checkHasMoreVideos();
        setHasMoreVideos(serviceHasMore);
        console.log(`📊 FeedScreen: Service reports hasMore: ${serviceHasMore}`);
        
        // Cache FEED videos separately
        await cacheFeedVideos(initialFeedVideos);
        console.log('💾 FeedScreen: FEED videos cached separately from profile');
      } else {
        console.log('❌ FeedScreen: No initial FEED videos received');
        setError('No videos available');
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error('❌ FeedScreen: Failed to load initial FEED videos:', err);
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

  const loadMoreFeedVideos = useCallback(async () => {
    // Safety checks
    if (isLoadingRef.current || !mountedRef.current || isLoadingMore) {
      console.log('⏸️ FeedScreen: Skipping FEED load - already loading');
      return;
    }

    // Check if service says we have more videos
    const serviceHasMore = checkHasMoreVideos();
    if (!serviceHasMore && !hasMoreVideos) {
      console.log('⏸️ FeedScreen: Service says no more FEED videos available');
      return;
    }

    // Throttling for FEED videos only
    const now = Date.now();
    if (now - lastScrollTimeRef.current < FEED_CONFIG.MIN_THROTTLE) {
      console.log('⏸️ FeedScreen: FEED loading throttled');
      // 🧪 Prevent getting stuck by allowing retry soon
      setTimeout(() => {
        loadMoreFeedVideos();
      }, FEED_CONFIG.MIN_THROTTLE);
      return;
    }

    loadAttempts.current += 1;
    console.log(`📡 FeedScreen: Loading more FEED videos (page ${currentPage}, attempt ${loadAttempts.current})...`);
    setIsLoadingMore(true);
    isLoadingRef.current = true;
    lastScrollTimeRef.current = now;

    try {
      const lastVideo = feedVideos[feedVideos.length - 1];
      const lastId = lastVideo?.id || lastVideo?.user_id || 0;
      console.log(`📡 FeedScreen: Calling fetchVideos(${currentPage}, ${FEED_CONFIG.BATCH_SIZE}) for FEED`);
      const moreFeedVideos = await fetchVideos(currentPage, FEED_CONFIG.BATCH_SIZE);
      console.log(`📡 FeedScreen: fetchVideos returned ${moreFeedVideos?.length || 0} FEED videos`);
      
      if (!mountedRef.current) return;
      
      if (moreFeedVideos && moreFeedVideos.length > 0) {
        console.log(`✅ FeedScreen: Got ${moreFeedVideos.length} more FEED videos`);
        loadAttempts.current = 0;
        
        setFeedVideos(prevFeedVideos => {
          const updatedFeedVideos = [...prevFeedVideos, ...moreFeedVideos];
          console.log(`📊 FeedScreen: Total FEED videos now: ${updatedFeedVideos.length}`);

          // FEED-ONLY memory management (profile videos don't interfere)
          if (updatedFeedVideos.length >= FEED_CONFIG.MAX_FEED_VIDEOS) {
            const keepCount = FEED_CONFIG.CLEANUP_AT;
            const cleanedFeedVideos = updatedFeedVideos.slice(-keepCount);
            
            console.log(`🧹 FeedScreen: FEED memory cleanup: ${updatedFeedVideos.length} → ${cleanedFeedVideos.length} FEED videos`);
            console.log('💡 FeedScreen: Profile videos are NOT affected by this cleanup');
            
            // Adjust current index after cleanup
            const removedCount = updatedFeedVideos.length - cleanedFeedVideos.length;
            setCurrentVisibleIndex(prevIndex => {
              const newIndex = Math.max(0, prevIndex - removedCount);
              console.log(`📍 FeedScreen: FEED index adjusted: ${prevIndex} → ${newIndex}`);
              
              // Scroll to new position
              setTimeout(() => {
                if (flatListRef.current && mountedRef.current) {
                  try {
                    flatListRef.current.scrollToOffset({
                      offset: newIndex * videoHeight,
                      animated: false
                    });
                  } catch (scrollError) {
                    console.log('⚠️ FeedScreen: Scroll adjustment failed:', scrollError);
                  }
                }
              }, 100);
              
              return newIndex;
            });
            
            // Cache cleaned FEED videos
            cacheFeedVideos(cleanedFeedVideos);
            return cleanedFeedVideos;
          }

          // Cache all FEED videos
          cacheFeedVideos(updatedFeedVideos);
          return updatedFeedVideos;
        });

        setCurrentPage(prev => prev + 1);
        
        const serviceHasMore = checkHasMoreVideos();
        setHasMoreVideos(serviceHasMore);
        console.log(`📊 FeedScreen: Updated hasMore to: ${serviceHasMore}`);
        
      } else {
        console.log('🏁 FeedScreen: No more FEED videos received');
        
        if (loadAttempts.current < 3) {
          console.log(`🔄 FeedScreen: Retrying FEED load (attempt ${loadAttempts.current}/3)...`);
        } else {
          console.log('🏁 FeedScreen: Max attempts reached, no more FEED videos');
          setHasMoreVideos(false);
        }
      }
    } catch (err) {
      console.error('❌ FeedScreen: Failed to load more FEED videos:', err);
      
      if (loadAttempts.current < 3) {
        console.log(`🔄 FeedScreen: Will retry FEED after error (attempt ${loadAttempts.current}/3)`);
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
  // TOUCH HANDLING LOGIC (FOR FEED VIDEOS ONLY)
  // ============================================================================

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentVisibleIndex) {
        console.log(`🔍 DEBUG: FEED videos.length = ${feedVideos.length}, FEED videos =`, feedVideos.map(v => ({ 
          id: v.id || v.user_id, 
          user: v.username || v.user 
        })));
        console.log(`📍 FeedScreen: Current FEED video index: ${newIndex + 1}/${feedVideos.length}`);
        console.log(`🔍 DEBUG: hasMoreFeedVideos state = ${hasMoreVideos}, checkHasMoreVideos() = ${checkHasMoreVideos()}`);
        
        setCurrentVisibleIndex(newIndex);
        
        // Check if we need to load more FEED videos
        const feedVideosRemaining = feedVideos.length - newIndex - 1;
        console.log(`🔍 FeedScreen: FEED videos remaining: ${feedVideosRemaining}`);
        
        // Load more FEED videos when needed
        const shouldLoadMore = (
          feedVideosRemaining <= FEED_CONFIG.LOAD_WHEN && 
          (hasMoreVideos || checkHasMoreVideos()) && 
          !isLoadingMore
        );
        
        console.log(`🔍 DEBUG: shouldLoadMore FEED = ${shouldLoadMore} (remaining: ${feedVideosRemaining}, hasMore: ${hasMoreVideos}, serviceHasMore: ${checkHasMoreVideos()}, loading: ${isLoadingMore})`);
        
        if (shouldLoadMore) {
          console.log(`🔄 FeedScreen: Near end of FEED (${feedVideosRemaining} videos left), loading more...`);
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
      console.log(`🔄 FeedScreen: Moving to FEED video ${index + 1}/${feedVideos.length}, Target Offset: ${targetOffset}`);
      
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true
      });
      setCurrentVisibleIndex(index);

      // ✅ MANUAL LOAD CHECK (in case onViewableItemsChanged didn't fire)
      setTimeout(() => {
        const feedVideosRemaining = feedVideos.length - index - 1;
        const shouldLoadMore =
          feedVideosRemaining <= FEED_CONFIG.LOAD_WHEN &&
          (hasMoreVideos || checkHasMoreVideos()) &&
          !isLoadingMore;

        console.log(`🧪 Manual check after move: remaining=${feedVideosRemaining}, shouldLoadMore=${shouldLoadMore}`);
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
    console.log('🚀 FeedScreen: Component mounted, loading initial FEED videos...');
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
            console.log('⚠️ FeedScreen: Position restore failed:', err);
          }
        }
      }, 500);
    }
  }, [isFocused, feedVideos.length, currentVisibleIndex]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const handleRetry = useCallback(() => {
    console.log('🔄 FeedScreen: Retrying FEED video load...');
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
      {/* DEBUG: Log current FEED state */}
      {console.log(`🔍 RENDER DEBUG: FEED videos.length = ${feedVideos.length}, currentIndex = ${currentVisibleIndex}, hasMore = ${hasMoreVideos}`)}
      
      <View style={styles.feedContainer}>
        <FlatList
          ref={flatListRef}
          data={feedVideos}
          ListFooterComponent={
            <View style={{ height: 55 }}>
              {isLoadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#ff6ec4" />
                  <Text style={styles.loadingMoreText}>Loading more videos...</Text>
                </View>
              )}
              {!hasMoreVideos && !isLoadingMore && feedVideos.length > 0 && (
                <View style={styles.endContainer}>
                  <Text style={styles.endText}>You've seen all {feedVideos.length} feed videos! 🎉</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            // Log only when the currently visible video's render is processed for the first time at this index
            if (index === currentVisibleIndex && lastLoggedRenderIndex.current !== index) {
              console.log(`🎬 FeedScreen: Rendering FEED video ${index + 1}/${feedVideos.length}:`, {
                id: item.id || item.user_id,
                user: item.username || item.user,
                hasVideoUrl: !!(item.video_url || item.videoUrl),
              });
              lastLoggedRenderIndex.current = index; // Update the ref
            }

            return (
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
              />
            );
          }}
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
          maxToRenderPerBatch={3}
          windowSize={5}
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

export default FeedScreen;