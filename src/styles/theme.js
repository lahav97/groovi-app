import { Platform } from 'react-native';

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

// FONT CONFIGURATION WITH RUBIK FOR HEBREW SUPPORT
export const FONTS = {
    // Rubik font family - excellent for Hebrew and English
    rubik: {
        regular: Platform.select({
            ios: 'Rubik-Regular',
            android: 'Rubik-Regular',
        }),
        medium: Platform.select({
            ios: 'Rubik-Medium',
            android: 'Rubik-Medium',
        }),
        semiBold: Platform.select({
            ios: 'Rubik-SemiBold',
            android: 'Rubik-SemiBold',
        }),
        bold: Platform.select({
            ios: 'Rubik-Bold',
            android: 'Rubik-Bold',
        }),
    },
    // System fallback
    system: {
        regular: Platform.select({
            ios: 'System',
            android: 'Roboto',
        }),
        medium: Platform.select({
            ios: 'System',
            android: 'Roboto-Medium',
        }),
        bold: Platform.select({
            ios: 'System',
            android: 'Roboto-Bold',
        }),
    }
};

// Hebrew text detection and styling utilities
export const TEXT_UTILS = {
    // Detect Hebrew text
    isHebrew: (text) => /[\u0590-\u05FF]/.test(text),

    // Get appropriate text styles for Hebrew/English
    getTextStyle: (text, baseStyle = {}) => ({
        ...baseStyle,
        fontFamily: TEXT_UTILS.isHebrew(text) ? FONTS.rubik.regular : FONTS.system.regular,
        writingDirection: TEXT_UTILS.isHebrew(text) ? 'rtl' : 'ltr',
        textAlign: TEXT_UTILS.isHebrew(text) ? 'right' : 'left',
    }),

    // Get bold text style
    getBoldTextStyle: (text, baseStyle = {}) => ({
        ...baseStyle,
        fontFamily: TEXT_UTILS.isHebrew(text) ? FONTS.rubik.bold : FONTS.system.bold,
        writingDirection: TEXT_UTILS.isHebrew(text) ? 'rtl' : 'ltr',
        textAlign: TEXT_UTILS.isHebrew(text) ? 'right' : 'left',
    }),
};

export const SIZES = {
    icon: 28,
    iconLarge: 36,
    iconSmall: 16,
    radius: 12,
    padding: 20,
    font: {
        small: 12,
        medium: 14,
        large: 16,
        xlarge: 20,
        title: 26,
        username: 26,
        sectionTitle: 18,
    },
};

export const LAYOUT = {
    navHeight: 60,
    headerHeight: 60,
    contentSpacing: 20,
    cornerRadius: 12,
};

export const colors = {
    primary: '#ff6ec4',
    gray: '#666',
    background: '#000',
    border: '#333',
};