import React, { createContext, useState, useContext, useEffect } from 'react';
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

  // Initialize - check if user is already signed in
  useEffect(() => {
    checkAuthState();
  }, []);

  // Function to check authentication state
  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      const userInfo = await Auth.currentAuthenticatedUser();
      
      // Check if user has completed onboarding
      const onboardingCompleted = userInfo.attributes?.['custom:onboardingCompleted'] === 'true';
      
      // Use the best available source for email
      const userEmail = userInfo.attributes?.email || userInfo.username;
      
      console.log('🔍 AuthContext: Current user email:', userEmail);
      console.log('🔍 AuthContext: Has completed onboarding:', onboardingCompleted);
      
      // Format user data consistently
      const userData = {
        id: userInfo.attributes?.sub,
        username: userInfo.username,
        email: userEmail,
        phone: userInfo.attributes?.phone_number,
        hasCompletedOnboarding: onboardingCompleted
      };
      
      // Update state
      setUser(userData);
      setIsSignedIn(true);
      setHasCompletedOnboarding(onboardingCompleted);
      
      // Store user data in AsyncStorage for persistence
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userEmail); // Save email for profile loading
      
      // 🚀 TRIGGER BACKGROUND LOADING if user has completed onboarding
      if (onboardingCompleted && userEmail) {
        console.log('🚀 AuthContext: Triggering background data loading...');
        BackgroundDataService.startStagedLoading(userData);
      }
      
      console.log('✅ AuthContext: User restored from existing session');
    } catch (error) {
      // No authenticated user found
      console.log('ℹ️ AuthContext: No authenticated user found');
      setUser(null);
      setIsSignedIn(false);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem('userData');
      await clearUserEmail();
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    setIsLoading(true);
    try {
      console.log('🔐 AuthContext: Attempting sign in for:', email);
      
      // Sign in with Amplify
      const userInfo = await Auth.signIn(email, password);
      
      // Check if user has completed onboarding
      const onboardingCompleted = userInfo.attributes?.['custom:onboardingCompleted'] === 'true';
      
      // Ensure we're getting the email from the correct place
      const userEmail = userInfo.attributes?.email || email || userInfo.username;
      
      console.log('✅ AuthContext: Sign in successful for:', userEmail);
      console.log('🔍 AuthContext: Onboarding completed:', onboardingCompleted);
      
      // Format user data
      const userData = {
        id: userInfo.attributes?.sub || userInfo?.username,
        username: userInfo.username,
        email: userEmail,
        phone: userInfo.attributes?.phone_number,
        hasCompletedOnboarding: onboardingCompleted
      };
      
      // Update state
      setUser(userData);
      setIsSignedIn(true);
      setHasCompletedOnboarding(onboardingCompleted);
      
      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userEmail); // Save email for profile loading
      
      // 🚀 TRIGGER BACKGROUND LOADING if user has completed onboarding
      if (onboardingCompleted) {
        console.log('🚀 AuthContext: Starting background data loading after sign in...');
        // Small delay to let UI update first
        setTimeout(() => {
          BackgroundDataService.startStagedLoading(userData);
        }, 500);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email, password, and other details
  const signUp = async (username, email, password, attributes = {}) => {
    setIsLoading(true);
    try {
      console.log('📝 AuthContext: Attempting sign up for:', email);
      
      // Add onboarding attribute defaulting to false
      const updatedAttributes = {
        ...attributes,
        'custom:onboardingCompleted': 'false'
      };
      
      // Sign up with Amplify
      const { user } = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          ...updatedAttributes
        }
      });
      
      console.log('✅ AuthContext: Sign up successful, confirmation required');
      
      return {
        success: true,
        data: {
          username: email,
          email
        }
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

  // Confirm sign up (verification code)
  const confirmSignUp = async (username, code) => {
    setIsLoading(true);
    try {
      await Auth.confirmSignUp(username, code);
      console.log('✅ AuthContext: Sign up confirmed successfully');
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Confirm sign up error:', error);
      return {
        success: false,
        error: error.message || 'Failed to confirm sign up'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user exists in Cognito
  const checkUserExistsInCognito = async (email) => {
    try {
      // An indirect way to check if a user exists - try forgotPassword
      await Auth.forgotPassword(email);
      return { exists: true };
    } catch (error) {
      console.log('ℹ️ AuthContext: Check user exists result:', error.code);
      if (error.code === 'UserNotFoundException') {
        return { exists: false };
      }
      // Any other error means user likely exists but there was a problem
      return { exists: true, error: error.message };
    }
  };

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    try {
      console.log('🎯 AuthContext: Completing onboarding...');
      
      const currentUser = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(currentUser, {
        'custom:onboardingCompleted': 'true'
      });
      
      // Update state
      setHasCompletedOnboarding(true);
      
      // Update the user object in state and AsyncStorage
      const updatedUser = { ...user, hasCompletedOnboarding: true };
      setUser(updatedUser);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      
      // 🚀 TRIGGER BACKGROUND LOADING after onboarding completion
      if (updatedUser.email) {
        console.log('🚀 AuthContext: Starting background loading after onboarding completion...');
        setTimeout(() => {
          BackgroundDataService.startStagedLoading(updatedUser);
        }, 1000); // Give UI time to navigate to main app
      }
      
      console.log('✅ AuthContext: Onboarding marked as complete');
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Error completing onboarding:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark onboarding as complete'
      };
    }
  };

  // Resend confirmation code
  const resendConfirmationCode = async (username) => {
    setIsLoading(true);
    try {
      await Auth.resendSignUp(username);
      console.log('✅ AuthContext: Confirmation code resent successfully');
      
      return { success: true };
    } catch (error) {
      console.error('❌ AuthContext: Resend confirmation code error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend confirmation code'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
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

  // Social sign in (for Google, Facebook, etc.)
  const federatedSignIn = async (provider, token, userData) => {
    setIsLoading(true);
    try {
      console.log('🔗 AuthContext: Federated sign in for provider:', provider);
      
      setUser(userData);
      setIsSignedIn(true);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await saveUserEmail(userData.email);
      
      // 🚀 TRIGGER BACKGROUND LOADING for social sign in
      if (userData.email) {
        console.log('🚀 AuthContext: Starting background loading after social sign in...');
        setTimeout(() => {
          BackgroundDataService.startStagedLoading(userData);
        }, 500);
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

  // Force refresh user data and trigger background loading
  const refreshUser = async () => {
    console.log('🔄 AuthContext: Refreshing user data...');
    await checkAuthState();
  };

  // Get background loading status (for debugging/UI)
  const getBackgroundLoadingStatus = () => {
    return BackgroundDataService.getLoadingStatus();
  };

  // Force refresh all background data
  const forceRefreshAllData = async () => {
    console.log('🔄 AuthContext: Force refreshing all background data...');
    await BackgroundDataService.forceRefreshAll();
  };

  // Provide all auth methods and state
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

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);