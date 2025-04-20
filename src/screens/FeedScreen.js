import React, { useRef, useState } from 'react';
import { View, FlatList, Dimensions, useColorScheme } from 'react-native';
import VideoItem from '../components/video/VideoItem';
import { VIDEOS } from '../data/mockData';
import BottomNavigation from '../components/navigation/BottomNavigation';
import TopBar from '../components/navigation/TopNavigation';
import { COLORS, LAYOUT } from '../styles/theme';
import { useIsFocused } from '@react-navigation/native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_ITEM_HEIGHT = SCREEN_HEIGHT - LAYOUT.navHeight;

const FeedScreen = () => {
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const colorScheme = useColorScheme();
  const isFocused = useIsFocused();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentVisibleIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top Navigation */}
      <View style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 10 }}>
        <TopBar />
      </View>

      {/* Video Feed */}
      <FlatList
        data={VIDEOS}
        renderItem={({ item, index }) => (
          <VideoItem
            item={item}
            isVisible={index === currentVisibleIndex && isFocused}
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={VIDEO_ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Navigation */}
      <View style={{
        height: LAYOUT.navHeight,
        backgroundColor: theme.background,
        justifyContent: 'center',
      }}>
        <BottomNavigation />
      </View>
    </View>
  );
};

export default FeedScreen;
