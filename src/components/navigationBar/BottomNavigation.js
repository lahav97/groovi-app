import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const BottomNavigation = () => {
  const navigation = useNavigation();
  const ICON_SIZE = 28;
  const ICON_COLOR = '#888';

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Feed')}>
        <Icon name="aperture-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
        <Icon name="person-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      {/* Upload Video - Plus Button */}
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation.navigate('VideoUpload')}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#6233b4', '#d981c3']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientPlusButton}
        >
          <Icon name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MusicianProfile')}>
        <Icon name="home-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem}>
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

  gradientPlusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default BottomNavigation;