import React from 'react';
import { View, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';

const TopNavigation = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  const ICON_SIZE = 30;
  const ICON_COLOR = theme.icon;
  const navigation = useNavigation();

  return (
    <View style={styles.topNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Filter')}>
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
