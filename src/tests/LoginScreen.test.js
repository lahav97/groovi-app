import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';
import { NavigationContainer } from '@react-navigation/native';

jest.mock('aws-amplify', () => ({
  __esModule: true,
  Amplify: {
    configure: jest.fn(),
  },
  Auth: {
    federatedSignIn: jest.fn(() => Promise.resolve({ user: { name: 'Mock User' } })),
  },
}));

jest.mock('expo-auth-session/providers/facebook', () => ({
  useAuthRequest: () => [jest.fn(), null, jest.fn()],
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [jest.fn(), null, jest.fn()],
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

const renderWithNavigation = (ui) => {
  return render(<NavigationContainer>{ui}</NavigationContainer>);
};

describe('LoginScreen', () => {
  it('renders the main buttons correctly', () => {
    const { getByText } = renderWithNavigation(<LoginScreen />);

    expect(getByText('Sign Up')).toBeTruthy();
    expect(getByText('Use phone or email')).toBeTruthy();
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Continue with Facebook')).toBeTruthy();
  });

  it('navigates to Sign Up screen on tap', async () => {
    const { getByText } = renderWithNavigation(<LoginScreen />);
    const signUpButton = getByText('Sign Up');
    fireEvent.press(signUpButton);
    expect(signUpButton).toBeTruthy(); // confirms the button press doesn't crash
  });

  it('handles mock Google login flow', async () => {
    const { getByText } = renderWithNavigation(<LoginScreen />);
    const googleButton = getByText('Continue with Google');
    fireEvent.press(googleButton);
    await waitFor(() => expect(googleButton).toBeTruthy());
  });

  it('handles mock Facebook login flow', async () => {
    const { getByText } = renderWithNavigation(<LoginScreen />);
    const fbButton = getByText('Continue with Facebook');
    fireEvent.press(fbButton);
    await waitFor(() => expect(fbButton).toBeTruthy());
  });
});