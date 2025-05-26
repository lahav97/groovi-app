import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignUpScreen from '../screens/authentication/SignUpScreen';
import ConfirmScreen from '../screens/authentication/ConfirmCodeScreen';

const Stack = createNativeStackNavigator();

const SignupNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Sign Up" component={SignUpScreen} />
      <Stack.Screen name="Confirm Code" component={ConfirmScreen} />
    </Stack.Navigator>
  );
};

export default SignupNavigator;