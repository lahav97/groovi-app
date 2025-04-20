import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../screens/SignUpScreen';
import { NavigationContainer } from '@react-navigation/native';
import { SignupFlowProvider } from '../context/SignupFlowContext';

const renderWithNavigation = (ui) => {
  return render(
    <SignupFlowProvider>
      <NavigationContainer>
        {ui}
      </NavigationContainer>
    </SignupFlowProvider>
  );
};

describe('SignUpScreen – Full Flow', () => {
  it('fills all fields with valid email and navigates to next screen', async () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<SignUpScreen />);

    fireEvent.press(getByText('Use Email'));
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Lahav Rabinovitz');
    fireEvent.changeText(getByPlaceholderText('Email'), 'lahav.surf@gmail.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'blade97');
    fireEvent.changeText(getByPlaceholderText('Password'), 'MAGImagi97');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Continue')).toBeTruthy();
    });
  });
});
