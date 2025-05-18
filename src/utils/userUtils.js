// src/utils/userUtils.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getCurrentUserEmail = async () => {
  try {
    const email = await AsyncStorage.getItem('userEmail');
    console.log('Current user email:', email);
    return email || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
};

export const saveUserEmail = async (email) => {
  try {
    await AsyncStorage.setItem('userEmail', email);
    console.log('Email saved:', email);
    return true;
  } catch (error) {
    console.error('Error saving user email:', error);
    return false;
  }
};

export const clearUserEmail = async () => {
  try {
    await AsyncStorage.removeItem('userEmail');
    console.log('User email cleared');
    return true;
  } catch (error) {
    console.error('Error clearing user email:', error);
    return false;
  }
};