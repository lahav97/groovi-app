import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const TopNavigation = () => {
  return (
    <View style={styles.topNav}>
      <TouchableOpacity style={styles.navItem}>
        <Icon name="options-outline" size={30} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem}>
        <Icon name="search-outline" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  topNav: {
    position: 'absolute',
    top: 40, // adjust as needed for notch safety
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navItem: {
    padding: 8,
  },
});

export default TopNavigation;
