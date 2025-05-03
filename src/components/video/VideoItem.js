import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import useLikeVideo from '../../hooks/useLikeVideo';
import { COLORS } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VideoInfo from './VideoInfo';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoItem = ({ item, isVisible, height }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const { isLiked, toggleLike } = useLikeVideo(item.id);
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();

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
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
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

        <VideoInfo video={{ username: item.user, description: item.description }} />

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
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayer: {
    width: width,
    height: SCREEN_HEIGHT,
  },
  centerOverlay: {
    position: 'absolute',
    top: '45%',
    left: '45%',
    zIndex: 10,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 40,
    left: 18,
  },
  interactionButtons: {
    position: 'absolute',
    right: 20,
    bottom: 180,
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
