/**
 * @module SearchScreen
 * Real-time user search screen with Instagram-like functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  useColorScheme,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../styles/theme';
import {
  AppError,
  ValidationError,
  NetworkError,
  PermissionError,
  AuthError,
  ERROR_MESSAGES,
  createValidationError,
  createNetworkError,
  createPermissionError,
  createAuthError,
  handleError
} from '../../utils/errors';

// API function to search users using your Lambda endpoint
const searchUsers = async (query) => {
  try {
    const url = `https://xvtkovlwr3.execute-api.us-east-1.amazonaws.com/groovi/search_user?query=${encodeURIComponent(query.trim())}`;

    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      throw createNetworkError('SEARCH_FAILED', response.status, 'search_user');
    }

    const data = await response.json();
    
    const users = Array.isArray(data) ? data : [];
    
    // Transform the API response to match our component's expected format
    return users.map(user => ({
      id: user.id?.toString() || Math.random().toString(),
      username: user.username || 'Unknown',
      fullName: user.full_name || '',
      bio: user.bio || '',
      profilePicture: user.profile_picture || 'https://via.placeholder.com/50',
      instruments: user.instruments || {},
      genres: user.genres || [],
      videos: user.videos || [],
      socialLinks: user.social_links || {},
      rating: user.rating || 0,
      isVerified: (user.rating && user.rating >= 4.5) || false
    }));
  } catch (error) {
    console.error('Search API error:', handleError(error, 'SearchScreen/searchUsers'));
    throw error;
  }
};

/**
 * @function SearchScreen
 * @description Real-time search screen for finding users
 * @returns {JSX.Element}
 */
const SearchScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? COLORS.dark : COLORS.light;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentSearches, setRecentSearches] = useState([
    // Start with empty recent searches - they'll be populated when users search
  ]);
  
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  /**
   * @function handleSearch
   * @description Performs the search with debouncing
   * @param {string} query - Search query
   */
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setError('Failed to search users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function onSearchChange
   * @description Handles search input change with debouncing
   * @param {string} text - Input text
   */
  const onSearchChange = (text) => {
    setSearchQuery(text);
    setError(null);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(text);
    }, 300); // 300ms debounce
  };

  /**
   * @function handleUserPress
   * @description Handles user selection
   * @param {Object} user - Selected user
   */
  const handleUserPress = (user) => {
    // Add to recent searches (avoid duplicates)
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.id !== user.id);
      return [user, ...filtered].slice(0, 5); // Keep only 5 recent searches
    });
    
    // Navigate to user profile or handle selection
    console.log('Selected user:', user);
    // navigation.navigate('UserProfile', { userId: user.id });
  };

  /**
   * @function clearSearch
   * @description Clears the search input and results
   */
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsLoading(false);
    setError(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  /**
   * @function clearRecentSearches
   * @description Clears all recent searches
   */
  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  /**
   * @function renderUserItem
   * @description Renders a user item in the search results (Instagram style - simple)
   * @param {Object} item - User item
   * @returns {JSX.Element}
   */
  const renderUserItem = ({ item }) => (
    <View>
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: theme.background }]}
        onPress={() => handleUserPress(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: theme.text }]}>
            {item.username}
          </Text>
          <Text style={[styles.fullName, { color: theme.textSecondary }]}>
            {item.fullName}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Separator line */}
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );

  /**
   * @function renderEmptyState
   * @description Renders empty state when no results found
   * @returns {JSX.Element}
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={60} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery ? 'No users found' : 'Search for users'}
      </Text>
      {error && (
        <Text style={[styles.errorText, { color: '#FF3B30' }]}>
          {error}
        </Text>
      )}
    </View>
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus input when screen loads
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const showRecentSearches = !searchQuery && recentSearches.length > 0;
  const showResults = searchQuery && searchResults.length > 0;
  const showEmpty = (searchQuery && searchResults.length === 0 && !isLoading) || error;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        
        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2c2c2e' : '#f0f0f0' }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search users..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Searching...
            </Text>
          </View>
        )}

        {/* Recent Searches */}
        {showRecentSearches && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Recent
              </Text>
              <TouchableOpacity onPress={clearRecentSearches}>
                <Text style={[styles.clearText, { color: '#007AFF' }]}>
                  Clear all
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentSearches}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Search Results */}
        {showResults && (
          <FlatList
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
          />
        )}

        {/* Empty State */}
        {showEmpty && renderEmptyState()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsList: {
    marginTop: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullName: {
    fontSize: 14,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 65, 
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SearchScreen;