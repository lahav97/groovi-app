import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { Amplify } from 'aws-amplify';
import awsConfig from './src/utils/awsConfig';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { LogBox, StyleSheet } from 'react-native';

Amplify.configure(awsConfig);

LogBox.ignoreLogs([
  'Support for defaultProps will be removed from function components',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
