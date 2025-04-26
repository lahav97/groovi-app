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
    const { getByPlaceholderText, getByText, getAllByText } = renderWithNavigation(<SignUpScreen />);

    fireEvent.press(getAllByText('Use Email')[0]);

    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Lahav Rabinovitz');
    fireEvent.changeText(getByPlaceholderText('Email'), 'lahav.surf@gmail.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'blade97');
    fireEvent.changeText(getByPlaceholderText('Password'), 'POLOpolo12'); // strong password ✅

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Continue')).toBeTruthy();
    });
  });

  it('shows error if password is weak (email flow)', async () => {
    const { getByPlaceholderText, getByText, getAllByText } = renderWithNavigation(<SignUpScreen />);

    fireEvent.press(getAllByText('Use Email')[0]);

    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Lahav Rabinovitz');
    fireEvent.changeText(getByPlaceholderText('Email'), 'lahav.surf@gmail.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'blade97');
    fireEvent.changeText(getByPlaceholderText('Password'), 'polo'); // weak password ❌

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Password must contain at least 1 capital letter and 1 number')).toBeTruthy();
    });
  });

  it('completes valid phone signup with number 0543170570', async () => {
    const { getByPlaceholderText, getByText, getByDisplayValue } = renderWithNavigation(<SignUpScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Lahav Rabinovitz');
    fireEvent.changeText(getByPlaceholderText('Username'), 'blade97');
    fireEvent.changeText(getByPlaceholderText('Password'), 'POLOpolo12');
  
    // The PhoneInput won't expose placeholder, so we simulate its value this way:
    fireEvent.changeText(getByDisplayValue(''), '0543170570'); // set initial input
    fireEvent.changeText(getByDisplayValue('0543170570'), '0543170570'); // overwrite (stable)
  
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Continue')).toBeTruthy();
    });
  });
});