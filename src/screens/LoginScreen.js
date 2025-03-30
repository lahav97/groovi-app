import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>GROOVI</Text>

      <TouchableOpacity
        style={styles.signUpButton}
        onPress={() => navigation.navigate('Introduction')}
      >
        <Text style={styles.signUpText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton}>
        <Text style={styles.loginText}>Log in with phone number</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={styles.troubleText}>Trouble Logging In?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
    backgroundColor: '#ffa726', // solid background instead of gradient
  },
  logo: {
    position: 'absolute',
    top: '30%',
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  signUpButton: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 16,
  },
  signUpText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    borderWidth: 1,
    borderColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 16,
  },
  loginText: {
    color: 'white',
    fontSize: 16,
  },
  troubleText: {
    color: 'white',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
});

export default LoginScreen;
