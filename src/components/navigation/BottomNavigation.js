import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const BottomNavigation = () => {
  return (
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