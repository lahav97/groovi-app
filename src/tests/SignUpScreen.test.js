import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SignUpScreen from '../screens/SignUpScreen';
import { NavigationContainer } from '@react-navigation/native';

jest.mock('expo-font');
jest.mock('node-emoji');
jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-number-input');


const renderWithNavigation = (ui) => {
  return render(<NavigationContainer>{ui}</NavigationContainer>);
};

describe('SignUpScreen', () => {
  it('renders all required inputs', () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<SignUpScreen />);

    expect(getByText('Sign Up')).toBeTruthy();
    expect(getByPlaceholderText('Full Name')).toBeTruthy();
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows error for weak password', () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<SignUpScreen />);

    fireEvent.changeText(getByPlaceholderText('Password'), 'weak');
    fireEvent.press(getByText('Continue'));

    expect(getByText('Password must contain at least 1 capital letter and 1 number')).toBeTruthy();
  });

  it('switches between phone and email', () => {
    const { getByText, queryByPlaceholderText } = renderWithNavigation(<SignUpScreen />);

    const useEmailBtn = getByText('Use Email');
    fireEvent.press(useEmailBtn);

    expect(queryByPlaceholderText('Email')).toBeTruthy();
  });
});
