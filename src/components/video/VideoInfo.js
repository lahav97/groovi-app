import React from 'react';
import { View, Text, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoInfo = ({ video }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: SCREEN_HEIGHT * 0.1 + insets.bottom }]}>
      <Text style={[styles.username, { color: theme.icon }]}>@{video?.username}</Text>
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
    textShadowRadius: 10
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
