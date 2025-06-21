// DiscoverScreen.js - OPTIMIZED VERSION (Butter-smooth TikTok-style feed)
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  FlatList, 
  Dimensions, 
  StyleSheet, 
  ActivityIndicator, 
  Text, 
  TouchableOpacity,
  InteractionManager 
} from 'react-native';
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
import { getDiscoverCache, cacheFeedVideos } from '../../utils/cacheManager';
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

// FIX 2A: OPTIMIZED CONFIG - No aggressive cleanup during scrolling
const DISCOVER_CONFIG = {
  INITIAL_BATCH: 5,
  LOAD_MORE_BATCH: 3,
  LOAD_TRIGGER_DISTANCE: 2,
  MAX_VIDEOS_IN_MEMORY: 10,        //TODO: to change to - 25
  PRELOAD_DISTANCE: 3,
  THROTTLE_MS: 500,                // Increased debounce for stability
  ENABLE_CACHE_CLEANUP: false,     // Disabled during active use
  STABILITY_DELAY: 300,            // Delay for state stability
};

const DiscoverScreen = () => {
  // STATE
  const [musicianVideos, setMusicianVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser] = useState('lahav97');

  // FIX 2B: ENHANCED REFS for stability
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadAttempts = useRef(0);
  const lastLoadTime = useRef(0);
  const stabilityTimeoutRef = useRef(null);
  const loadMoreTimeoutRef = useRef(null);
  const currentIndexRef = useRef(0);  // For stable index tracking

  // MEMOIZED VALUES
  const videoHeight = useMemo(() => SCREEN_HEIGHT - insets.bottom, [insets.bottom]);

  // FIX 2C: ULTRA-STABLE KEY EXTRACTOR - Prevents re-renders
  const keyExtractor = useCallback((item, index) => {
    // Use stable ID generation that won't change
    const stableId = item.id || item.user_id || `musician-${index}`;
    return `discover-${stableId}-${index}`;
  }, []);

  // FIX 2D: STABLE ITEM LAYOUT for smooth scrolling
  const getItemLayout = useCallback((data, index) => ({
    length: videoHeight,
    offset: videoHeight * index,
    index,
  }), [videoHeight]);

  // FIX 2E: DEBOUNCED LOAD INITIAL - Prevents rapid state changes
  const loadInitialVideos = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    console.log('🚀 DiscoverScreen: Loading initial musician videos...');
    setIsInitialLoading(true);
    setError(null);
    isLoadingRef.current = true;

    try {
      // Quick cache check (fast path)
      const backgroundStatus = BackgroundDataService.getSeparatedSystemStatus();
      if (backgroundStatus.feed.loaded) {
        const cachedVideos = await getDiscoverCache();
        if (cachedVideos && cachedVideos.length > 0) {
          console.log(`⚡ Using ${cachedVideos.length} cached musician videos`);
          
          // Use InteractionManager to prevent blocking
          InteractionManager.runAfterInteractions(() => {
            if (mountedRef.current) {
              setMusicianVideos(cachedVideos);
              setCurrentIndex(0);
              currentIndexRef.current = 0;
              setIsInitialLoading(false);
              isLoadingRef.current = false;
            }
          });
          return;
        }
      }

      // Load fresh musician data
      resetVideoState();
      const musicians = await fetchInitialMusicians(currentUser);
      
      if (!mountedRef.current) return;
      
      if (musicians && musicians.length > 0) {
        const transformedVideos = musicians.map((musician, index) => ({
          // STABLE ID generation for consistent re-renders
          id: `${musician.id || 'unknown'}-${Date.now()}-${index}`,
          user_id: musician.id,
          username: musician.username,
          user: musician.username,
          video_url: musician.videos[0],
          videoUrl: musician.videos[0],
          instruments: musician.instruments,
          likes: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 100) + 10,
        }));
        
        // Use InteractionManager for smooth state updates
        InteractionManager.runAfterInteractions(() => {
          if (mountedRef.current) {
            setMusicianVideos(transformedVideos);
            setCurrentIndex(0);
            currentIndexRef.current = 0;
            setHasMoreVideos(true);
            setIsInitialLoading(false);
            isLoadingRef.current = false;
            
            // Cache asynchronously (non-blocking)
            setTimeout(() => cacheFeedVideos(transformedVideos), 100);
          }
        });
        
        console.log(`✅ Loaded ${transformedVideos.length} initial musician videos`);
      } else {
        console.log('❌ No musicians received');
        if (mountedRef.current) {
          setError(ERROR_MESSAGES.NETWORK.NO_MUSICIANS);
          setHasMoreVideos(false);
          setIsInitialLoading(false);
          isLoadingRef.current = false;
        }
      }
    } catch (err) {
      console.error('❌ Failed to load musicians:', handleError(err, 'DiscoverScreen/loadInitial'));
      if (mountedRef.current) {
        setError(handleError(err, 'DiscoverScreen/loadInitial'));
        setIsInitialLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [currentUser]);

  // FIX 2F: HEAVILY DEBOUNCED LOAD MORE - Prevents aggressive loading
  const loadMoreVideos = useCallback(async () => {
    if (isLoadingRef.current || !mountedRef.current || isLoadingMore || !hasMoreVideos) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTime.current < DISCOVER_CONFIG.THROTTLE_MS) {
      return;
    }

    console.log(`📊 Loading more musicians. Current: ${musicianVideos.length}`);
    
    // Clear any pending load operations
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }

    setIsLoadingMore(true);
    isLoadingRef.current = true;
    lastLoadTime.current = now;

    try {
      const moreMusicians = await loadMusicianWithoutFilters(currentUser);
      
      if (!mountedRef.current) return;
      
      if (moreMusicians && moreMusicians.length > 0) {
        loadAttempts.current = 0;
        
        const transformedVideos = moreMusicians.map((musician, index) => ({
          id: `${musician.id || 'unknown'}-${Date.now()}-${index}`,
          user_id: musician.id,
          username: musician.username,
          user: musician.username,
          video_url: musician.videos[0],
          videoUrl: musician.videos[0],
          instruments: musician.instruments,
          likes: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 100) + 10,
        }));
        
        // FIX 2G: SMOOTH STATE UPDATE without aggressive cleanup
        setMusicianVideos(prevVideos => {
          const updatedVideos = [...prevVideos, ...transformedVideos];
          
          // CRITICAL: NO cleanup during active scrolling to prevent white flashes
          // Only cleanup when user is idle for extended periods
          if (DISCOVER_CONFIG.ENABLE_CACHE_CLEANUP && 
              updatedVideos.length > DISCOVER_CONFIG.MAX_VIDEOS_IN_MEMORY) {
            
            // Only remove videos user scrolled WAY past (safe cleanup)
            const currentIdx = currentIndexRef.current;
            const safeRemoveCount = Math.max(0, currentIdx - 5); //TODO: to change to - 15
            
            if (safeRemoveCount > 5) { // Only cleanup if significant
              console.log('🧹 Safe background cleanup (non-disruptive)');
              const cleanedVideos = updatedVideos.slice(safeRemoveCount);
              
              // Update current index to reflect cleanup
              InteractionManager.runAfterInteractions(() => {
                if (mountedRef.current) {
                  setCurrentIndex(prev => Math.max(0, prev - safeRemoveCount));
                  currentIndexRef.current = Math.max(0, currentIndexRef.current - safeRemoveCount);
                }
              });
              
              // Cache in background
              setTimeout(() => cacheFeedVideos(cleanedVideos), 100);
              return cleanedVideos;
            }
          }
          
          // Default: Just append new videos (smooth experience)
          setTimeout(() => cacheFeedVideos(updatedVideos), 100);
          return updatedVideos;
        });
        
        console.log(`✅ Added ${transformedVideos.length} more musician videos`);
      } else {
        if (loadAttempts.current < 3) {
          // Delayed retry to prevent rapid calls
          loadMoreTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              loadMoreVideos();
            }
          }, 2000);
        } else {
          console.log('🏁 No more musicians available');
          setHasMoreVideos(false);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load more musicians:', handleError(err, 'DiscoverScreen/loadMore'));
      
      if (loadAttempts.current < 3) {
        loadMoreTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            loadMoreVideos();
          }
        }, 2000);
      } else {
        setHasMoreVideos(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
        isLoadingRef.current = false;
      }
    }
  }, [hasMoreVideos, musicianVideos.length, currentUser]);

  // FIX 2H: OPTIMIZED SCROLL HANDLING - Prevent conflicts
  const onScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / videoHeight);
    
    // Update both state and ref for consistency
    if (newIndex !== currentIndexRef.current && newIndex >= 0 && newIndex < musicianVideos.length) {
      currentIndexRef.current = newIndex;
      
      // Debounce state update to prevent rapid changes
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
      
      stabilityTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setCurrentIndex(newIndex);
          
          // Load more check with stability
          const remainingVideos = musicianVideos.length - newIndex - 1;
          if (remainingVideos <= DISCOVER_CONFIG.LOAD_TRIGGER_DISTANCE && 
              hasMoreVideos && 
              !isLoadingMore && 
              !isLoadingRef.current) {
            console.log(`🔄 Load trigger: ${remainingVideos} videos remaining`);
            loadMoreVideos();
          }
        }
      }, DISCOVER_CONFIG.STABILITY_DELAY);
    }
  }, [musicianVideos.length, hasMoreVideos, isLoadingMore, videoHeight, loadMoreVideos]);

  // FIX 2I: STABLE VIEWABILITY CONFIG
  const viewabilityConfig = useMemo(() => ({
    viewAreaCoveragePercentThreshold: 70,    // Increased threshold for stability
    minimumViewTime: 250,                    // Increased minimum view time
    waitForInteraction: false,
  }), []);

  // FIX 2J: DEBOUNCED VIEWABILITY HANDLER
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      
      if (newIndex !== currentIndexRef.current && newIndex >= 0 && newIndex < musicianVideos.length) {
        currentIndexRef.current = newIndex;
        
        // Use InteractionManager for smooth updates
        InteractionManager.runAfterInteractions(() => {
          if (mountedRef.current) {
            setCurrentIndex(newIndex);
            
            // Load more check
            const remainingVideos = musicianVideos.length - newIndex - 1;
            if (remainingVideos <= DISCOVER_CONFIG.LOAD_TRIGGER_DISTANCE && 
                hasMoreVideos && 
                !isLoadingMore) {
              loadMoreVideos();
            }
          }
        });
      }
    }
  }, [musicianVideos.length, hasMoreVideos, isLoadingMore, loadMoreVideos]);

  // FIX 2K: MEMOIZED RENDER ITEM for performance
  const renderVideoItem = useCallback(({ item, index }) => (
    <VideoItem
      item={{
        id: item.id,
        user: item.username || item.user || 'Unknown',
        description: Array.isArray(item.instruments) ? 
          item.instruments.join(', ') : 
          (item.instruments || 'Music Video'),
        videoUrl: item.video_url || item.videoUrl,
        likes: item.likes,
        comments: item.comments,
      }}
      isVisible={index === currentIndex && isFocused}
      height={videoHeight}
      shouldCache={
        index >= currentIndex - 1 && 
        index <= currentIndex + DISCOVER_CONFIG.PRELOAD_DISTANCE
      }
    />
  ), [currentIndex, isFocused, videoHeight]);

  // FIX 2L: OPTIMIZED RETRY HANDLER
  const handleRetry = useCallback(() => {
    console.log('🔄 Retrying musicians load...');
    setError(null);
    setHasMoreVideos(true);
    setMusicianVideos([]);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    loadAttempts.current = 0;
    
    // Clear any pending operations
    if (stabilityTimeoutRef.current) {
      clearTimeout(stabilityTimeoutRef.current);
    }
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }
    
    // Force refresh and reload
    InteractionManager.runAfterInteractions(() => {
      BackgroundDataService.forceRefreshAll();
      loadInitialVideos();
    });
  }, [loadInitialVideos]);

  // EFFECTS
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      
      // Clean up timeouts
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Delay initial load slightly for smoother startup
    const initTimeout = setTimeout(() => {
      if (mountedRef.current) {
        loadInitialVideos();
      }
    }, 100);
    
    return () => clearTimeout(initTimeout);
  }, [loadInitialVideos]);

  // RENDER
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
    <View style={styles.container}>
      <View style={styles.feedContainer}>
        <FlatList
          ref={flatListRef}
          data={musicianVideos}
          renderItem={renderVideoItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          
          // FIX 2M: OPTIMIZED SCROLLING - TikTok-style smooth experience
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          bounces={false}
          
          // FIX 2N: SMOOTH SCROLL CONFIG - No conflicts
          onScroll={onScroll}
          scrollEventThrottle={16}           // 60 FPS
          
          // FIX 2O: VIEWABILITY OPTIMIZATION  
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          
          // FIX 2P: PERFORMANCE OPTIMIZATION - Larger windows for smooth experience
          removeClippedSubviews={false}      // CRITICAL: Disable to prevent unmounting
          maxToRenderPerBatch={3}            // Increased from 2
          windowSize={10}                    // Increased from 5 for smoother scrolling
          initialNumToRender={3}             // Increased from 2
          updateCellsBatchingPeriod={100}    // Increased for stability
          
          // FIX 2Q: SMOOTH SNAPPING - TikTok-like feel
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={videoHeight}
          disableIntervalMomentum={true}
          pagingEnabled={false}              // Free scrolling, but snapping
          
          // FOOTER
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#ff6ec4" />
                <Text style={styles.loadingMoreText}>Finding more musicians...</Text>
              </View>
            ) : !hasMoreVideos && musicianVideos.length > 0 ? (
              <View style={styles.endContainer}>
                <Text style={styles.endText}>You've seen all videos! 🌍</Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* NAVIGATION OVERLAYS */}
      <View style={[styles.topNavContainer, { top: insets.top }]}>
        <TopBar />
      </View>

      <View style={[styles.bottomNavContainer, { 
        height: LAYOUT.navHeight, 
        bottom: insets.bottom 
      }]}>
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
    paddingVertical: 20,
    height: 60,
  },
  loadingMoreText: {
    color: '#ff6ec4',
    fontSize: 12,
    marginLeft: 8,
  },
  endContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    height: 60,
  },
  endText: {
    color: '#666',
    fontSize: 14,
  },
});

export default DiscoverScreen;