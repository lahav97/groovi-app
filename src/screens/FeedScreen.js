import React from 'react';
import { FlatList, Dimensions } from 'react-native';
import VideoItem from '../components/video/VideoItem';
import { VIDEOS } from '../data/mockData';

// Get screen dimensions
const { height } = Dimensions.get('window');

const FeedScreen = () => {
  return (
    <FlatList
      data={VIDEOS}
      renderItem={({ item }) => <VideoItem item={item} />}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={height - 60} // Exclude bottom bar height
      snapToAlignment="start"
      decelerationRate="fast"
    />
  );
};

export default FeedScreen;