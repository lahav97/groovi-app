import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'aws-amplify';
import BackgroundDataService from '../services/BackgroundDataService';
import { saveUserEmail, clearUserEmail } from '../utils/userUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Prevent duplicate background loading
  const backgroundLoadingTriggered = useRef(false);
  const lastLoadingEmail = useRef(null);

  // Initialize - check if user is already signed in
  useEffect(() => {
    checkAuthState();
  }, []);

  // Check auth state with duplicate prevention
  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      const userInfo = await Auth.currentAuthenticatedUser();
      
      const onboardingCompleted = userInfo.attributes?.
        ['custom:onboardingCompleted'] === 'true';
      const userEmail = userInfo.attributes?.email || userInfo.username;
      
      console.log('🔍 AuthContext: Current user:', userEmail);
      console.log('🔍 AuthContext: Onboarding completed:', onboardingCompleted);
      
      const userData = {
        id: userInfo.attributes?.sub,
        username: userInfo.username,
        email: userEmail,
        phone: userInfo.attributes?.phone_number,
        hasCompletedOnboarding: onboardingCompleted
      };
      
      setUser(userData);
      setIsSignedIn(true);
      setHasCompletedOnboarding(onboardingCompleted);
      
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userEmail);
      
      // ✨ ENHANCED: Trigger parallel loading (discover + profile) only once per email
      if (onboardingCompleted && userEmail && 
          (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userEmail)) {
        backgroundLoadingTriggered.current = true;
        lastLoadingEmail.current = userEmail;
        
        console.log('🚀 AuthContext: Starting parallel loading (Discover + Profile)');
        BackgroundDataService.startParallelLoading(userData);
      }
      
      console.log('✅ AuthContext: User restored from session');
    } catch (error) {
      console.log('ℹ️ AuthContext: No authenticated user found');
      setUser(null);
      setIsSignedIn(false);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem('userData');
      await clearUserEmail();
      
      // Reset background loading tracker
      backgroundLoadingTriggered.current = false;
      lastLoadingEmail.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in
  const signIn = async (email, password) => {
    try {
      console.log('🔐 AuthContext: Signing in:', email);
      
      const userInfo = await Auth.signIn(email, password);
      const onboardingCompleted = userInfo.attributes?.
        ['custom:onboardingCompleted'] === 'true';
      const userEmail = userInfo.attributes?.email || email || userInfo.username;
      
      console.log('✅ AuthContext: Sign in successful');
      console.log('🔍 AuthContext: Onboarding completed:', onboardingCompleted);
      
      const userData = {
        id: userInfo.attributes?.sub || userInfo?.username,
        username: userInfo.username,
        email: userEmail,
        phone: userInfo.attributes?.phone_number,
        hasCompletedOnboarding: onboardingCompleted
      };
      
      setUser(userData);
      setIsSignedIn(true);
      setHasCompletedOnboarding(onboardingCompleted);
      
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userEmail);
      
      // ✨ ENHANCED: Trigger parallel loading only once per email
      if (onboardingCompleted && 
          (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userEmail)) {
        backgroundLoadingTriggered.current = true;
        lastLoadingEmail.current = userEmail;
        
        // Small delay to let UI update first
        setTimeout(() => {
          console.log('🚀 AuthContext: Starting parallel loading after sign in');
          BackgroundDataService.startParallelLoading(userData);
        }, 300);
      }
      
      return { 
        success: true,
        hasCompletedOnboarding: onboardingCompleted,
        userData
      };
    } catch (error) {
      console.error('❌ AuthContext: Sign in error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign in' 
      };
    }
  };

  // Sign up with email, password, and other details
  const signUp = async (username, email, password, attributes = {}) => {
    setIsLoading(true);
    try {
      console.log('📝 AuthContext: Signing up:', email);
      
      const updatedAttributes = {
        ...attributes,
        'custom:onboardingCompleted': 'false'
      };
      
      const { user } = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          ...updatedAttributes
        }
      });
      
      console.log('✅ AuthContext: Sign up successful');
      
      return { 
        success: true, 
        user,
        needsConfirmation: true 
      };
    } catch (error) {
      console.error('❌ AuthContext: Sign up error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign up' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm sign up
  const confirmSignUp = async (username, code) => {
    try {
      console.log('✅ AuthContext: Confirming sign up for:', username);
      
      await Auth.confirmSignUp(username, code);
      console.log('✅ AuthContext: Sign up confirmed');
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Confirm sign up error:', error);
      return {
        success: false,
        error: error.message || 'Failed to confirm sign up'
      };
    }
  };

  // Check if user exists in Cognito
  const checkUserExistsInCognito = async (username) => {
    try {
      await Auth.forgotPassword(username);
      return { exists: true, error: null };
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        return { exists: false, error: null };
      }
      return { exists: false, error: error.message };
    }
  };

  // Complete onboarding
  const completeOnboarding = async () => {
    try {
      console.log('🎯 AuthContext: Completing onboarding...');
      
      if (!user) {
        throw new Error('No user found');
      }

      await Auth.updateUserAttributes(user, {
        'custom:onboardingCompleted': 'true'
      });

      const updatedUser = { ...user, hasCompletedOnboarding: true };
      setUser(updatedUser);
      setHasCompletedOnboarding(true);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

      // ✨ ENHANCED: Trigger parallel loading after onboarding completion
      if (!backgroundLoadingTriggered.current) {
        backgroundLoadingTriggered.current = true;
        lastLoadingEmail.current = updatedUser.email;
        
        setTimeout(() => {
          console.log('🚀 AuthContext: Starting parallel loading after onboarding');
          BackgroundDataService.startParallelLoading(updatedUser);
        }, 800);
      }
      
      console.log('✅ AuthContext: Onboarding completed');
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Error completing onboarding:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark onboarding as complete'
      };
    }
  };

  // Resend confirmation code - NO GLOBAL LOADING STATE CHANGES  
  const resendConfirmationCode = async (username) => {
    try {
      await Auth.resendSignUp(username);
      console.log('✅ AuthContext: Confirmation code resent');
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Resend confirmation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend confirmation code'
      };
    }
    // No finally block - don't change global loading state
  };

  // Sign out with cleanup
  const signOut = async () => {
    setIsLoading(true);
    try {
      console.log('🚪 AuthContext: Signing out...');
      
      await Auth.signOut();
      
      // Clear state and storage
      setUser(null);
      setIsSignedIn(false);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem('userData');
      await clearUserEmail();
      
      // Reset background loading tracker
      backgroundLoadingTriggered.current = false;
      lastLoadingEmail.current = null;
      
      console.log('✅ AuthContext: Signed out successfully');
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Sign out error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign out'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Social sign in with duplicate prevention
  const federatedSignIn = async (provider, token, userData) => {
    setIsLoading(true);
    try {
      console.log('🔗 AuthContext: Federated sign in:', provider);
      
      setUser(userData);
      setIsSignedIn(true);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userData.email);
      
      // ✨ ENHANCED: Trigger parallel loading for social sign in
      if (userData.email && 
          (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userData.email)) {
        backgroundLoadingTriggered.current = true;
        lastLoadingEmail.current = userData.email;
        
        setTimeout(() => {
          console.log('🚀 AuthContext: Starting parallel loading after social sign in');
          BackgroundDataService.startParallelLoading(userData);
        }, 300);
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Federated sign in error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign in'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user without duplicate loading
  const refreshUser = async () => {
    const wasTriggered = backgroundLoadingTriggered.current;
    const lastEmail = lastLoadingEmail.current;
    
    await checkAuthState();
    
    // Restore previous state to prevent duplicate loading
    backgroundLoadingTriggered.current = wasTriggered;
    lastLoadingEmail.current = lastEmail;
  };

  // Get background loading status
  const getBackgroundLoadingStatus = () => {
    return BackgroundDataService.getLoadingStatus();
  };

  // Force refresh all background data
  const forceRefreshAllData = async () => {
    console.log('🔄 AuthContext: Force refreshing all data...');
    await BackgroundDataService.forceRefreshAll();
  };

  return (
    <AuthContext.Provider
      value={{
        // State
        user,
        isLoading,
        isSignedIn,
        hasCompletedOnboarding,
        
        // Auth methods
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        federatedSignIn,
        
        // Utility methods
        refreshUser,
        resendConfirmationCode,
        checkUserExistsInCognito,
        completeOnboarding,
        
        // Background loading methods
        getBackgroundLoadingStatus,
        forceRefreshAllData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);