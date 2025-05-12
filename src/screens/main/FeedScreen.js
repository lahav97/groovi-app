/**
 * @module FeedScreen
 * Displays a vertically scrollable video feed, allowing swipe to switch between videos.
 * Each swipe moves exactly one video, and videos always fit the screen perfectly.
 */
import React, { useRef, useState, useEffect } from 'react';
import { View, FlatList, Dimensions, StyleSheet } from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import { VIDEOS } from '../../data/mockData';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FeedScreen = () => {
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  
  // Calculate exact video height to fit the screen perfectly
  const videoHeight = SCREEN_HEIGHT - insets.bottom;
  
  // Track touch positions and scroll state
  const touchStartRef = useRef(0);
  const isScrollingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  
  /**
   * Handle viewable items change
   */
  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentVisibleIndex) {
        setCurrentVisibleIndex(newIndex);
      }
    }
  });

  const viewConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 100
  });

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
    } else if (index >= VIDEOS.length) {
      index = VIDEOS.length - 1;  // Clamp to last video
    }
    
    // Use scrollToOffset for precise positioning
    if (index !== currentVisibleIndex) {
      flatListRef.current?.scrollToOffset({
        offset: index * videoHeight,
        animated: true
      });
      setCurrentVisibleIndex(index);
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
    if (flatListRef.current) {
      enforcePerfectAlignment();
    }
  }, [videoHeight, insets]);

  /**
   * Handle any end of scrolling to enforce proper alignment
   */
  const handleScrollEnd = () => {
    enforcePerfectAlignment();
  };

  return (
    <View 
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video Feed */}
      <View style={styles.feedContainer}>
        <FlatList
          ref={flatListRef}
          data={VIDEOS}
          ListFooterComponent={<View style={{ height: 55 }} />}
          renderItem={({ item, index }) => (
            <VideoItem
              item={item}
              isVisible={index === currentVisibleIndex && isFocused}
              height={videoHeight}
            />
          )}
          scrollEnabled={false} // Disable default scrolling - we handle it manually
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
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
        />
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
  }
});

export default FeedScreen;