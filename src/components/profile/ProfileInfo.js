/**
 * @module ProfileInfo
 * Profile information display component
 * Shows user details, rating, bio, instruments, location, and social links
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../styles/theme';

/**
 * @function ProfileInfo
 * @description Displays user profile information in a clean, organized layout
 * @param {Object} props - Component props
 * @param {Object} props.profile - User profile data
 * @param {Function} props.formatInstruments - Function to format instruments display
 * @param {Function} props.handleLogout - Logout handler function
 * @param {boolean} props.loggingOut - Loading state for logout
 * @returns {JSX.Element}
 */
const ProfileInfo = ({
  profile,
  formatInstruments,
  handleLogout,
  loggingOut,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  return (
    <>
      {/* Username Section */}
      <View style={styles.usernameSection}>
        <Ionicons name="person-circle-outline" size={SIZES.icon} color={theme.text} />
        <Text style={[styles.username, { color: theme.text }]}>
          @{profile?.username || 'Loading...'}
        </Text>
      </View>

      {/* Star Rating */}
      <View style={styles.stars}>
        {[...Array(5)].map((_, i) => (
          <FontAwesome key={i} name="star" size={SIZES.iconSmall || 16} color="gold" />
        ))}
      </View>

      {/* Bio */}
      <View style={styles.infoItem}>
        <Ionicons name="information-circle-outline" size={SIZES.icon} color={theme.text} />
        <Text style={[styles.infoText, { color: theme.text }]}>
          {profile?.bio || 'I love to play the guitar !!'}
        </Text>
      </View>

      {/* Instruments */}
      <View style={styles.infoItem}>
        <Ionicons name="musical-notes-outline" size={SIZES.icon} color={theme.text} />
        <Text style={[styles.infoText, { color: theme.text }]}>
          {formatInstruments()}
        </Text>
      </View>

      {/* Location */}
      <View style={styles.infoItem}>
        <Ionicons name="location-outline" size={SIZES.icon} color={theme.text} />
        <Text style={[styles.infoText, { color: theme.text }]}>
          {profile?.address || profile?.location || 'Tel Aviv'}
        </Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 110, 196, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 30,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ff6ec4',
    shadowColor: '#ff6ec4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    color: '#ff6ec4',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default ProfileInfo;