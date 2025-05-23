import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignupFlowProvider } from '../context/SignupFlowContext';
import SignUpScreen from '../screens/authentication/SignUpScreen';
import InstrumentsScreen from '../screens/onboarding/InstrumentsScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import ConfirmScreen from '../screens/authentication/ConfirmCodeScreen';

const Stack = createNativeStackNavigator();

const SignupNavigator = () => {
  return (
    <SignupFlowProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Sign Up" component={SignUpScreen} />
        <Stack.Screen name="Confirm Code" component={ConfirmScreen} />
        <Stack.Screen name="Instruments" component={InstrumentsScreen} />
        <Stack.Screen name="Profile Setup" component={ProfileSetupScreen} />
      </Stack.Navigator>
    </SignupFlowProvider>
  );
};

export default SignupNavigator;
