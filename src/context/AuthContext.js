// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'aws-amplify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Initialize - check if user is already signed in
  useEffect(() => {
    checkAuthState();
  }, []);

  // Function to check authentication state
  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      const userInfo = await Auth.currentAuthenticatedUser();
      
      // Format user data consistently
      const userData = {
        id: userInfo.attributes?.sub,
        username: userInfo.username,
        email: userInfo.attributes?.email,
      };
      
      // Update state
      setUser(userData);
      setIsSignedIn(true);
      
      // Store user data in AsyncStorage for persistence
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('User is already signed in:', userData);
    } catch (error) {
      // No authenticated user found
      console.log('No authenticated user found');
      setUser(null);
      setIsSignedIn(false);
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
      
      // Format user data
      const userData = {
        id: userInfo.attributes?.sub || userInfo?.username,
        username: userInfo.username,
        email: userInfo.attributes?.email || email,
      };
      
      // Update state
      setUser(userData);
      setIsSignedIn(true);
      
      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('Signed in successfully:', userData);
      
      return { success: true };
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
      // Sign up with Amplify
      const { user } = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          ...attributes
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
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        federatedSignIn,
        refreshUser: checkAuthState,
        resendConfirmationCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);