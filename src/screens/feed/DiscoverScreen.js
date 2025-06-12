import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, FlatList, Dimensions, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  fetchInitialMusicians,
  loadMusicianWithoutFilters,
  fetchFilteredMusicians,
  resetVideoState, 
  forceResetHasMoreVideos 
} from '../../services/videoService';
import { getFeedCache, cacheFeedVideos } from '../../utils/cacheManager';
import BackgroundDataService from '../../services/BackgroundDataService';
import {
  AppError,
  ValidationError,
  NetworkError,
  PermissionError,
  AuthError,
  ERROR_MESSAGES,
  createValidationError,
  createNetworkError,
  createPermissionError,
  createAuthError,
  handleError
} from '../../utils/errors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MUSICIAN_CONFIG = {
  INITIAL_BATCH: 5,
  FILTER_BATCH: 3,
  WINDOW_BEHIND: 3,
  WINDOW_AHEAD: 8,
  PRELOAD_AHEAD: 3,
  LOAD_TRIGGER: 5,
  MIN_THROTTLE: 200,
};

const DiscoverScreen = () => {
  const [musicianVideos, setMusicianVideos] = useState([]);
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser] = useState('lahav97');

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

  const applySlidingWindowCache = useCallback((videos, currentIndex) => {
    const keepStart = Math.max(0, currentIndex - MUSICIAN_CONFIG.WINDOW_BEHIND);
    const keepEnd = currentIndex + MUSICIAN_CONFIG.WINDOW_AHEAD;
    const windowSize = MUSICIAN_CONFIG.WINDOW_BEHIND + MUSICIAN_CONFIG.WINDOW_AHEAD + 1;
    
    if (videos.length > windowSize) {
      const cleanedVideos = videos.slice(keepStart, Math.min(keepEnd, videos.length));
      
      console.log(`🎯 Cache: User at ${currentIndex}, keeping videos ${keepStart}-${Math.min(keepEnd-1, videos.length-1)} (${cleanedVideos.length} total)`);
      
      return {
        videos: cleanedVideos,
        indexAdjustment: keepStart
      };
    }
    
    return {
      videos: videos,
      indexAdjustment: 0
    };
  }, []);

  const loadInitialMusicianVideos = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    setIsInitialLoading(true);
    setError(null); 
    isLoadingRef.current = true;
    loadAttempts.current = 0;

    try {
      const backgroundStatus = BackgroundDataService.getSeparatedSystemStatus();
      if (backgroundStatus.feed.loaded && backgroundStatus.feed.videoCount > 0) {
        const cachedMusicianVideos = await getFeedCache();
        
        if (cachedMusicianVideos && cachedMusicianVideos.length > 0) {
          setMusicianVideos(cachedMusicianVideos);
          setIsInitialLoading(false);
          isLoadingRef.current = false;
          return;
        }
      }

      const cachedMusicianVideos = await getFeedCache();
      if (cachedMusicianVideos && cachedMusicianVideos.length > 0) {
        setMusicianVideos(cachedMusicianVideos);
        setIsInitialLoading(false);
        isLoadingRef.current = false;
        return;
      }

      resetVideoState();
      const musicians = await fetchInitialMusicians(currentUser);
      
      if (!mountedRef.current) return;
      
      if (musicians && musicians.length > 0) {
        const transformedVideos = musicians.map((musician, index) => ({
          id: musician.id,
          user_id: musician.id,
          username: musician.username,
          user: musician.username,
          video_url: musician.videos[0],
          videoUrl: musician.videos[0],
          instruments: musician.instruments,
          likes: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 100) + 10,
        }));
        
        setMusicianVideos(transformedVideos);
        setCurrentVisibleIndex(0);
        setHasMoreVideos(true);
        
        await cacheFeedVideos(transformedVideos);
        console.log(`✅ Initial load: ${transformedVideos.length} videos from ${musicians.length} musicians`);
      } else {
        console.log('❌ No musicians received');
        setError(ERROR_MESSAGES.NETWORK.NO_MUSICIANS);
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error('❌ Failed to load musicians:', err);
      if (mountedRef.current) {
        setError(handleError(err, 'DiscoverScreen/InitialLoad'));
      }
    } finally {
      if (mountedRef.current) {
        setIsInitialLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [currentUser]);

  const loadMoreMusicianVideos = useCallback(async () => {
    if (isLoadingRef.current || !mountedRef.current || isLoadingMore || !hasMoreVideos) {
      return;
    }

    const now = Date.now();
    if (now - lastScrollTimeRef.current < MUSICIAN_CONFIG.MIN_THROTTLE) {
      setTimeout(() => loadMoreMusicianVideos(), MUSICIAN_CONFIG.MIN_THROTTLE);
      return;
    }

    console.log(`📊 Loading more musicians. Current cache: ${musicianVideos.length}`);

    loadAttempts.current += 1;
    setIsLoadingMore(true);
    isLoadingRef.current = true;
    lastScrollTimeRef.current = now;

    try {
      console.log(`🔍 Loading more musicians for ${currentUser}`);
      const moreMusicians = await loadMusicianWithoutFilters(currentUser);
      
      if (!mountedRef.current) return;
      
      if (moreMusicians && moreMusicians.length > 0) {
        loadAttempts.current = 0;
        
        const transformedVideos = moreMusicians.map((musician, index) => ({
          id: `${musician.id}-${Date.now()}-${index}`,
          user_id: musician.id,
          username: musician.username,
          user: musician.username,
          video_url: musician.videos[0],
          videoUrl: musician.videos[0],
          instruments: musician.instruments,
          likes: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 100) + 10,
        }));
        
        setMusicianVideos(prevMusicianVideos => {
          const updatedMusicianVideos = [...prevMusicianVideos, ...transformedVideos];
          
          const { videos: cleanedVideos, indexAdjustment } = applySlidingWindowCache(
            updatedMusicianVideos, 
            currentVisibleIndex
          );
          
          if (indexAdjustment > 0) {
            setCurrentVisibleIndex(prevIndex => {
              const newIndex = Math.max(0, prevIndex - indexAdjustment);
              
              console.log(`📍 Index adjustment: ${prevIndex} -> ${newIndex} (removed ${indexAdjustment} videos)`);
              
              setTimeout(() => {
                if (flatListRef.current && mountedRef.current) {
                  try {
                    flatListRef.current.scrollToOffset({
                      offset: newIndex * videoHeight,
                      animated: false
                    });
                  } catch (scrollError) {
                    console.error('❌ Scroll adjustment error:', handleError(scrollError, 'DiscoverScreen/ScrollAdjust'));
                  }
                }
              }, 100);
              
              return newIndex;
            });
          }
          
          cacheFeedVideos(cleanedVideos);
          return cleanedVideos;
        });
        
        console.log(`✅ Loaded ${transformedVideos.length} more videos from musicians`);
        
      } else {
        if (loadAttempts.current < 3) {
          setTimeout(() => loadMoreMusicianVideos(), 2000);
        } else {
          console.log('🏁 No more musicians available');
          setHasMoreVideos(false);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load more musicians:', handleError(err, 'DiscoverScreen/LoadMore'));
      
      if (loadAttempts.current < 3) {
        setTimeout(() => loadMoreMusicianVideos(), 2000);
      } else {
        setHasMoreVideos(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
        isLoadingRef.current = false;
      }
    }
  }, [hasMoreVideos, videoHeight, musicianVideos.length, currentVisibleIndex, applySlidingWindowCache, currentUser]);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentVisibleIndex) {
        setCurrentVisibleIndex(newIndex);
        
        const remainingVideos = musicianVideos.length - newIndex - 1;
        
        const shouldLoadMore = (
          remainingVideos <= MUSICIAN_CONFIG.LOAD_TRIGGER && 
          hasMoreVideos && 
          !isLoadingMore
        );
        
        if (shouldLoadMore) {
          console.log(`🔄 Load trigger: ${remainingVideos} videos remaining`);
          loadMoreMusicianVideos();
        }
      }
    }
  }, [musicianVideos, currentVisibleIndex, hasMoreVideos, isLoadingMore, loadMoreMusicianVideos]);

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
    
    isScrollingRef.current = true;
    lastScrollTimeRef.current = now;
    
    if (diff > 0) { 
      moveToIndex(currentVisibleIndex + 1);
    } else { 
      moveToIndex(currentVisibleIndex - 1);
    }
    
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 500);
  };

  const moveToIndex = (index) => {
    if (index < 0) {
      index = 0;
    } else if (index >= musicianVideos.length) {
      index = musicianVideos.length - 1;
    }

    if (index !== currentVisibleIndex && flatListRef.current) {
      const targetOffset = index * videoHeight;
      
      try {
        flatListRef.current.scrollToOffset({
          offset: targetOffset,
          animated: true
        });
        setCurrentVisibleIndex(index);

        setTimeout(() => {
          const remainingVideos = musicianVideos.length - index - 1;
          const shouldLoadMore =
            remainingVideos <= MUSICIAN_CONFIG.LOAD_TRIGGER &&
            hasMoreVideos &&
            !isLoadingMore;

          if (shouldLoadMore) {
            console.log(`🔄 Post-scroll load trigger: ${remainingVideos} videos remaining`);
            loadMoreMusicianVideos();
          }
        }, 250);
      } catch (error) {
        console.error('❌ Scroll error:', error);
      }
    }
  };

  const enforcePerfectAlignment = () => {
    moveToIndex(currentVisibleIndex);
  };

  const handleScrollEnd = () => {
    enforcePerfectAlignment();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadInitialMusicianVideos();
  }, [loadInitialMusicianVideos]);

  useEffect(() => {
    if (flatListRef.current && musicianVideos.length > 0) {
      enforcePerfectAlignment();
    }
  }, [videoHeight, insets]);

  useEffect(() => {
    if (isFocused && musicianVideos.length > 0 && currentVisibleIndex > 0) {
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
  }, [isFocused, musicianVideos.length, currentVisibleIndex]);

  const handleRetry = useCallback(() => {
    console.log('🔄 Retrying musicians load...');
    setError(null);
    setHasMoreVideos(true);
    setMusicianVideos([]);
    setCurrentVisibleIndex(0);
    loadAttempts.current = 0;
    
    BackgroundDataService.forceRefreshAll();
    loadInitialMusicianVideos();
  }, [loadInitialMusicianVideos]);

  if (isInitialLoading && musicianVideos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff6ec4" />
        <Text style={styles.loadingText}>Loading amazing musicians...</Text>
        <Text style={styles.loadingSubText}>Finding great music videos</Text>
      </View>
    );
  }

  if (error && musicianVideos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isInitialLoading && musicianVideos.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>No musicians found</Text>
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
          data={musicianVideos}
          ListFooterComponent={
            <View style={{ height: 55 }}>
              {isLoadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#ff6ec4" />
                  <Text style={styles.loadingMoreText}>Finding more musicians...</Text>
                </View>
              )}
              {!hasMoreVideos && !isLoadingMore && musicianVideos.length > 0 && (
                <View style={styles.endContainer}>
                  <Text style={styles.endText}>You've seen all videos! 🌍</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <VideoItem
              item={{
                id: item.id || item.user_id || `musician-video-${index}`,
                user: item.username || item.user || 'Unknown',
                description: Array.isArray(item.instruments) ? item.instruments.join(', ') : (item.instruments || 'Music Video'),
                videoUrl: item.video_url || item.videoUrl,
                likes: item.likes || Math.floor(Math.random() * 1000),
                comments: item.comments || Math.floor(Math.random() * 100),
              }}
              isVisible={index === currentVisibleIndex && isFocused}
              height={videoHeight}
              shouldCache={index >= currentVisibleIndex && index <= currentVisibleIndex + MUSICIAN_CONFIG.PRELOAD_AHEAD}
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
            `musician-video-${item.id || item.user_id || 'video'}-${index}`
          }
          showsVerticalScrollIndicator={false}
          initialScrollIndex={0}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={true}
          initialNumToRender={2}
          updateCellsBatchingPeriod={100}
          disableIntervalMomentum={true}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={videoHeight}
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
  loadingSubText: {
    color: '#ff6ec4',
    marginTop: 5,
    fontSize: 14,
    fontStyle: 'italic',
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