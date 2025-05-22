// src/context/AuthContext.js - FIXED 
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'aws-amplify';

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
      
      console.log('Current user attributes:', userInfo.attributes);
      console.log('Current user email:', userEmail);
      
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
      
      console.log('User is already signed in:', userData);
      console.log('Has completed onboarding:', onboardingCompleted);
    } catch (error) {
      // No authenticated user found
      console.log('No authenticated user found');
      setUser(null);
      setIsSignedIn(false);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem('userData');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    setIsLoading(true);
    try {
      // Sign in with Amplify
      const userInfo = await Auth.signIn(email, password);
      
      // IMPORTANT: Check if user has completed onboarding
      const onboardingCompleted = userInfo.attributes?.['custom:onboardingCompleted'] === 'true';
      
      // Ensure we're getting the email from the correct place
      // Either directly from attributes or from the passed parameter
      const userEmail = userInfo.attributes?.email || email || userInfo.username;
      
      console.log('Sign in successful - User email:', userEmail);
      console.log('User attributes:', userInfo.attributes);
      
      // Format user data
      const userData = {
        id: userInfo.attributes?.sub || userInfo?.username,
        username: userInfo.username,
        email: userEmail, // Make sure email is saved
        phone: userInfo.attributes?.phone_number,
        hasCompletedOnboarding: onboardingCompleted
      };
      
      // Update state
      setUser(userData);
      setIsSignedIn(true);
      setHasCompletedOnboarding(onboardingCompleted);
      
      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('Signed in successfully:', userData);
      console.log('Has completed onboarding:', onboardingCompleted);
      
      return { 
        success: true,
        hasCompletedOnboarding: onboardingCompleted,
        userData // Return the user data for immediate access
      };
    } catch (error) {
      console.error('Sign in error:', error);
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
      
      console.log('Signed up successfully, confirmation required');
      
      return {
        success: true,
        data: {
          username: email,
          email
        }
      };
    } catch (error) {
      console.error('Sign up error:', error);
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
      console.log('Confirmed sign up successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Confirm sign up error:', error);
      return {
        success: false,
        error: error.message || 'Failed to confirm sign up'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user exists in Cognito - FIXED THE FUNCTION NAME
  const checkUserExistsInCognito = async (email) => {
    try {
      // An indirect way to check if a user exists - try forgotPassword
      await Auth.forgotPassword(email);
      return { exists: true };
    } catch (error) {
      console.log('Check user exists error:', error);
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
      
      console.log('Marked onboarding as complete');
      return { success: true };
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark onboarding as complete'
      };
    }
  };

  // Resend confirmation code - MOVED INSIDE THE PROVIDER
  const resendConfirmationCode = async (username) => {
    setIsLoading(true);
    try {
      await Auth.resendSignUp(username);
      console.log('Confirmation code resent successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Resend confirmation code error:', error);
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
      await Auth.signOut();
      
      // Clear state and storage
      setUser(null);
      setIsSignedIn(false);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem('userData');
      
      console.log('Signed out successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
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
      setUser(userData);
      setIsSignedIn(true);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      console.error('Federated sign in error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign in'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Provide all auth methods and state
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSignedIn,
        hasCompletedOnboarding,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        federatedSignIn,
        refreshUser: checkAuthState,
        resendConfirmationCode,
        checkUserExistsInCognito, // FIXED the function name
        completeOnboarding
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);