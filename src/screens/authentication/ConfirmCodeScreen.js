/**
 * @module ConfirmCodeScreen
 * Screen for confirming a user's signup by entering a verification code.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { Auth } from 'aws-amplify';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../../components/common/Button';

/**
 * @function ConfirmCodeScreen
 * @description Handles the verification code input and confirmation process for signing up a user.
 * @returns {JSX.Element} The confirmation screen component.
 */
const ConfirmCodeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { username, password } = route.params || {};

  const [code, setCode] = useState('');

  /**
   * @function handleConfirm
   * @description Confirms the sign-up using the verification code and signs the user in.
   */
  const handleConfirm = async () => {
    try {
      await Auth.confirmSignUp(username, code);
      await Auth.signIn(username, password);

      Alert.alert('✅ Success', 'Your account has been confirmed!');
      navigation.navigate('Instruments');
    } catch (error) {
      console.log('❌ Error confirming sign up:', error);
      Alert.alert('Error', error.message || 'Failed to confirm sign up.');
    }
  };

  /**
   * @function handleResendCode
   * @description Resends the confirmation code to the user.
   */
  const handleResendCode = async () => {
    try {
      await Auth.resendSignUp(username);
      Alert.alert('✅ Success', 'Verification code resent to your email or phone.');
    } catch (error) {
      console.log('❌ Error resending code:', error);
      Alert.alert('Error', error.message || 'Failed to resend code.');
    }
  };

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter your verification code</Text>
        <TextInput
          style={styles.input}
          placeholder="Verification code"
          keyboardType="number-pad"
          onChangeText={setCode}
          value={code}
          placeholderTextColor="#666"
        />

        <Button
          title="CONFIRM"
          onPress={handleConfirm}
          style={styles.confirmButton}
          textStyle={styles.confirmText}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive a code?</Text>
          <Button
            title="RESEND CODE"
            onPress={handleResendCode}
            style={styles.resendButton}
            textStyle={styles.resendButtonText}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingTop: 140, paddingHorizontal: 30, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white', marginBottom: 30 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  resendContainer: { alignItems: 'center' },
  resendText: { color: 'white', fontSize: 14, marginBottom: 8 },
  resendButton: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  resendButtonText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
});

export default ConfirmCodeScreen;