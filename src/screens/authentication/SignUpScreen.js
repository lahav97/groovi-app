/**
 * @module SignUpScreen
 * Handles user sign up with full name, username, email, password, birthday, and gender.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import { Auth } from 'aws-amplify';
import Button from '../../components/common/Button';
import axios from 'axios';
import { COLORS } from '../../styles/theme';
import {
  ERROR_MESSAGES,
  handleError
} from '../../utils/errors';

/**
 * @function SignUpScreen
 * @description Allows users to input their signup information and create an account.
 * @returns {JSX.Element}
 */
const SignUpScreen = () => {
  const navigation = useNavigation();
  const builder = useSignupBuilder();
  const [userType, setUserType] = React.useState('musician');
  const [fullName, setFullName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [gender, setGender] = React.useState('male');
  const [birthdayDate, setBirthdayDate] = React.useState(null);
  const [day, setDay] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [year, setYear] = React.useState('');
  const [showPicker, setShowPicker] = React.useState('');
  
  // Email validation states
  const [emailError, setEmailError] = React.useState('');
  const [isCheckingEmail, setIsCheckingEmail] = React.useState(false);
  
  const [passwordError, setPasswordError] = React.useState('');
  const [dateError, setDateError] = React.useState('');

  const CHECK_EMAIL_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/check_email?email=';
  const timeoutRef = React.useRef(null);

  /**
   * @function isValidPassword
   * @description Validates if a password has at least one capital letter and one number.
   * @param {string} value - Password to validate.
   * @returns {boolean}
   */
  const isValidPassword = (value) => /[A-Z]/.test(value) && /[0-9]/.test(value);
  
  /**
   * @function formatBirthdayForAPI
   * @description Formats date object as YYYY-MM-DD for API.
   * @param {Date} date - Date object to format
   * @returns {string} Formatted date string (YYYY-MM-DD)
   */
  const formatBirthdayForAPI = (date) => {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  /**
   * @function isEmailExists
   * @description Checks if an email is already registered.
   * @param {string} email - Email to check
   * @returns {Promise<boolean>}
   */
  const isEmailExists = async (email) => {
    try {
      const response = await axios.get(`${CHECK_EMAIL_API_URL}${email}`);
      return response.data.found === true;
    } catch (error) {
      console.error('Error checking if email exists:', error);
      return false;
    }
  };

  /**
   * @function isValidEmail
   * @description Validates an email string.
   * @param {string} email - Email to validate.
   * @returns {boolean}
   */
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  /**
   * @function validateEmailInRealTime
   * @description Validates email format and checks if it exists in real-time
   * @param {string} emailValue - Email to validate
   */
  const validateEmailInRealTime = async (emailValue) => {
    setEmailError('');
    if (!emailValue.trim()) {
      return;
    }
    if (!isValidEmail(emailValue)) {
      setEmailError(ERROR_MESSAGES.VALIDATION.EMAIL_INVALID);
      return;
    }
    setIsCheckingEmail(true);
    try {
      const emailExists = await isEmailExists(emailValue);
      if (emailExists) {
        setEmailError(ERROR_MESSAGES.VALIDATION.EMAIL_EXISTS);
      } else {
        setEmailError('');
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailError(handleError(error, 'SignUpScreen/validateEmailInRealTime'));
    } finally {
      setIsCheckingEmail(false);
    }
  };

  /**
   * @function handleEmailChange
   * @description Handles email input change with debounced validation
   * @param {string} text - Email input text
   */
  const handleEmailChange = (text) => {
    setEmail(text);
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout to validate after user stops typing
    timeoutRef.current = setTimeout(() => {
      validateEmailInRealTime(text);
    }, 500); // Wait 500ms after user stops typing
  };
  
  /**
   * @function handleDateUpdate
   * @description Updates the birthday date when day, month, or year changes
   */
  const handleDateUpdate = () => {
    if (day && month && year) {
      const selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Check if date is valid
      if (
        selectedDate.getFullYear() === parseInt(year) &&
        selectedDate.getMonth() === parseInt(month) - 1 &&
        selectedDate.getDate() === parseInt(day)
      ) {
        // Check if user is at least 13 years old
        const today = new Date();
        const thirteenYearsAgo = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
        
        if (selectedDate > thirteenYearsAgo) {
          setDateError('You must be at least 13 years old to sign up');
          setBirthdayDate(null);
        } else {
          setDateError('');
          setBirthdayDate(selectedDate);
        }
      } else {
        setDateError('Please enter a valid date');
        setBirthdayDate(null);
      }
    } else {
      setBirthdayDate(null);
    }
  };
  
  // Update birthday date when day, month, or year changes
  React.useEffect(() => {
    handleDateUpdate();
  }, [day, month, year]);
  
  // Generate arrays for days, months, and years for pickers
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 100 }, 
    (_, i) => String(currentYear - i)
  );
  
  /**
   * @function handleContinue
   * @description Validates signup form and attempts to create a user account.
   */
  const handleContinue = async () => {
    let valid = true;

    if (isCheckingEmail) {
      Alert.alert('Please wait', 'Still checking email availability...');
      return;
    }

    if (emailError) {
      valid = false;
    }

    if (!email.trim()) {
      setEmailError(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      valid = false;
    }

    if (!isValidPassword(password)) {
      setPasswordError(ERROR_MESSAGES.VALIDATION.PASSWORD_WEAK);
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!birthdayDate) {
      setDateError(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      valid = false;
    }

    if (!fullName.trim()) {
      Alert.alert('Missing Information', ERROR_MESSAGES.VALIDATION.FULLNAME_REQUIRED);
      valid = false;
    }

    if (!username.trim()) {
      Alert.alert('Missing Information', ERROR_MESSAGES.VALIDATION.USERNAME_REQUIRED);
      valid = false;
    }

    if (!valid) {
      return;
    }

    builder
      .setFullName(fullName)
      .setUsername(username)
      .setUserType(userType)
      .setPassword(password)
      .setGender(gender)
      .setBirthDate(formatBirthdayForAPI(birthdayDate))
      .setEmail(email)
      .setPhoneNumber(null);

    const user = builder.build();

    console.log('Signing up with user:', user);

    try {
      await Auth.signUp({
        username: user.username,
        password: user.password,
        attributes: {
          email: user.email || null,
          phone_number: null,
          name: user.fullName,
          gender: user.gender,
          locale: Localization.locale || 'en-US',
          picture: 'https://your-default-profile-url.com/default.png',
        },
      });
  
      console.log('✅ SignUp successful');
      navigation.navigate('Confirm Code', { user });
    }
    catch (error) {
      console.error('❌ Error signing up:', error);
      Alert.alert('Error', handleError(error, 'SignUpScreen/handleContinue'));
    }
  };

  return (
    <LinearGradient
      colors={COLORS.static.primaryGradient}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <Text style={styles.title}>Sign Up</Text>
          
          {/* Full Name Input - removed specific marginTop */}
          <TextInput
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholderTextColor="#666"
          />

          {/* Email Input with real-time validation */}
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={handleEmailChange}
              style={[
                styles.input,
                emailError ? styles.inputError : null,
              ]}
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {isCheckingEmail && (
              <View style={styles.checkingContainer}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.checkingText}>Checking...</Text>
              </View>
            )}
          </View>
          
          {/* Show email error in red under the email input */}
          {emailError !== '' && (
            <Text style={styles.errorText}>{emailError}</Text>
          )}

          {/* Birthday Selector */}
          <Text style={[styles.fieldLabel, { alignSelf: 'flex-start' }]}>Birthday</Text>
          <View style={styles.birthdayContainer}>
            {/* Day Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1, marginRight: 5 }]}
              onPress={() => setShowPicker(showPicker === 'day' ? '' : 'day')}
            >
              <Text style={styles.pickerButtonText}>{day || 'Day'}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
            
            {/* Month Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 2, marginHorizontal: 5 }]}
              onPress={() => setShowPicker(showPicker === 'month' ? '' : 'month')}
            >
              <Text style={styles.pickerButtonText}>
                {month ? months.find(m => m.value === month)?.label : 'Month'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
            
            {/* Year Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1.5, marginLeft: 5 }]}
              onPress={() => setShowPicker(showPicker === 'year' ? '' : 'year')}
            >
              <Text style={styles.pickerButtonText}>{year || 'Year'}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Date Picker Overlay */}
          {showPicker && (
            <View style={styles.pickerOverlay}>
              <TouchableOpacity 
                style={styles.overlayBackground} 
                onPress={() => setShowPicker('')}
                activeOpacity={1}
              />
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>
                    Select {showPicker === 'day' ? 'Day' : showPicker === 'month' ? 'Month' : 'Year'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowPicker('')}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.pickerScrollView}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {showPicker === 'day' && days.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.pickerItem,
                        day === item && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setDay(item);
                        setShowPicker('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          day === item && styles.pickerItemTextSelected
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {showPicker === 'month' && months.map(item => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.pickerItem,
                        month === item.value && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setMonth(item.value);
                        setShowPicker('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          month === item.value && styles.pickerItemTextSelected
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {showPicker === 'year' && years.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.pickerItem,
                        year === item && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setYear(item);
                        setShowPicker('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          year === item && styles.pickerItemTextSelected
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
          
          {dateError !== '' && <Text style={styles.errorText}>{dateError}</Text>}

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

          <Button
            title="Continue"
            onPress={handleContinue}
            style={styles.continueButton}
            textStyle={styles.continueText}
          />
          
          <Text style={styles.termsText}>
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  inner: { 
    paddingTop: 110, 
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  backButton: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    zIndex: 10 
  },
  title: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    marginBottom: 30, // Consistent spacing after title
    alignSelf: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 25,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    marginHorizontal: 10,
  },
  toggleSelected: { 
    backgroundColor: 'white' 
  },
  toggleText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  toggleTextSelected: { 
    color: '#000', 
    fontWeight: 'bold' 
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
  inputContainer: {
    width: '100%',
    position: 'relative',
  },
  emailInput: {
    marginBottom: 0,
  },
  inputError: {
    borderWidth: 2,
    borderColor: 'red',
  },
  checkingContainer: {
    position: 'absolute',
    right: 16,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkingText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  fieldLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  birthdayContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#333',
    fontSize: 16,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 1000,
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10000,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerScrollView: {
    maxHeight: 300,
    minHeight: 200,
  },
  pickerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(255, 110, 196, 0.2)',
    borderBottomColor: '#ff6ec4',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#ff6ec4',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 12,
    marginLeft: 5,
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
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
    width: '100%',
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
  genderSelected: { 
    backgroundColor: 'white' 
  },
  genderText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  genderTextSelected: { 
    color: '#000', 
    fontWeight: 'bold' 
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
  continueText: { 
    color: '#000', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  },
});

export default SignUpScreen;