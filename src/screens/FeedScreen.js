import React, { useRef, useState } from 'react';
import { View, FlatList, Dimensions, useColorScheme, StyleSheet } from 'react-native';
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
  
  // Calculate the exact height for video items
  const videoHeight = SCREEN_HEIGHT - insets.top - insets.bottom;

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentVisibleIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  return (
    <View style={styles.container}>
      {/* Video Feed */}
      <View style={[styles.feedContainer, { paddingBottom: LAYOUT.navHeight }]}>
        <FlatList
          data={VIDEOS}
          renderItem={({ item, index }) => (
            <VideoItem
              item={item}
              isVisible={index === currentVisibleIndex && isFocused}
              height={videoHeight}
            />
          )}
          keyExtractor={(item) => item.id}
          pagingEnabled
          snapToInterval={videoHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            // No paddingTop to avoid gaps
          }}
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