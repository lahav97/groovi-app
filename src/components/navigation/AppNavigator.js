import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../../screens/LoginScreen';
import SignUpScreen from '../../screens/SignUpScreen'; 
import InstrumentsScreen from '../../screens/InstrumentsScreen';
import FeedScreen from '../../screens/FeedScreen';
import PhoneOrEmailScreen from '../../screens/PhoneOrEmailScreen';
import ProfileSetupScreen from '../../screens/ProfileSetupScreen';
import ProfileScreen from '../../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Profile">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Sign Up" component={SignUpScreen} />
        <Stack.Screen name="Instruments" component={InstrumentsScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Phone Or Email" component={PhoneOrEmailScreen} />
        <Stack.Screen name="Profile Setup" component={ProfileSetupScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;