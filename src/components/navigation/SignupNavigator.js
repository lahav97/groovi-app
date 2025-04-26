import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignupFlowProvider } from '../../context/SignupFlowContext';
import SignUpScreen from '../../screens/SignUpScreen';
import InstrumentsScreen from '../../screens/InstrumentsScreen';
import ProfileSetupScreen from '../../screens/ProfileSetupScreen';
import ConfirmScreen from '../../screens/ConfirmCodeScreen';

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
