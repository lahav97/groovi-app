import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../../screens/LoginScreen';
import FeedScreen from '../../screens/FeedScreen';
import PhoneOrEmailScreen from '../../screens/PhoneOrEmailScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import SignupNavigator from './SignupNavigator';

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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;