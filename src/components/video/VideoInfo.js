import React from 'react';
import { View, Text, StyleSheet, useColorScheme, Dimensions, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { handleError } from '../../utils/errors';
import { createLogger } from '../../utils/Logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const logger = createLogger('VideoInfo');

const VideoInfo = ({ video }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Handle missing or malformed video prop
  if (!video || typeof video !== 'object') {
    logger.error('Invalid video data provided to VideoInfo component');
    return null;
  }

  /**
   * Navigate to musician profile screen
   * Handles both username and userId parameters for flexible navigation
   */
  const handleUsernamePress = () => {
    try {
      if (!video?.username) {
        logger.warn('No username available for profile navigation');
        return;
      }

      logger.info(`🔍 Navigating to musician profile: ${video.username}`);

      // Navigate to MusicianProfileScreen with available parameters
      navigation.navigate('MusicianProfile', {
        username: video.username,
        ...(video.userId && { userId: video.userId })
      });
    } catch (error) {
      logger.error('Failed to navigate to musician profile', {
        error: error.message,
        username: video?.username
      });
    }
  };

  return (
    <View style={[styles.container, { bottom: SCREEN_HEIGHT * 0.1 + insets.bottom }]}>
      {/* Clickable Username */}
      <TouchableOpacity onPress={handleUsernamePress} activeOpacity={0.7}>
        <Text style={[styles.username, { color: theme.icon }]}>
          @{video?.username}
        </Text>
      </TouchableOpacity>
      
      {/* Video Description */}
      <Text style={[styles.description, { color: theme.icon }]} numberOfLines={2}>
        {video?.description}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    right: 60,
    zIndex: 1,
  },
  username: {
    fontSize: SIZES.font.large,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  description: {
    fontSize: SIZES.font.medium,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  songName: {
    color: 'ICON_COLOR',
    fontSize: SIZES.font.medium,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});

export default VideoInfo;