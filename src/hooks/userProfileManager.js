// Enhanced userProfileManager.js with video persistence

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUserProfile } from '../services/profileService';
import { getCurrentUserEmail } from '../utils/userUtils';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_KEY = 'profileCache';
const PROFILE_VIDEOS_KEY = 'profileVideos';

/**
 * Custom hook to manage profile data fetching and state
 * @param {Object} options - Configuration options
 * @param {string} options.email - Optional email to load a specific profile
 * @param {string} options.username - Optional username to load a specific profile
 * @param {boolean} options.loadOnFocus - Whether to reload profile when screen comes into focus
 * @param {boolean} options.autoLoad - Whether to load profile automatically
 * @returns {Object} Profile management state and functions
 */
const userProfileManager = ({
    email = null,
    username = null,
    loadOnFocus = true,
    autoLoad = true
  } = {}) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(autoLoad);
    const [error, setError] = useState(null);
    const isFocused = useIsFocused();
    const profileRef = useRef(null);
    const isLoadingRef = useRef(false);
    const lastFocusTimeRef = useRef(0);
  
    // Keep a ref to the latest profile value
    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);
   
    /**
     * Load user profile data
     * @param {boolean} force - Whether to force reload even if profile already exists
     */
    const loadProfile = useCallback(async (force = false) => {
      // Don't load if already loaded and not forced
      if (profileRef.current && !force) return profileRef.current;
      
      // Prevent multiple simultaneous loads
      if (isLoadingRef.current) {
        return null;
      }
      
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      
      try {
        // Try to load from cache first unless forced
        if (!force) {
          const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            
            // IMPORTANT: Check if we need to restore videos from separate cache
            if (!parsed.videos || parsed.videos.length === 0) {
              const cachedVideos = await AsyncStorage.getItem(PROFILE_VIDEOS_KEY);
              if (cachedVideos) {
                parsed.videos = JSON.parse(cachedVideos);
                console.log('Restored videos into cached profile:', parsed.videos.length);
                
                // Update the cache with the restored videos
                await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(parsed));
              }
            }
            
            setProfile(parsed);
            setLoading(false);
            isLoadingRef.current = false;
            return parsed;
          }
        }
        
        // If no cache or forced refresh, load from API
        let userEmail = email;
        let user = username;
        
        // If no email or username provided, get current user's email
        if (!userEmail && !user) {
          userEmail = await getCurrentUserEmail();
          
          if (!userEmail) {
            throw new Error('User email not found');
          }
        }
        
        // Determine which field to use for fetching
        const field = userEmail ? 'email' : 'username';
        const value = userEmail || user;
                
        // Fetch profile data
        console.log(`Fetching profile for ${field}: ${value}`);
        const profileData = await fetchUserProfile(field, value);
        
        // Save videos separately for more reliable caching
        if (profileData.videos && profileData.videos.length > 0) {
          await AsyncStorage.setItem(PROFILE_VIDEOS_KEY, JSON.stringify(profileData.videos));
          console.log('Cached profile videos separately:', profileData.videos.length);
        }
        
        // Cache the full profile
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));
        
        setProfile(profileData);
        return profileData;
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError(err.message || 'Could not load profile data');
        
        // Try to use cached data as fallback if API fails
        try {
          const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            console.log('Using cached profile as fallback after API error');
            setProfile(parsed);
            return parsed;
          }
        } catch (cacheError) {
          console.error('Cache fallback also failed:', cacheError);
        }
        
        return null;
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    }, [email, username]);
    
    /**
     * Force refresh the profile
     */
    const refreshProfile = useCallback(() => {
      return loadProfile(true);
    }, [loadProfile]);
    
    /**
     * Check if profile belongs to current user
     */
    const isCurrentUserProfile = useCallback(async () => {
      try {
        const currentEmail = await getCurrentUserEmail();
        return currentEmail === profileRef.current?.email || email === currentEmail;
      } catch (error) {
        console.error('Error checking if current user profile:', error);
        return false;
      }
    }, [email]);
    
    // Load profile on mount if autoLoad is true
    useEffect(() => {
      if (autoLoad) {
        loadProfile();
      }
    }, [autoLoad, loadProfile]);
    
    // Reload profile when screen comes into focus if loadOnFocus is true
    useEffect(() => {
      if (isFocused && loadOnFocus) {
        // Only reload if it's been at least 1 second since the last focus
        const now = Date.now();
        if (now - lastFocusTimeRef.current > 1000) {
          lastFocusTimeRef.current = now;
          loadProfile(false); // Don't force reload, use cache if available
        }
      }
    }, [isFocused, loadOnFocus, loadProfile]);
    
    return {
      profile,
      loading,
      error,
      loadProfile,
      refreshProfile,
      isCurrentUserProfile
    };
};

export default userProfileManager;