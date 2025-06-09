export const COLORS = {
  light: {
    background: '#fff',
    text: '#000',
    icon: '#fff',
    textSecondary: '#666',
    border: '#ddd',
  },
  dark: {
    background: '#1c1c1e',
    text: '#fff',
    textSecondary: '#aaa',
    border: '#333',
  },
  static: {
    background: '#ff6ec4',
    text: '#ffffff',
    buttonBackground: '#ffffff',
    buttonText: '#000000',
    primaryGradient: ['#d981c3', '#6233b4'],
  },
  
  // Professional button colors
  button: {
    primary: '#B875E6',           // Main action buttons (purple)
    secondary: '#E8D4F7',         // Light version for secondary actions
    tertiary: '#F5F0FB',          // Very light for subtle buttons
    disabled: '#C4C4C4',          // Disabled state
    text: '#FFFFFF',              // Text on primary buttons
    textSecondary: '#B875E6',     // Text on light buttons
    textDisabled: '#8E8E93',      // Text on disabled buttons
  },
  
  // UI accent colors (coral for checkboxes, highlights)
  ui: {
    checkbox: '#FF7F7F',          // Coral color for checkboxes
    checkboxUnselected: '#999',   // Gray for unselected
    categorySelected: '#FF7F7F',  // Coral for selected categories
    categoryUnselected: '#6C6C70', // Gray for unselected categories
    accent: '#FF7F7F',            // General coral accent
  },
  
  // Chat colors that complement your theme
  chat: {
    sent: '#B875E6',              // Your messages (purple)
    received: '#F5F5F7',          // Their messages (neutral)
    accent: '#FF7F7F',            // Links, highlights (coral)
    timestamp: '#999',            // Timestamps
    border: '#E5E5EA',            // Chat bubble borders
    background: '#FAFAFA',        // Chat background
  },
  
  // Status colors
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#B875E6',               // Using your purple for info
  
  // Keep existing
  accent: 'red',
  icon: '#888',
  primaryGradient: ['#d981c3', '#6233b4'],
};

export const SIZES = {
  icon: 28,
  iconLarge: 36,
  radius: 12,
  padding: 20,
  font: {
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 20,
    title: 26,
  },
};

export const LAYOUT = {
  navHeight: 60,
  headerHeight: 60,
  contentSpacing: 20,
  cornerRadius: 12,
};