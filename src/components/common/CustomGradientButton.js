import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const CustomGradientButton = ({ 
  title, 
  onPress, 
  style, 
  colors = ['#ff6ec4', '#ffc93c', '#1c92d2'],
  isLoading = false,
  disabled = false
}) => {
  return (
    <View 
      style={[
        styles.button, 
        disabled && styles.disabledButton, 
        style
      ]}
    >
      {/* Base color */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]} />
      
      {/* Right gradient effect */}
      <View 
        style={[
          styles.rightColor, 
          { backgroundColor: colors[2] }
        ]} 
      />
      
      {/* Middle gradient effect */}
      <View 
        style={[
          styles.centerColor, 
          { backgroundColor: colors[1] }
        ]} 
      />
      
      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  disabledButton: {
    opacity: 0.5,
  },
  rightColor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
    height: '100%',
    opacity: 0.6,
  },
  centerColor: {
    position: 'absolute',
    left: '25%',
    top: 0,
    width: '50%',
    height: '100%',
    opacity: 0.3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  }
});

export default CustomGradientButton;