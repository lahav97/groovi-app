/**
 * @module FeedScreen
 * Displays a vertically scrollable video feed, allowing swipe to switch between videos.
 */
import React, { useRef, useState } from 'react';
import { View, FlatList, Dimensions, StyleSheet, PanResponder } from 'react-native';
import VideoItem from '../components/video/VideoItem';
import { VIDEOS } from '../data/mockData';
import BottomNavigation from '../components/navigation/BottomNavigation';
import TopBar from '../components/navigation/TopNavigation';
import { LAYOUT } from '../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FeedScreen = () => {
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const isScrollingRef = useRef(false);
  const lastScrollTimestamp = useRef(0);

  const videoHeight = SCREEN_HEIGHT - insets.bottom;

  /**
   * @function FeedScreen
   * @description Main feed screen showing videos one at a time, controlling scroll behavior manually.
   * @returns {JSX.Element}
   */
  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentVisibleIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  /**
   * @function scrollToNextVideo
   * @description Scrolls to the next video in the feed.
   */  const scrollToNextVideo = () => {
    if (currentVisibleIndex < VIDEOS.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentVisibleIndex + 1,
        animated: true
      });
    }
  };

  /**
   * @function scrollToPrevVideo
   * @description Scrolls to the previous video in the feed.
   */  const scrollToPrevVideo = () => {
    if (currentVisibleIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentVisibleIndex - 1,
        animated: true
      });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        isScrollingRef.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
      },
      onPanResponderRelease: (evt, gestureState) => {
        const now = Date.now();
        if (now - lastScrollTimestamp.current < 500) {
          return;
        }
        
        // Determine direction and scroll exactly one video
        if (gestureState.dy < -50) { // Swipe up - next video
          scrollToNextVideo();
          lastScrollTimestamp.current = now;
        } else if (gestureState.dy > 50) { // Swipe down - previous video
          scrollToPrevVideo();
          lastScrollTimestamp.current = now;
        }
      }
    })
  ).current;

    /**
   * @function handleScrollEnd
   * @description Aligns the scroll position exactly to a video after momentum ends.
   * @param {Object} event - Scroll event.
   */
  const handleScrollEnd = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / videoHeight);
    
    // If we're not already perfectly aligned with a video, scroll to the nearest one
    if (offsetY !== index * videoHeight) {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true
      });
      setCurrentVisibleIndex(index);
    }
  };

  /**
   * @function handleScroll
   * @description Controls scrolling velocity to avoid jumping multiple videos at once.
   * @param {Object} event - Scroll event.
   */  const handleScroll = (event) => {
    if (isScrollingRef.current) return;
    
    const offsetY = event.nativeEvent.contentOffset.y;
    const velocity = Math.abs(event.nativeEvent.velocity.y);
    
    // If the velocity is very high (fast swipe), we want to control it
    if (velocity > 1.5) {
      isScrollingRef.current = true;
      
      // Calculate the direction of the scroll
      const direction = event.nativeEvent.velocity.y > 0 ? 1 : -1;
      
      // Calculate the target index (just one video away)
      const targetIndex = currentVisibleIndex + direction;
      
      // Clamp the index between 0 and VIDEOS.length - 1
      const clampedIndex = Math.max(0, Math.min(VIDEOS.length - 1, targetIndex));
      
      // Scroll to the target index
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: clampedIndex,
          animated: true
        });
        
        // Reset the scrolling flag after animation completes
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 300);
      }, 10);
    }
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Video Feed */}
      <View style={[styles.feedContainer, { paddingBottom: LAYOUT.navHeight }]}>
        <FlatList
          ref={flatListRef}
          data={VIDEOS}
          renderItem={({ item, index }) => (
            <VideoItem
              item={item}
              isVisible={index === currentVisibleIndex && isFocused}
              height={videoHeight}
            />
          )}
          snapToInterval={videoHeight}
          snapToAlignment="start"
          decelerationRate={0.9} // Slightly reduced to help with control
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={handleScroll}
          getItemLayout={(data, index) => ({
            length: videoHeight,
            offset: videoHeight * index,
            index,
          })}
          pagingEnabled={true}
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
      <View style={styles.bottomNavContainer}>
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
    bottom: 0,
    left: 0,
    right: 0,
    height: LAYOUT.navHeight,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    zIndex: 10,
  }
});

export default FeedScreen;