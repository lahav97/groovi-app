/**
 * @module useProfileData
 * Custom hook for profile data loading with instant cache and background refresh
 * Handles all profile loading logic, caching, and state management
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
        setProfile(cachedProfile);
        setLoadSource('permanent_cache');
        setError(null);
        hasLoadedFromCache.current = true;
        
        // STEP 2: SILENT BACKGROUND REFRESH (user doesn't see this)
        silentBackgroundRefresh(userEmail);
        
        return cachedProfile;
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
   */
  const silentBackgroundRefresh = async (userEmail) => {
    try {
      backgroundRefreshTimeout.current = setTimeout(async () => {
        setIsBackgroundRefreshing(true);
        
        const freshProfile = await fetchUserProfile('email', userEmail);
        
        if (freshProfile) {
          const currentProfileString = JSON.stringify(profile);
          const freshProfileString = JSON.stringify(freshProfile);
          
          if (currentProfileString !== freshProfileString) {
            setProfile(freshProfile);
            setLoadSource('background_refresh');
          }
          
          await cacheUserProfile(freshProfile, userEmail);
        }
        
        setIsBackgroundRefreshing(false);
      }, 100);
      
    } catch (error) {
      setIsBackgroundRefreshing(false);
    }
  };

  /**
   * Load fresh profile (only when no cache exists)
   */
  const loadFreshProfile = async (userEmail) => {
    try {
      setLoadSource('fresh_api');
      
      const profileData = await fetchUserProfile('email', userEmail);
      
      if (profileData) {
        setProfile(profileData);
        await cacheUserProfile(profileData, userEmail);
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
   * Format instruments for display
   */
  const formatInstruments = () => {
    if (!profile?.instruments) return 'Guitar, Acoustic Guitar';
    
    if (typeof profile.instruments === 'object') {
      return Object.values(profile.instruments).join(', ');
    }
    
    if (Array.isArray(profile.instruments)) {
      return profile.instruments.join(', ');
    }
    
    return profile.instruments.toString();
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