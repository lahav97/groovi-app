import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const TopNavigation = () => {
  const ICON_SIZE = 30;
  const ICON_COLOR = '#fff';

  return (
    <View style={styles.topNav}>
      <TouchableOpacity style={styles.navItem}>
        <Icon name="options-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem}>
        <Icon name="search-outline" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  topNav: {
    position: 'absolute',
    top: 10,
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
