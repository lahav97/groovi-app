import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../components/navigation/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../styles/theme';
import { useIsFocused } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const mockVideos = [
  { id: '1', uri: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { id: '2', uri: 'https://path.to/video2.mp4' },
  { id: '3', uri: 'https://path.to/video3.mp4' },
];

const ProfileScreen = () => {
  const [pausedVideos, setPausedVideos] = useState({});
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});

  const togglePause = (id) => {
    setPausedVideos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!isFocused) {
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    }
  }, [isFocused]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Icons */}
      <View style={styles.topIcons}>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="create-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 30 }]}>
        <FlatList
          horizontal
          data={mockVideos}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.videoScroll}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => togglePause(item.id)}>
              <Video
                ref={(ref) => {
                  videoRefs.current[item.id] = ref;
                }}
                source={{ uri: item.uri }}
                style={styles.video}
                resizeMode="cover"
                isLooping
                shouldPlay={!pausedVideos[item.id] && isFocused}
                isMuted={false}
              />
            </TouchableOpacity>
          )}
        />

        <View style={styles.usernameSection}>
          <Ionicons name="person-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.username, { color: theme.text }]}>@user_name</Text>
        </View>

        <View style={styles.stars}>
          {[...Array(5)].map((_, i) => (
            <FontAwesome key={i} name="star" size={SIZES.iconSmall || 16} color="gold" />
          ))}
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="information-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>Personal Info</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="musical-notes-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>Instruments</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>Location</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="link-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>@social_link</Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <BottomNavigation />
      </View>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topIcons: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  videoScroll: {
    marginBottom: 20,
  },
  video: {
    width: width * 0.8,
    height: 220,
    borderRadius: SIZES.radius,
    marginHorizontal: 10,
    backgroundColor: '#111',
  },
  usernameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: SIZES.font.large,
    fontWeight: '600',
    marginLeft: 10,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: SIZES.font.medium,
    marginLeft: 10,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LAYOUT.navHeight,
    backgroundColor: '#000',
    zIndex: 100,
    justifyContent: 'center',
  },
});
