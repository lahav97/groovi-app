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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/theme';
import { createNetworkError, handleError } from '../../utils/errors';

const searchUsers = async (query) => {
  try {
    const SEARCH_URL = `https://xvtkovlwr3.execute-api.us-east-1.amazonaws.com/groovi/search_user?query=${encodeURIComponent(query.trim())}`;
    
    const response = await fetch(SEARCH_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw createNetworkError('SEARCH_FAILED', response.status, 'search_user');
    }

    const data = await response.json();
    const users = Array.isArray(data) ? data : [];
    
    return users.map(user => ({
      id: user.id?.toString() || Math.random().toString(),
      username: user.username || 'Unknown',
      fullName: user.full_name || '',
      profilePicture: user.profile_picture || 'https://via.placeholder.com/50',
      rating: user.rating || 0,
      isVerified: (user.rating && user.rating >= 4.5) || false
    }));
  } catch (error) {
    console.error('Search API error:', handleError(error, 'SearchScreen/searchUsers'));
    throw error;
  }
};

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
  const [recentSearches, setRecentSearches] = useState([]);
  
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

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
      setSearchResults([]);
      setError('Failed to search users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSearchChange = (text) => {
    setSearchQuery(text);
    setError(null);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(text);
    }, 300);
  };

  const handleUserPress = (user) => {
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.id !== user.id);
      return [user, ...filtered].slice(0, 5);
    });
    
    // Navigate to MusicianProfileScreen
    navigation.navigate('MusicianProfile', {
      username: user.username,
      userId: user.id
    });
    
    console.log('Navigating to profile:', user.username);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsLoading(false);
    setError(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const renderUserItem = ({ item }) => (
    <View>
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: theme.background }]}
        onPress={() => handleUserPress(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={[styles.username, { color: theme.text }]}>
              {item.username}
            </Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.button.primary} style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={[styles.fullName, { color: theme.textSecondary }]}>
            {item.fullName}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={60} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery ? 'No users found' : 'Search for users'}
      </Text>
      {error && (
        <Text style={[styles.errorText, { color: COLORS.error }]}>
          {error}
        </Text>
      )}
    </View>
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        
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

      <View style={styles.content}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Searching...
            </Text>
          </View>
        )}

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

        {showResults && (
          <FlatList
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
          />
        )}

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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  fullName: {
    fontSize: 14,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginLeft: 68,
    marginRight: 16,
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