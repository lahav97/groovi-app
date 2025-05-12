import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../screens/authentication/LoginScreen';
import FeedScreen from '../screens/main/FeedScreen';
import PhoneOrEmailScreen from '../screens/authentication/PhoneOrEmailScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SignupNavigator from './SignupNavigator';
import FilterScreen from '../screens/main/FilterScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Phone Or Email" component={PhoneOrEmailScreen} />
        <Stack.Screen name="SignupFlow" component={SignupNavigator} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Filter" component={FilterScreen} /> 
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;