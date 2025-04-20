import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLikeVideo from '../../hooks/useLikeVideo';
import { COLORS, LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_ITEM_HEIGHT = SCREEN_HEIGHT - LAYOUT.navHeight;

const VideoItem = ({ item, isVisible }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const { isLiked, toggleLike } = useLikeVideo(item.id);
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  useEffect(() => {
    let timeout;
    if (showPlayIcon) {
      timeout = setTimeout(() => setShowPlayIcon(false), 1000);
    }
    return () => clearTimeout(timeout);
  }, [showPlayIcon]);

  useEffect(() => {
    if ((!isVisible || !isFocused) && videoRef.current) {
      videoRef.current.pauseAsync();
    }
  }, [isVisible, isFocused]);

  const handleTogglePlayback = () => {
    setPaused(!paused);
    setShowPlayIcon(true);
  };

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background }]}>
        <Video
          ref={videoRef}
          source={{ uri: item.videoUrl }}
          style={styles.videoPlayer}
          resizeMode="cover"
          shouldPlay={isVisible && isFocused && !paused}
          isLooping
          isMuted={false}
        />

        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <Icon
              name={paused ? 'play' : 'pause'}
              size={70}
              color={COLOR.icon}
              style={styles.playIcon}
            />
          </View>
        )}

        <View style={styles.videoInfo}>
          <View style={styles.userRow}>
            <Icon name="person-outline" size={16} color={COLOR.icon} style={styles.userIcon} />
            <Text style={[styles.username, { color: COLOR.icon }]}>{item.user}</Text>
          </View>

          <View style={styles.descriptionRow}>
            <MCIcon name="music" size={16} color={COLOR.icon} style={styles.userIcon} />
            <Text style={[styles.description, { color: COLOR.icon }]}>{item.description}</Text>
          </View>
        </View>

        <View style={styles.interactionButtons}>
          <TouchableOpacity style={styles.iconWrapper} onPress={() => toggleLike(item.id)}>
            <Icon
              name={isLiked ? 'heart' : 'heart-outline'}
              size={30}
              color={isLiked ? 'red' : COLOR.icon}
            />
            <Text style={[styles.iconText, { color: COLOR.icon }]}>
              {isLiked ? item.likes + 1 : item.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconWrapper}>
            <Icon name="chatbubble-outline" size={30} color={COLOR.icon} />
            <Text style={[styles.iconText, { color: COLOR.icon }]}>{item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconWrapper}>
            <Icon name="arrow-redo-outline" size={30} color={COLOR.icon} />
            <Text style={[styles.iconText, { color: COLOR.icon }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    height: VIDEO_ITEM_HEIGHT,
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
    bottom: 55,
    left: 18,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIcon: {
    marginRight: 5,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  description: {
    fontSize: 14,
  },
  descriptionRow: {
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
    fontSize: 12,
    marginTop: 5,
  },
  playIcon: {
    alignSelf: 'center',
  },
});

export default VideoItem;
