import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { Amplify } from 'aws-amplify';
import awsConfig from './src/utils/awsConfig';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

Amplify.configure(awsConfig);

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}