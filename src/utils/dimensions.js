import { Dimensions } from 'react-native';

// Get screen dimensions
export const { width, height } = Dimensions.get('window');

// Calculate feed item height (full screen minus bottom navigation)
export const FEED_ITEM_HEIGHT = height - 60;