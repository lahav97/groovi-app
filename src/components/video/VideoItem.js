import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import useLikeVideo from '../../hooks/useLikeVideo';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

const VideoItem = ({ item }) => {
  const { isLiked, toggleLike } = useLikeVideo(item.id);

  return (
    <View style={styles.videoContainer}>
      {/* Video Placeholder */}
      <View style={styles.videoPlaceholder}>
        <Icon name="play-outline" size={70} color="white" />
      </View>

      {/* Username & Description */}
      <View style={styles.videoInfo}>
        <View style={styles.userRow}>
          <Icon name="person-outline" size={16} color="white" style={styles.userIcon} />
          <Text style={styles.username}>{item.user}</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
      </View>

      {/* Interaction Buttons */}
      <View style={styles.interactionButtons}>
        <TouchableOpacity style={styles.iconWrapper} onPress={() => toggleLike(item.id)}>
          <Icon
            name={isLiked ? "heart" : "heart-outline"}
            size={30}
            color={isLiked ? "red" : "white"}
          />
          <Text style={styles.iconText}>{isLiked ? item.likes + 1 : item.likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconWrapper}>
          <Icon name="chatbubble-outline" size={30} color="white" />
          <Text style={styles.iconText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconWrapper}>
          <Icon name="arrow-redo-outline" size={30} color="white" />
          <Text style={styles.iconText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Icons */}
      <TouchableOpacity style={styles.searchIcon}>
        <Icon name="search-outline" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.filterIcon}>
        <Icon name="filter-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    height: height - 60, // Full screen except for bottom bar
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlaceholder: {
    backgroundColor: '#333',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 30,
    left: 15,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIcon: {
    marginRight: 5,
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  description: {
    color: 'white',
    fontSize: 14,
  },
  interactionButtons: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 15,
  },
  iconText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
  searchIcon: {
    position: 'absolute',
    top: 60,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  filterIcon: {
    position: 'absolute',
    top: 60,
    left: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
});

export default VideoItem;