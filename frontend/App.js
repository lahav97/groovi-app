import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Mock video data
const VIDEOS = [
  { id: '1', user: 'Lahav_Rabinovitz', description: 'First cool video 🔥 #awesome', likes: 100, comments: 234 },
  { id: '2', user: 'Shay.Paz', description: 'Check out this view! 🌄 #travel', likes: 50, comments: 105 },
  { id: '3', user: 'Eyaloss', description: 'My new dance 💃🏻 #dancechallenge', likes: 14300, comments: 1200 },
  { id: '4', user: 'Ben_Lulu82', description: 'Recipe tutorial 🍔 #cooking', likes: 87, comments: 432 },
];

const App = () => {
  const [likedVideos, setLikedVideos] = useState({});

  // Function to toggle like state
  const toggleLike = (id) => {
    setLikedVideos((prevLikedVideos) => ({
      ...prevLikedVideos,
      [id]: !prevLikedVideos[id],
    }));
  };

  const VideoItem = ({ item }) => {
    const isLiked = likedVideos[item.id];

    return (
      <View style={styles.videoContainer}>
        {/* Video Placeholder */}
        <View style={styles.videoPlaceholder}>
          <Icon name="play-outline" size={70} color="white" />
        </View>

        {/* Username & Description - Moved Closer to Bottom */}
        <View style={styles.videoInfo}>
          <View style={styles.userRow}>
            <Icon name="person-outline" size={16} color="white" style={styles.userIcon} />
            <Text style={styles.username}>{item.user}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
        </View>

        {/* Interaction Buttons - Lowered & Styled Icons */}
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

        {/* Search & Filter Icons - Aligned at the Same Height */}
        <TouchableOpacity style={styles.searchIcon}>
          <Icon name="search-outline" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterIcon}>
          <Icon name="filter-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />

      {/* Video Feed - Scrollable like TikTok */}
      <FlatList
        data={VIDEOS}
        renderItem={VideoItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height - 60} // Exclude bottom bar height
        snapToAlignment="start"
        decelerationRate="fast"
      />

      {/* Bottom Navigation - Updated Icons */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="aperture-outline" size={28} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="person-outline" size={28} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="add-circle-outline" size={36} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="home-outline" size={28} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="chatbubble-ellipses-outline" size={28} color="#888" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
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
    bottom: 30, // Moved Closer to Bottom Bar
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
    bottom: 120, // Lowered from 180
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 15, // Space between icons
  },
  iconText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
  searchIcon: {
    position: 'absolute',
    top: 60, // Adjusted
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  filterIcon: {
    position: 'absolute',
    top: 60, // Same height as search
    left: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
});

export default App;