import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const BottomNavigation = () => {
  const navigation = useNavigation();
  const ICON_SIZE = 28;
  const ICON_COLOR = '#888';

  return (
    <View style={styles.bottomNav}>
      {/* DISCOVER BUTTON - Aperture Icon (was Discover, now goes to Discover) */}
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Discover')}>
        <Icon name="aperture-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      {/* PROFILE BUTTON - Person Icon */}
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
        <Icon name="person-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      {/* CREATE CONTENT BUTTON - Plus Icon */}
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('VideoUpload')}>
        <Icon name="add-circle-outline" size={36} color={ICON_COLOR} />
      </TouchableOpacity>

      {/* HOME BUTTON - Goes to Match Screen */}
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Match')}>
        <Icon name="home-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      {/* CHAT BUTTON - Goes to Chat List */}
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ChatList')}>
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
});

export default BottomNavigation;