/**
 * @module useProfileData
 * Custom hook for profile data loading with instant cache and background refresh
 * Handles all profile loading logic, caching, and state management
 * FIXED: Consistent instruments formatting to prevent object rendering errors
 */

import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCurrentUserEmail } from '../utils/userUtils';
import { fetchUserProfile } from '../services/profileService';
import { getProfileCache, cacheUserProfile, clearAllCaches } from '../utils/cacheManager';
import {
  handleError
} from '../utils/errors';

/**
 * FIXED: Safe field formatter to prevent object rendering errors
 */
const formatFieldSafely = (value, defaultValue = 'Not specified') => {
  if (!value || value === null || value === undefined) return defaultValue;
  
  // Handle objects like {Trumpet: true, "Lead Vocals": true}
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    return keys.length > 0 ? keys.join(', ') : defaultValue;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    const filtered = value.filter(item => item && item !== null && item !== undefined);
    return filtered.length > 0 ? filtered.join(', ') : defaultValue;
  }
  
  // Handle strings and other types
  const stringValue = String(value).trim();
  return stringValue || defaultValue;
};

/**
 * FIXED: Normalize profile data to prevent rendering errors
 */
const normalizeProfileData = (profileData) => {
  if (!profileData) return null;
  
  return {
    ...profileData,
    // FIXED: Ensure these fields are always safe for rendering
    username: formatFieldSafely(profileData.username, 'Unknown'),
    bio: formatFieldSafely(profileData.bio, 'Music enthusiast looking to connect!'),
    location: formatFieldSafely(profileData.location, 'Unknown'),
    age: profileData.age && typeof profileData.age === 'number' ? profileData.age : null,
    rating: profileData.rating && typeof profileData.rating === 'number' ? profileData.rating : null,
    
    // FIXED: Normalize instruments - always safe string format
    instruments: (() => {
      const instruments = profileData.instruments;
      if (!instruments) return 'Guitar, Acoustic Guitar';
      
      if (typeof instruments === 'object' && !Array.isArray(instruments)) {
        const keys = Object.keys(instruments);
        return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
      }
      
      if (Array.isArray(instruments)) {
        const filtered = instruments.filter(i => i && i !== null && i !== undefined);
        return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
      }
      
      return String(instruments) || 'Guitar, Acoustic Guitar';
    })(),
    
    // FIXED: Normalize genres
    genres: (() => {
      const genres = profileData.genres;
      if (!genres) return [];
      
      if (typeof genres === 'object' && !Array.isArray(genres)) {
        return Object.keys(genres);
      }
      
      if (Array.isArray(genres)) {
        return genres.filter(g => g && g !== null && g !== undefined);
      }
      
      return [String(genres)];
    })(),
    
    // FIXED: Ensure videos is always an array
    videos: Array.isArray(profileData.videos) ? profileData.videos : [],
    
    // FIXED: Ensure numeric fields are safe
    followers: typeof profileData.followers === 'number' ? profileData.followers : 0,
    following: typeof profileData.following === 'number' ? profileData.following : 0,
    likes: typeof profileData.likes === 'number' ? profileData.likes : 0,
  };
};

/**
 * Custom hook for profile data management
 * @returns {Object} Profile data, loading states, and handler functions
 */
