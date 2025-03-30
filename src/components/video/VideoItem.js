import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import useLikeVideo from '../../hooks/useLikeVideo';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const VideoItem = ({ item, isVisible }) => {
  const { isLiked, toggleLike } = useLikeVideo(item.id);
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  useEffect(() => {
    let timeout;
    if (showPlayIcon) {
      timeout = setTimeout(() => setShowPlayIcon(false), 1000);
    }
    return () => clearTimeout(timeout);
  }, [showPlayIcon]);

  const handleTogglePlayback = () => {
    setPaused(!paused);
    setShowPlayIcon(true);
  };

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={styles.videoContainer}>
        <Video
          source={{ uri: item.videoUrl }}
          style={styles.videoPlayer}
          resizeMode="cover"
          shouldPlay={isVisible && !paused} // Use shouldPlay instead of paused
          isLooping // Ensures the video loops
          isMuted={false} // Controls whether the video is muted
        />

        {/* Play/Pause Icon Overlay */}
        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <Icon
              name={paused ? 'play' : 'pause'}
              size={70}
              color="white"
              style={styles.playIcon}
            />
          </View>
        )}

        {/* Username & Description */}
        <View style={styles.videoInfo}>
          <View style={styles.userRow}>
            <Icon name="person-outline" size={16} color="white" style={styles.userIcon} />
            <Text style={styles.username}>{item.user}</Text>
          </View>

          <View style={styles.descriptionRow}>
            <MCIcon name="music" size={16} color="white" style={styles.userIcon} />
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </View>

        {/* Interaction Buttons */}
        <View style={styles.interactionButtons}>
          <TouchableOpacity style={styles.iconWrapper} onPress={() => toggleLike(item.id)}>
            <Icon
              name={isLiked ? 'heart' : 'heart-outline'}
              size={30}
              color={isLiked ? 'red' : 'white'}
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
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    height: height - 60,
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  centerOverlay: {
    position: 'absolute',
    top: '45%',
    left: '45%',
    zIndex: 10,
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
  descriptionRow: {
    color: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
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
  playIcon: {
    alignSelf: 'center',
  },
});

export default VideoItem;