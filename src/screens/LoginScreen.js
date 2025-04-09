import React, { useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const FACEBOOK_APP_ID = '1319975072564683';

const LoginScreen = () => {
  const navigation = useNavigation();

  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
    scopes: ['public_profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${access_token}`)
        .then(res => res.json())
        .then(user => {
          console.log('FB user:', user);
          Alert.alert('Welcome', `Hello ${user.name}!`);
        });
    }
  }, [response]);

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <Text style={styles.logo}>GROOVI</Text>

      <TouchableOpacity
        style={[styles.buttonBase, styles.whiteButton]}
        onPress={() => navigation.navigate('Sign Up')}
      >
        <Text style={styles.blackText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.buttonBase, styles.whiteButton]}>
        <Text style={styles.blackText}>Use phone or email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonBase, styles.fbButton]}
        onPress={() => promptAsync()}
      >
        <Text style={styles.fbText}>Continue with Facebook</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={styles.troubleText}>Trouble Logging In?</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  logo: {
    position: 'absolute',
    top: '25%',
    fontSize: 80,
    fontWeight: 'bold',
    color: 'white',
  },
  buttonBase: {
    width: '80%',
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  whiteButton: {
    backgroundColor: 'white',
  },
  fbButton: {
    backgroundColor: '#4267B2',
  },
  blackText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fbText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  troubleText: {
    color: 'white',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 8,
  },
});

export default LoginScreen;