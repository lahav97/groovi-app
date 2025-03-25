import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import FeedScreen from './src/screens/FeedScreen';
import BottomNavigation from './src/components/navigation/BottomNavigation';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      <FeedScreen />
      <BottomNavigation />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default App;