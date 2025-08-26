import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';
import AppMemoryManager from '../../utils/AppMemoryManager';
import { clearVideoCache } from '../../hooks/useVideoCache';
import BackgroundDataService from '../../services/BackgroundDataService';

const BottomNavigation = () => {
  const navigation = useNavigation();
  const ICON_SIZE = 28;
  const ICON_COLOR = '#888';
  const PRIMARY_COLOR = '#ff6ec4'; // Your app's primary purple color

  // Function to handle navigation with memory cleanup
  const handleNavigation = (screenName) => {
    // Memory cleanup before navigation
    console.log(`🧹 Cleaning memory before navigating to ${screenName}`);
    
    try {
      // 1. Cancel background requests
      BackgroundDataService.cancelAllRequests?.();
      
      // 2. Clear video cache for heavy screens
      if (['Discover', 'Match', 'Profile'].includes(screenName)) {
        clearVideoCache();
        AppMemoryManager.clearAll?.('navigation');
      }
      
      // 3. Navigate to the screen
      navigation.navigate(screenName);
      
      // 4. Force garbage collection after navigation
      setTimeout(() => {
        if (global.gc) {
          global.gc();
          console.log(`♻️ Memory cleaned after navigating to ${screenName}`);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error during navigation cleanup:', error);
      // Still try to navigate even if cleanup fails
      navigation.navigate(screenName);
    }
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Discover')}>
        <Icon name="aperture-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Profile')}>
        <Icon name="person-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('VideoUpload')}>
        <LinearGradient
          colors={COLORS.static.primaryGradient} // Using theme gradient
          style={styles.gradientCircle}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
        >
          <Icon name="add" size={24} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Match')}>
        <Icon name="home-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('ChatList')}>
        <Icon name="chatbubble-ellipses-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
  gradientCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default BottomNavigation;