export const useProfileData = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadSource, setLoadSource] = useState('');
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

  // Track if we've loaded from cache to avoid duplicate loads
  const hasLoadedFromCache = useRef(false);
  const backgroundRefreshTimeout = useRef(null);

  /**
   * Handle logout with complete data cleanup
   */
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? This will clear all cached data from your device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  /**
   * Perform the actual logout with data cleanup
   */
  const performLogout = async () => {
    setLoggingOut(true);

    try {
      await clearAllCaches();
      
      const result = await signOut();
      
      if (result.success) {
        setProfile(null);
        setLoading(false);
        setError(null);
      } else {
        console.error('❌ useProfileData: Logout failed:', result.error);
        Alert.alert(
          'Logout Failed',
          handleError(result.error, 'useProfileData/performLogout') || 'Unable to sign out. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ useProfileData: Error during logout:', error);
      Alert.alert(
        'Logout Error',
        handleError(error, 'useProfileData/performLogout') || 'An error occurred while signing out. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoggingOut(false);
    }
  };

  /**
   * INSTANT cache loading - shows profile immediately, refreshes in background
   * FIXED: Normalize cached data before setting state
   */
  const loadProfileInstantly = async () => {
    try {
      const userEmail = user?.email || await getCurrentUserEmail();
      if (!userEmail) {
        setError('User email not found');
        return;
      }

      // STEP 1: INSTANT CACHE DISPLAY (NO LOADING SCREEN!)
      const cachedProfile = await getProfileCache(userEmail);
      
      if (cachedProfile) {
        // FIXED: Normalize cached data to prevent object rendering errors
        const normalizedProfile = normalizeProfileData(cachedProfile);
        setProfile(normalizedProfile);
        setLoadSource('permanent_cache');
        setError(null);
        hasLoadedFromCache.current = true;
        
        console.log('✅ Loaded normalized cached profile:', {
          username: normalizedProfile.username,
          instruments: normalizedProfile.instruments,
          instrumentsType: typeof normalizedProfile.instruments
        });
        
        // STEP 2: SILENT BACKGROUND REFRESH (user doesn't see this)
        silentBackgroundRefresh(userEmail);
        
        return normalizedProfile;
      }

      // STEP 3: NO CACHE - LOAD FRESH (first time only)
      setLoading(true);
      await loadFreshProfile(userEmail);
      
    } catch (err) {
      console.error('❌ useProfileData: Error in instant loading:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  /**
   * SILENT background refresh - updates data without user knowing
   * FIXED: Normalize fresh data before comparison and caching
   */
  const silentBackgroundRefresh = async (userEmail) => {
    try {
      backgroundRefreshTimeout.current = setTimeout(async () => {
        setIsBackgroundRefreshing(true);
        
        const freshProfile = await fetchUserProfile('email', userEmail);
        
        if (freshProfile) {
          // FIXED: Normalize both profiles before comparison
          const normalizedFresh = normalizeProfileData(freshProfile);
          const normalizedCurrent = normalizeProfileData(profile);
          
          const currentProfileString = JSON.stringify(normalizedCurrent);
          const freshProfileString = JSON.stringify(normalizedFresh);
          
          if (currentProfileString !== freshProfileString) {
            setProfile(normalizedFresh);
            setLoadSource('background_refresh');
            
            console.log('🔄 Profile updated via background refresh');
          }
          
          // FIXED: Cache the normalized data
          await cacheUserProfile(normalizedFresh, userEmail);
        }
        
        setIsBackgroundRefreshing(false);
      }, 100);
      
    } catch (error) {
      console.error('❌ Background refresh failed:', error);
      setIsBackgroundRefreshing(false);
    }
  };

  /**
   * Load fresh profile (only when no cache exists)
   * FIXED: Normalize fresh data before setting state
   */
  const loadFreshProfile = async (userEmail) => {
    try {
      setLoadSource('fresh_api');
      
      const profileData = await fetchUserProfile('email', userEmail);
      
      if (profileData) {
        // FIXED: Normalize fresh data to prevent object rendering errors
        const normalizedProfile = normalizeProfileData(profileData);
        setProfile(normalizedProfile);
        
        console.log('✅ Loaded normalized fresh profile:', {
          username: normalizedProfile.username,
          instruments: normalizedProfile.instruments,
          instrumentsType: typeof normalizedProfile.instruments
        });
        
        // FIXED: Cache the normalized data
        await cacheUserProfile(normalizedProfile, userEmail);
      } else {
        setError('Profile not found');
      }
    } catch (err) {
      console.error('❌ useProfileData: Fresh profile loading failed:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle pull-to-refresh (user-initiated refresh)
   * FIXED: Normalize refreshed data
   */
  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      const userEmail = user?.email || await getCurrentUserEmail();
      if (userEmail) {
        await loadFreshProfile(userEmail);
      }
    } catch (error) {
      console.error('❌ useProfileData: Pull-to-refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * FIXED: Format instruments for display - safe for all formats
   */
  const formatInstruments = () => {
    if (!profile?.instruments) return 'Guitar, Acoustic Guitar';
    
    // Since we normalize data, instruments should always be a string now
    // But keep safety checks for compatibility
    const instruments = profile.instruments;
    
    if (typeof instruments === 'object' && !Array.isArray(instruments)) {
      // FIXED: Use Object.keys() instead of Object.values()
      const keys = Object.keys(instruments);
      return keys.length > 0 ? keys.join(', ') : 'Guitar, Acoustic Guitar';
    }
    
    if (Array.isArray(instruments)) {
      const filtered = instruments.filter(i => i && i !== null && i !== undefined);
      return filtered.length > 0 ? filtered.join(', ') : 'Guitar, Acoustic Guitar';
    }
    
    return String(instruments) || 'Guitar, Acoustic Guitar';
  };

  /**
   * Initialize profile data on mount
   */
  useEffect(() => {
    loadProfileInstantly();
    
    return () => {
      if (backgroundRefreshTimeout.current) {
        clearTimeout(backgroundRefreshTimeout.current);
      }
    };
  }, []);

  return {
    // Profile data
    profile,
    loading,
    error,
    refreshing,
    loggingOut,
    loadSource,
    isBackgroundRefreshing,
    
    // Handler functions
    handleLogout,
    onRefresh,
    loadProfileInstantly,
    
    // Utility functions
    formatInstruments,
  };
};