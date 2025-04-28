/**
 * @module SignUpScreen
 * Handles user sign up with full name, username, phone or email, password, and gender.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PhoneInput from 'react-native-phone-number-input';
import * as Localization from 'expo-localization';
import { useSignupBuilder } from '../context/SignupFlowContext';
import { Auth } from 'aws-amplify';

/**
 * @function getDefaultCountryCode
 * @description Retrieves the default country code from the device locale settings.
 * @returns {string} Country code (e.g., 'IL', 'US')
 */
const getDefaultCountryCode = () => {
  const region = Localization.region;
  const locale = Localization.locale.split('-')[1];
  return region || locale || 'IL';
};

const defaultCountryCode = getDefaultCountryCode();

/**
 * @function SignUpScreen
 * @description Allows users to input their signup information and create an account.
 * @returns {JSX.Element}
 */
const SignUpScreen = () => {
  const navigation = useNavigation();
  const builder = useSignupBuilder();
  const [userType, setUserType] = useState('musician');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [gender, setGender] = useState('male');
  const phoneInputRef = useRef(null);
  const [authError, setAuthError] = useState('');
  const [passwordError, setPasswordError] = useState('');

    /**
   * @function isValidEmail
   * @description Validates an email string.
   * @param {string} email - Email to validate.
   * @returns {boolean}
   */
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  /**
   * @function isValidPassword
   * @description Validates if a password has at least one capital letter and one number.
   * @param {string} value - Password to validate.
   * @returns {boolean}
   */
  const isValidPassword = (value) => /[A-Z]/.test(value) && /[0-9]/.test(value);

   /**
   * @function handleContinue
   * @description Validates signup form and attempts to create a user account.
   */
  const handleContinue = async () => {
    let valid = true;

    if (authMethod === 'phone') {
      const isValid = phoneInputRef.current?.isValidNumber(formattedPhone);
      if (!isValid) {
        setAuthError('Enter a valid phone number');
        valid = false;
      } else {
        setPhone(formattedPhone);
        setAuthError('');
      }
    } else {
      if (!isValidEmail(email)) {
        setAuthError('Enter a valid email address');
        valid = false;
      } else {
        setAuthError('');
      }
    }

    if (!isValidPassword(password)) {
      setPasswordError('Password must contain at least 1 capital letter and 1 number');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!valid) return;

    builder
      .setFullName(fullName)
      .setUsername(username)
      .setUserType(userType)
      .setPassword(password)
      .setGender(gender);

    if (authMethod === 'phone') {
      builder.setPhoneNumber(formattedPhone);
    } else {
      builder.setEmail(email);
    }

    const user = builder.build();

    try {
      await Auth.signUp({
        username: user.username,
        password: user.password,
        attributes: {
          email: user.email || undefined,
          phone_number: user.phoneNumber || undefined,
          name: user.fullName,
          gender: user.gender,
          locale: Localization.locale || 'en-US',
          picture: 'https://your-default-profile-url.com/default.png',
        },
      });
  
      console.log('✅ SignUp successful');
      navigation.navigate('Confirm Code', { username: user.username, password: user.password });
    }

    catch (error) {
      console.error('❌ Error signing up:', error);
      Alert.alert('Error', error.message || 'Failed to sign up.');
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

      <View style={styles.inner}>
        <Text style={styles.title}>Sign Up</Text>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, userType === 'musician' && styles.toggleSelected]}
            onPress={() => setUserType('musician')}
          >
            <Text style={userType === 'musician' ? styles.toggleTextSelected : styles.toggleText}>Musician</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, userType === 'business' && styles.toggleSelected]}
            onPress={() => setUserType('business')}
          >
            <Text style={userType === 'business' ? styles.toggleTextSelected : styles.toggleText}>Business</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
          placeholderTextColor="#666"
        />

        <View style={styles.methodToggleContainer}>
          <TouchableOpacity
            onPress={() => setAuthMethod('phone')}
            style={[styles.methodButton, authMethod === 'phone' && styles.methodSelected]}
          >
            <Text style={authMethod === 'phone' ? styles.methodTextSelected : styles.methodText}>Use Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAuthMethod('email')}
            style={[styles.methodButton, authMethod === 'email' && styles.methodSelected]}
          >
            <Text style={authMethod === 'email' ? styles.methodTextSelected : styles.methodText}>Use Email</Text>
          </TouchableOpacity>
        </View>

        {authMethod === 'phone' ? (
          <PhoneInput
            ref={phoneInputRef}
            defaultValue={phone}
            value={phone}
            defaultCode={defaultCountryCode}
            layout="first"
            onChangeText={setPhone}
            onChangeFormattedText={setFormattedPhone}
            containerStyle={styles.phoneInput}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={styles.phoneInputText}
            codeTextStyle={styles.codeTextStyle}
            textInputProps={{ placeholderTextColor: '#666' }}
          />
        ) : (
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}

        {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          placeholderTextColor="#666"
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
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#666" />
          </TouchableOpacity>
        </View>
        {passwordError !== '' && <Text style={styles.errorText}>{passwordError}</Text>}

        <View style={styles.genderContainer}>
          <Text style={styles.genderLabel}>Gender</Text>
          <View style={styles.genderOptions}>
            <TouchableOpacity
              style={[styles.genderOption, gender === 'male' && styles.genderSelected]}
              onPress={() => setGender('male')}
            >
              <Text style={gender === 'male' ? styles.genderTextSelected : styles.genderText}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderOption, gender === 'female' && styles.genderSelected]}
              onPress={() => setGender('female')}
            >
              <Text style={gender === 'female' ? styles.genderTextSelected : styles.genderText}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingTop: 140, paddingHorizontal: 30 },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  title: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    marginBottom: 30,
    alignSelf: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    marginHorizontal: 10,
  },
  toggleSelected: { backgroundColor: 'white' },
  toggleText: { color: 'white', fontWeight: 'bold' },
  toggleTextSelected: { color: '#000', fontWeight: 'bold' },
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
  phoneInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    height: 48,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 20,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 0,
    height: '100%',
  },
  phoneInputText: { fontSize: 15, color: '#000' },
  codeTextStyle: { fontSize: 15, color: '#000' },
  methodToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  methodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
  },
  methodSelected: { backgroundColor: 'white' },
  methodText: { color: 'white', fontWeight: 'bold' },
  methodTextSelected: { color: '#000', fontWeight: 'bold' },
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
  genderContainer: {
    marginTop: 7,
    marginBottom: 20,
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'white',
    alignSelf: 'center',
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  genderOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    marginHorizontal: 5,
  },
  genderSelected: { backgroundColor: 'white' },
  genderText: { color: 'white', fontWeight: 'bold' },
  genderTextSelected: { color: '#000', fontWeight: 'bold' },
});

export default SignUpScreen;