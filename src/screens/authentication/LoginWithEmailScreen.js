/**
 * @module PhoneOrEmailScreen
 * Screen where users choose to log in using phone number or email address.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/common/Button';
import { Auth } from 'aws-amplify';

/**
 * @function PhoneOrEmailScreen
 * @description Allows users to log in either via phone number or email address.
 * @returns {JSX.Element} The PhoneOrEmailScreen component.
 */
const LoginWithEmailScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();

  /**
   * @function handleContinue
   * @description Validates user input and signs in the user if valid.
   */
  const handleContinue = async () => {
    setAuthError('');
    if (!password) {
      setAuthError('Please enter a password');
      return;
    }
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      setAuthError('Please enter a valid email address');
      return;
    } else {
      console.log('📧 Email is valid:', email);
      setIsLoading(true);
      try {
        await Auth.signIn({
          username: email, 
          password: password,
        });
        setIsLoading(false);
        navigation.navigate('Feed');
      } catch (error) {
        setIsLoading(false);
        console.error('Error signing in with email:', error);
        if (error.code === 'UserNotFoundException') {
          setAuthError('Account not found. Please check your email.');
        } else if (error.code === 'NotAuthorizedException') {
          setAuthError('Incorrect password. Please try again.');
        } else {
          setAuthError(error.message || 'Failed to sign in. Please try again.');
        }
      }
    }
  };

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>Log In</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            placeholderTextColor="#666"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            style={{
              position: 'absolute',
              right: 20,
              top: 0,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

        <Button
          title={isLoading ? "Signing in..." : "Continue"}
          onPress={handleContinue}
          style={styles.continueButton}
          textStyle={styles.continueText}
          disabled={isLoading}
        />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingTop: 160, paddingHorizontal: 30 },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  title: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    marginBottom: 40,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
    width: '100%',
    alignSelf: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 12,
    marginLeft: 5,
    fontSize: 13,
  },
  continueButton: {
    backgroundColor: 'white',
    paddingVertical: 18,
    borderRadius: 40,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    alignSelf: 'center',
  },
  continueText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
});

export default LoginWithEmailScreen;