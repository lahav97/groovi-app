import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    useColorScheme,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ConversationItem from '../../components/chat/ConversationItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS } from '../../styles/theme';
import ChatService from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { fetchUserProfile, getUsernameForChat } from '../../services/profileService';
import { getCurrentUserEmail } from '../../utils/userUtils';
import Logger from '../../utils/Logger';

const logger = Logger.createLogger('ChatListScreen');

const ChatListScreen = () => {
    // Theme detection
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
    const navigation = useNavigation();

    // GET USER FROM AUTH CONTEXT
    const { user, isSignedIn } = useAuth();

    // Search functionality
    const [searchQuery, setSearchQuery] = useState('');

    // REAL CHAT DATA STATE
    const [conversations, setConversations] = useState([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionError, setConnectionError] = useState('');
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [currentUsername, setCurrentUsername] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Add ref to track if we've received chat data
    const hasReceivedChatData = useRef(false);

    // Fetch user profile data using the same approach as ProfileScreen
    useEffect(() => {
        const fetchUserProfileData = async () => {
            if (!isSignedIn) {
                console.log('❌ Profile fetch: User not signed in');
                setIsLoadingProfile(false);
                return;
            }

            try {
                setIsLoadingProfile(true);
                console.log('🔄 Starting profile fetch for chat...');
                logger.debug('Fetching user profile for chat');

                // Use the same approach as ProfileScreen - get user email first
                const userEmail = user?.email || await getCurrentUserEmail();
                if (!userEmail) {
                    console.log('❌ Profile fetch: No user email found');
                    logger.warn('No user email found');
                    setCurrentUsername(null);
                    setIsLoadingProfile(false);
                    return;
                }

                console.log('📧 Found user email, fetching profile:', userEmail);
                logger.debug('Fetching profile by email for chat', { email: userEmail });

                // Use fetchUserProfile with 'email' field like ProfileScreen does
                const profileResult = await fetchUserProfile('email', userEmail);
                console.log('📋 Profile fetch result:', profileResult);

                if (profileResult && profileResult.profile && profileResult.profile.username) {
                    setCurrentUsername(profileResult.profile.username);
                    console.log('✅ Profile loaded successfully, username:', profileResult.profile.username);
                    logger.info('Profile loaded for chat', { username: profileResult.profile.username });
                } else if (profileResult && profileResult.username) {
                    // Handle case where username is at root level
                    setCurrentUsername(profileResult.username);
                    console.log('✅ Profile loaded successfully, username:', profileResult.username);
                    logger.info('Profile loaded for chat', { username: profileResult.username });
                } else {
                    console.log('❌ Profile fetch: No username found in profile data');
                    logger.warn('No username found in profile data');
                    setCurrentUsername(null);
                }
            } catch (error) {
                console.log('❌ Profile fetch failed:', error.message);
                logger.error('Failed to load user profile:', error.message);
                setCurrentUsername(null);
            } finally {
                setIsLoadingProfile(false);
                console.log('🏁 Profile fetch completed, isLoadingProfile set to false');
            }
        };

        fetchUserProfileData();
    }, [isSignedIn, user?.email]);

    // ===================================
    // CHATSERVICE CONNECTION LOGIC
    // ===================================

    useEffect(() => {
        console.log('🔍 Chat initialization useEffect triggered:', {
            isSignedIn,
            currentUsername,
            isLoadingProfile
        });

        // Don't initialize chat if user is not signed in, username not available, or still loading profile
        if (!isSignedIn || !currentUsername || isLoadingProfile) {
            console.log('❌ Cannot initialize chat: User not signed in, no username, or still loading profile');
            setIsConnecting(false);
            setConnectionError(isLoadingProfile ? '' : 'Please sign in to access chat');
            return;
        }

        console.log('✅ Starting chat initialization with username:', currentUsername);

        let chatListUnsubscribe = null;
        let connectionUnsubscribe = null;
        let directMessageUnsubscribe = null;

        const initializeChat = async () => {
            try {
                setIsConnecting(true);
                setConnectionError('');

                console.log('🔗 Connecting to chat service with username:', currentUsername);

                // Step 1: Connect to WebSocket
                await ChatService.connectUserToWebSocket(currentUsername);
                console.log('✅ Connected to WebSocket');

                // Step 2: Set up chat list listener BEFORE loading data
                console.log('📡 Setting up chat list listener...');
                chatListUnsubscribe = ChatService.onChatListUpdate((data) => {
                    console.log('📋 Chat list update received via onChatListUpdate:', data);

                    // Handle both 'chat_list' and 'conversations_list' message types
                    if ((data.type === 'chat_list' || data.type === 'conversations_list') && Array.isArray(data.conversations || data.data)) {
                        const conversationsArray = data.conversations || data.data;
                        console.log('✅ Processing chat list with', conversationsArray.length, 'conversations');

                        // Transform backend data to match your UI expectations
                        const transformedConversations = conversationsArray.map(conv => ({
                            // Backend format → UI format
                            id: conv.SK || conv.id,
                            name: conv.SK ? conv.SK.replace('CONVO#', '') : conv.name,
                            lastMessage: conv.lastMessage || '',
                            lastMessageTime: conv.timestamp || new Date().toISOString(),
                            unreadCount: Number(conv.unreadCount || 0),
                            instruments: conv.instruments ? Object.keys(conv.instruments) : [],
                            // Add any other fields your ConversationItem component expects
                            readStatus: conv.readStatus || 'read'
                        }));

                        setConversations(transformedConversations);
                        setIsLoadingChats(false);
                        console.log('✅ Chat list updated, isLoadingChats set to false');
                        hasReceivedChatData.current = true; // Mark that we've received chat data
                    } else {
                        console.log('⚠️ Chat list data format unexpected:', data);
                        // Even if no conversations, still stop loading
                        setIsLoadingChats(false);
                    }
                });

                // TEMPORARY FIX: Add a direct message listener to catch conversations_list
                // This handles the case where ChatService.onChatListUpdate doesn't forward conversations_list messages
                if (ChatService.onMessage) {
                    console.log('📡 Setting up direct message listener as backup...');
                    directMessageUnsubscribe = ChatService.onMessage((message) => {
                        console.log('📋 Direct message received:', message);

                        if (message.type === 'conversations_list' && Array.isArray(message.data)) {
                            console.log('✅ Processing conversations_list with', message.data.length, 'conversations');

                            const transformedConversations = message.data.map(conv => ({
                                id: conv.SK || conv.id || `conv_${Date.now()}_${Math.random()}`,
                                name: conv.SK ? conv.SK.replace('CONVO#', '') : conv.name || 'Unknown',
                                lastMessage: conv.lastMessage || '',
                                lastMessageTime: conv.timestamp || new Date().toISOString(),
                                unreadCount: Number(conv.unreadCount || 0),
                                instruments: conv.instruments ? Object.keys(conv.instruments) : [],
                                readStatus: conv.readStatus || 'read'
                            }));

                            setConversations(transformedConversations);
                            setIsLoadingChats(false);
                            console.log('✅ Chat list updated via direct listener, isLoadingChats set to false');
                            hasReceivedChatData.current = true; // Mark that we've received chat data
                        }
                    });
                }

                // Step 3: Set up connection state listener
                console.log('🔌 Setting up connection state listener...');
                connectionUnsubscribe = ChatService.onConnectionChange((connectionData) => {
                    console.log('🔌 Connection state changed:', connectionData);

                    if (connectionData.state === 'CONNECTED') {
                        setIsConnecting(false);
                        setConnectionError('');
                        console.log('✅ Chat connected successfully');
                    } else if (connectionData.state === 'FAILED') {
                        setIsConnecting(false);
                        setConnectionError('Connection failed. Tap to retry.');
                        console.log('❌ Chat connection failed');
                    } else if (connectionData.state === 'RECONNECTING') {
                        setConnectionError('Reconnecting...');
                        console.log('🔄 Chat reconnecting...');
                    }
                });

                // Step 4: Load chat list data
                console.log('📤 Requesting chat list data...');
                setIsLoadingChats(true);
                const loadSuccess = ChatService.loadChatList(currentUsername);

                if (!loadSuccess) {
                    throw new Error('Failed to request chat list');
                }

                console.log('📤 Chat list request sent, waiting for response...');
                setIsConnecting(false);

                // FALLBACK: Add timeout to prevent infinite loading
                setTimeout(() => {
                    console.log('⏰ Chat list timeout reached - stopping loading state');
                    setIsLoadingChats(false);
                    // Only show empty state if we haven't received any chat data at all
                    if (!hasReceivedChatData.current) {
                        console.log('✅ No conversations data received - showing empty state');
                        setConversations([]);
                    } else {
                        console.log('✅ Chat data was received, keeping existing conversations');
                    }
                }, 5000); // 5 second timeout

            } catch (error) {
                console.error('❌ Failed to initialize chat:', error);
                setIsConnecting(false);
                setConnectionError(error.message || 'Failed to connect to chat');
                setIsLoadingChats(false);
            }
        };

        initializeChat();

        // CLEANUP: Very important for React Native!
        return () => {
            console.log('🧹 Cleaning up ChatListScreen...');

            // Unsubscribe from listeners
            if (chatListUnsubscribe) {
                chatListUnsubscribe();
            }
            if (connectionUnsubscribe) {
                connectionUnsubscribe();
            }
            if (directMessageUnsubscribe) {
                directMessageUnsubscribe();
            }

            // DON'T DISCONNECT WebSocket when leaving ChatList - keep it alive for individual chats
            // ChatService.disconnectFromWebSocket(); // REMOVED - keep connection alive
            console.log('✅ ChatListScreen cleanup completed - WebSocket kept alive');
        };
    }, [currentUsername, isSignedIn, isLoadingProfile]); // Re-run if username, sign-in status, or profile loading state changes

    // ===================================
    // UI EVENT HANDLERS
    // ===================================

    // Handle conversation selection
    const handleConversationPress = (conversation) => {
        console.log('🗨️ Selected conversation:', conversation.name);

        // Navigate to ChatScreen with conversation data
        navigation.navigate('ChatScreen', {
            conversationId: conversation.id,
            userName: conversation.name,
            // Pass any other data ChatScreen needs
        });
    };

    // Handle retry connection
    const handleRetryConnection = async () => {
        if (isConnecting) return;

        try {
            setIsConnecting(true);
            setConnectionError('');
            await ChatService.connectUserToWebSocket(currentUsername);
            ChatService.loadChatList(currentUsername);
        } catch (error) {
            setConnectionError('Failed to connect. Tap to retry.');
            setIsConnecting(false);
        }
    };

    // ===================================
    // SEARCH FILTERING
    // ===================================

    // Filter conversations based on search
    const filteredConversations = conversations.filter(conversation =>
        conversation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ===================================
    // RENDER FUNCTIONS
    // ===================================

    // Connection error state
    const renderConnectionError = () => (
        <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                {connectionError}
            </Text>
            <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryConnection}
                disabled={isConnecting}
            >
                <Text style={styles.retryButtonText}>
                    {isConnecting ? 'Connecting...' : 'Retry'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Loading state
    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                {isConnecting ? 'Connecting to chat...' : 'Loading conversations...'}
            </Text>
        </View>
    );

    // Empty state component
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={theme.textSecondary}
                style={styles.emptyIcon}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQuery
                    ? `No conversations found for "${searchQuery}"`
                    : 'No messages yet\nStart a conversation with someone!'
                }
            </Text>
        </View>
    );

    // Conversation item renderer
    const renderConversationItem = ({ item }) => (
        <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
        />
    );

    // Separator component for list items
    const renderSeparator = () => <View style={styles.separator} />;

    // ===================================
    // MAIN RENDER
    // ===================================

    // Dynamic styles based on theme
    const styles = StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.background,
        },
        container: {
            flex: 1,
        },
        header: {
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 10,
            backgroundColor: theme.background,
        },
        title: {
            fontSize: 34,
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: 15,
            marginTop: 10,
        },
        searchContainer: {
            backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7',
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 10,
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            flex: 1,
            color: theme.text,
            fontSize: 17,
            paddingVertical: 4,
        },
        listContainer: {
            flex: 1,
        },
        separator: {
            height: 0.5,
            backgroundColor: theme.border,
            marginLeft: 76,
        },
        // Error states
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
        },
        errorText: {
            fontSize: 16,
            textAlign: 'center',
            marginVertical: 16,
        },
        retryButton: {
            backgroundColor: COLORS.button.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
        },
        retryButtonText: {
            color: 'white',
            fontSize: 16,
            fontWeight: '600',
        },
        // Loading states
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 50,
        },
        loadingText: {
            fontSize: 16,
            textAlign: 'center',
            marginTop: 16,
        },
        // Empty states
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 50,
        },
        emptyIcon: {
            marginBottom: 10,
        },
        emptyText: {
            fontSize: 16,
            textAlign: 'center',
        },
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.title}>Messages</Text>

                    {/* Search Bar - Only show if not connecting */}
                    {!isConnecting && !connectionError && (
                        <View style={styles.searchContainer}>
                            <Ionicons
                                name="search"
                                size={20}
                                color={theme.textSecondary}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search"
                                placeholderTextColor={theme.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                            />
                        </View>
                    )}
                </View>

                {/* Content Area */}
                <View style={styles.listContainer}>
                    {connectionError ? (
                        renderConnectionError()
                    ) : (isConnecting || isLoadingChats) ? (
                        renderLoading()
                    ) : (
                        <FlatList
                            data={filteredConversations}
                            keyExtractor={(item) => item.id}
                            renderItem={renderConversationItem}
                            ItemSeparatorComponent={renderSeparator}
                            ListEmptyComponent={renderEmptyState}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>

                {/* Bottom Navigation */}
                <BottomNavigation />
            </View>
        </SafeAreaView>
    );
};

export default ChatListScreen;
