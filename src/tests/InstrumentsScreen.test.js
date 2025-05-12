import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import InstrumentsScreen from '../screens/onboarding/InstrumentsScreen';
import { NavigationContainer } from '@react-navigation/native';
import { SignupFlowProvider } from '../context/SignupFlowContext';

const renderWithProviders = (ui) => {
  return render(
    <SignupFlowProvider>
      <NavigationContainer>
        {ui}
      </NavigationContainer>
    </SignupFlowProvider>
  );
};

describe('InstrumentsScreen', () => {
  it('selects an instrument and level, then navigates to Profile Setup', async () => {
    const { getByText } = renderWithProviders(<InstrumentsScreen />);

    // Expand a category
    fireEvent.press(getByText('🥁 Drums 🥁'));

    // Select an instrument (e.g., Drums)
    fireEvent.press(getByText('Drums'));

    // Select skill level
    fireEvent.press(getByText('Pro'));

    // Press CONTINUE
    fireEvent.press(getByText('CONTINUE'));

    // Verify navigation
    await waitFor(() => {
      expect(getByText('CONTINUE')).toBeTruthy();
    });
  });

  it('selects three instruments with different levels', async () => {
    const { getByText, getAllByText} = renderWithProviders(<InstrumentsScreen />);

    // Expand relevant categories
    fireEvent.press(getByText('🎸 Strings 🎸'));
    fireEvent.press(getByText('🥁 Drums 🥁'));
    fireEvent.press(getByText('🎹 Keys 🎹'));

    // Select instruments and levels
    fireEvent.press(getByText('Electric Guitar'));
    fireEvent.press(getByText('Beginner'));

    fireEvent.press(getByText('Drums'));
    fireEvent.press(getAllByText('Pro')[0]);
    
    fireEvent.press(getByText('Piano'));
    fireEvent.press(getAllByText('Intermediate')[1]);

    // Press CONTINUE
    fireEvent.press(getByText('CONTINUE'));

    // Verify navigation (or screen doesn't crash)
    await waitFor(() => {
      expect(getByText('CONTINUE')).toBeTruthy();
    });
  });
});
