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

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Mock video data
const VIDEOS = [
  { id: '1', user: 'user1', description: 'Second cool video #awesome', likes: '10K', comments: '234' },
  { id: '2', user: 'user2', description: 'Check out this view! #travel', likes: '5.2K', comments: '105' },
  { id: '3', user: 'user3', description: 'My new dance #dancechallenge', likes: '143K', comments: '1.2K' },
  { id: '4', user: 'user4', description: 'Recipe tutorial #cooking', likes: '8.7K', comments: '432' },
];

const App = () => {
  // State to track which tab is active
  const [activeTab, setActiveTab] = useState('forYou');

  // Video item component
  const VideoItem = ({ item }) => {
    return (
      <View style={styles.videoContainer}>
        {/* This would be your actual video component */}
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>Video Content</Text>
        </View>
        
        {/* Video info overlay */}
        <View style={styles.videoInfo}>
          <Text style={styles.username}>@{item.user}</Text>
          <Text style={styles.description}>{item.description}</Text>
          
          {/* Interaction buttons would be here */}
          <View style={styles.interactionButtons}>
            <Text style={styles.interactionText}>❤️ {item.likes}</Text>
            <Text style={styles.interactionText}>💬 {item.comments}</Text>
            <Text style={styles.interactionText}>➡️ Share</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render different content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'forYou':
        return (
          <FlatList
            data={VIDEOS}
            renderItem={VideoItem}
            keyExtractor={item => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            snapToAlignment="start"
            decelerationRate="fast"
          />
        );
      case 'home':
        return (
          <View style={styles.centeredContent}>
            <Text style={styles.placeholderText}>Home Page Content</Text>
          </View>
        );
      case 'search':
        return (
          <View style={styles.centeredContent}>
            <Text style={styles.placeholderText}>Search Content</Text>
          </View>
        );
      case 'profile':
        return (
          <View style={styles.centeredContent}>
            <Text style={styles.placeholderText}>My Profile Content</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      
      {/* Main content area */}
      <View style={styles.content}>
        {renderContent()}
      </View>
      
      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('forYou')}
        >
          <Text style={[
            styles.navText, 
            activeTab === 'forYou' && styles.activeNavText
          ]}>For You</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('home')}
        >
          <Text style={[
            styles.navText, 
            activeTab === 'home' && styles.activeNavText
          ]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('search')}
        >
          <Text style={[
            styles.navText, 
            activeTab === 'search' && styles.activeNavText
          ]}>Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[
            styles.navText, 
            activeTab === 'profile' && styles.activeNavText
          ]}>My Page</Text>
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
  content: {
    flex: 1,
  },
  videoContainer: {
    height: height,
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
  videoPlaceholderText: {
    color: 'white',
    fontSize: 24,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    maxWidth: '70%',
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  description: {
    color: 'white',
    fontSize: 14,
    marginBottom: 15,
  },
  interactionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  interactionText: {
    color: 'white',
    marginRight: 15,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: '#333',
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    color: '#888',
    fontSize: 12,
  },
  activeNavText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 18,
  },
});

export default App;