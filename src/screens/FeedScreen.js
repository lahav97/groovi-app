import React, { useRef, useState } from 'react';
import { FlatList, Dimensions, ViewToken } from 'react-native';
import VideoItem from '../components/video/VideoItem';
import { VIDEOS } from '../data/mockData';

const { height } = Dimensions.get('window');

const FeedScreen = () => {
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentVisibleIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  return (
    <FlatList
      data={VIDEOS}
      renderItem={({ item, index }) => (
        <VideoItem item={item} isVisible={index === currentVisibleIndex} />
      )}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={height - 60}
      snapToAlignment="start"
      decelerationRate="fast"
      onViewableItemsChanged={onViewRef.current}
      viewabilityConfig={viewConfigRef.current}
    />
  );
};

export default FeedScreen;
