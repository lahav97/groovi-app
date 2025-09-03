import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    useColorScheme,
    SafeAreaView,
    Alert
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
import { createLogger } from '../../utils/Logger';
const logger = createLogger('ChatListScreen');

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

    const updateConversationFromMessage = (messageData) => {
        const { from, to, text, timestamp, isReceived } = messageData;

        // Determine who the conversation is with
        const otherUser = (from === currentUsername) ? to : from;

        setConversations(prevConversations => {
            // Find existing conversation
            const existingIndex = prevConversations.findIndex(conv => conv.name === otherUser);

            if (existingIndex !== -1) {
                // Update existing conversation
                const updatedConversations = [...prevConversations];
                const existingConv = updatedConversations[existingIndex];

                // Calculate new unread count
                let newUnreadCount = existingConv.unreadCount || 0;
                let newReadStatus = existingConv.readStatus || 'read';

                if (isReceived) {
                    // Only increment unread count if this is a received message
                    newUnreadCount = newUnreadCount + 1;
                    newReadStatus = 'unread';
                }

                // Update conversation data
                const updatedConv = {
                    ...existingConv,
                    lastMessage: text,
                    lastMessageTime: timestamp || new Date().toISOString(),
                    unreadCount: newUnreadCount,
                    readStatus: newReadStatus
                };

                // Remove from current position and add to top
                updatedConversations.splice(existingIndex, 1);
                updatedConversations.unshift(updatedConv);

                return updatedConversations;
            } else {
                // Create new conversation if it doesn't exist
                const newConversation = {
                    id: `conv_${otherUser}_${Date.now()}`,
                    name: otherUser,
                    lastMessage: text,
                    lastMessageTime: timestamp || new Date().toISOString(),
                    unreadCount: isReceived ? 1 : 0,
                    instruments: [],
                    readStatus: isReceived ? 'unread' : 'read'
                };

                logger.info('💬 New conversation created', { otherUser });

                // Add to top of the list
                return [newConversation, ...prevConversations];
            }
        });
    };

    const rollbackReadStatus = (conversationId, originalUnreadCount) => {
        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                if (conv.id === conversationId) {
                    return {
                        ...conv,
                        unreadCount: originalUnreadCount,
                        readStatus: originalUnreadCount > 0 ? 'unread' : 'read'
                    };
                }
                return conv;
            });
        });
    };

    // Fetch user profile data using the same approach as ProfileScreen
    useEffect(() => {
        const fetchUserProfileData = async () => {
            if (!isSignedIn) {
                setIsLoadingProfile(false);
                return;
            }

            try {
                setIsLoadingProfile(true);

                const userEmail = user?.email || await getCurrentUserEmail();
                if (!userEmail) {
                    logger.warn('❌ No user email found');
                    setCurrentUsername(null);
                    setIsLoadingProfile(false);
                    return;
                }

                const profileResult = await fetchUserProfile('email', userEmail);

                if (profileResult && profileResult.profile && profileResult.profile.username) {
                    setCurrentUsername(profileResult.profile.username);
                    logger.info('✅ Profile loaded for chat', { username: profileResult.profile.username });
                } else if (profileResult && profileResult.username) {
                    setCurrentUsername(profileResult.username);
                    logger.info('✅ Profile loaded for chat', { username: profileResult.username });
                } else {
                    logger.warn('❌ No username found in profile data');
                    setCurrentUsername(null);
                }
            } catch (error) {
                logger.error('❌ Failed to load user profile', { error: error.message });
                setCurrentUsername(null);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        fetchUserProfileData();
    }, [isSignedIn, user?.email]);

    // ===================================
    // CHATSERVICE CONNECTION LOGIC
    // ===================================

    useEffect(() => {
        // Don't initialize chat if user is not signed in, username not available, or still loading profile
        if (!isSignedIn || !currentUsername || isLoadingProfile) {
            setIsConnecting(false);
            setConnectionError(isLoadingProfile ? '' : 'Please sign in to access chat');
            return;
        }

        logger.info('🚀 Initializing chat connection', { username: currentUsername });

        let chatListUnsubscribe = null;
        let connectionUnsubscribe = null;
        let directMessageUnsubscribe = null;
        let individualMessageUnsubscribe = null;

        // Set up message listener for real-time updates
        individualMessageUnsubscribe = ChatService.onMessage((message) => {
            if (message.type === 'message_received') {
                // Ensure we have the current username before processing
                if (!currentUsername) {
                    logger.warn('⚠️ Current username not available, skipping message processing');
                    return;
                }

                updateConversationFromMessage({
                    from: message.from,
                    to: message.to || currentUsername,
                    text: message.message,
                    timestamp: message.timestamp,
                    isReceived: true
                });
            } else if (message.type === 'message_sent') {
                if (!currentUsername) {
                    logger.warn('⚠️ Current username not available, skipping sent message processing');
                    return;
                }

                updateConversationFromMessage({
                    from: currentUsername,
                    to: message.to,
                    text: message.message,
                    timestamp: message.timestamp,
                    isReceived: false
                });
            }
            // Handle real-time messages without proper type (like web app receives)
            else if (message.from && message.message && !message.type) {
                if (!currentUsername) {
                    logger.warn('⚠️ Current username not available, skipping real-time message processing');
                    return;
                }

                // This is a live message from the server (like web app handles)
                updateConversationFromMessage({
                    from: message.from,
                    to: currentUsername,
                    text: message.message,
                    timestamp: message.timestamp || new Date().toISOString(),
                    isReceived: true
                });
            } else if (message.type === 'messages_marked_read' || message.type === 'conversation_updated') {
                // Extract the other user from various possible fields
                const otherUser = message.otherUser || message.otherUserName;
                const conversationId = message.conversationId;

                setConversations(prevConversations => {
                    return prevConversations.map(conv => {
                        let conversationMatch = false;

                        // Try multiple ways to match the conversation
                        if (conversationId) {
                            conversationMatch = conv.id === conversationId;
                        } else if (otherUser) {
                            conversationMatch = conv.name === otherUser;
                        }

                        if (conversationMatch) {
                            return {
                                ...conv,
                                unreadCount: 0,
                                readStatus: 'read'
                            };
                        }
                        return conv;
                    });
                });
            } else if (message.message && message.message.includes('marked as read')) {
                // Handle Lambda response that doesn't have proper type
                let otherUser = message.otherUserName || message.otherUser;

                // Try to extract from conversationId if not directly available
                if (!otherUser && message.conversationId && message.conversationId.includes('#')) {
                    const parts = message.conversationId.split('#');
                    // Find the part that's not our username
                    otherUser = parts.find(part => part !== currentUsername);
                }

                if (otherUser) {
                    setConversations(prevConversations => {
                        return prevConversations.map(conv => {
                            if (conv.name === otherUser) {
                                return {
                                    ...conv,
                                    unreadCount: 0,
                                    readStatus: 'read'
                                };
                            }
                            return conv;
                        });
                    });
                } else {
                    logger.warn('⚠️ Mark as read response received but no user specified', { message });
                }
            }
            // Handle success responses that might contain mark as read confirmations
            else if (message.statusCode === 200 && message.message && typeof message.message === 'string') {
                if (message.message.includes('marked as read') || message.message.includes('read status updated')) {
                    // Success response handled
                }
            } else if (message.type === 'conversations_list' && Array.isArray(message.data)) {
                logger.info('📋 Processing conversations list', { count: message.data.length });

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
                hasReceivedChatData.current = true;
            }
        });

        const initializeChat = async () => {
            try {
                setIsConnecting(true);
                setConnectionError('');

                // Step 1: Connect to WebSocket
                await ChatService.connectUserToWebSocket(currentUsername);

                // Step 2: Set up chat list listener
                chatListUnsubscribe = ChatService.onChatListUpdate((data) => {
                    // Handle both 'chat_list' and 'conversations_list' message types
                    if ((data.type === 'chat_list' || data.type === 'conversations_list') && Array.isArray(data.conversations || data.data)) {
                        const conversationsArray = data.conversations || data.data;

                        // Transform backend data to match your UI expectations
                        const transformedConversations = conversationsArray.map(conv => ({
                            // Backend format → UI format
                            id: conv.SK || conv.id,
                            name: conv.SK ? conv.SK.replace('CONVO#', '') : conv.name,
                            lastMessage: conv.lastMessage || '',
                            lastMessageTime: conv.timestamp || new Date().toISOString(),
                            unreadCount: Number(conv.unreadCount || 0),
                            instruments: conv.instruments ? Object.keys(conv.instruments) : [],
                            readStatus: conv.readStatus || 'read'
                        }));

                        setConversations(transformedConversations);
                        setIsLoadingChats(false);
                        hasReceivedChatData.current = true;
                    } else {
                        logger.warn('⚠️ Unexpected chat list data format', { type: data.type });
                        setIsLoadingChats(false);
                    }
                });

                // Step 3: Set up connection state listener
                connectionUnsubscribe = ChatService.onConnectionChange((connectionData) => {
                    if (connectionData.state === 'CONNECTED') {
                        setIsConnecting(false);
                        setConnectionError('');
                    } else if (connectionData.state === 'FAILED' || connectionData.error === 'Connection reset') {
                        setConnectionError('Connection lost, reconnecting...');
                    } else if (connectionData.state === 'RECONNECTING') {
                        setConnectionError('Reconnecting...');
                    }
                });

                // Step 4: Load chat list data
                setIsLoadingChats(true);
                const loadSuccess = ChatService.loadChatList(currentUsername);

                if (!loadSuccess) {
                    throw new Error('Failed to request chat list');
                }

                setIsConnecting(false);

                // Add timeout to prevent infinite loading
                setTimeout(() => {
                    setIsLoadingChats(false);
                    if (!hasReceivedChatData.current) {
                        setConversations([]);
                    }
                }, 5000);

            } catch (error) {
                logger.error('❌ Failed to initialize chat', { error: error.message });
                setIsConnecting(false);
                setConnectionError(error.message || 'Failed to connect to chat');
                setIsLoadingChats(false);
            }
        };

        initializeChat();

        // CLEANUP
        return () => {
            if (chatListUnsubscribe) chatListUnsubscribe();
            if (connectionUnsubscribe) connectionUnsubscribe();
            if (directMessageUnsubscribe) directMessageUnsubscribe();
            if (individualMessageUnsubscribe) individualMessageUnsubscribe();
        };
    }, [currentUsername, isSignedIn, isLoadingProfile]); // Re-run if username, sign-in status, or profile loading state changes

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            // When returning to chat list, refresh the data from backend
            if (currentUsername && ChatService.isConnected()) {
                ChatService.loadChatList(currentUsername);
            }
        });

        return unsubscribe;
    }, [navigation, currentUsername]);

    // ===================================
    // UI EVENT HANDLERS
    // ===================================

    // Handle conversation selection
    const handleConversationPress = async (conversation) => {

        // Store original unread count for potential rollback
        const originalUnreadCount = conversation.unreadCount;

        // OPTIMISTIC UPDATE: Immediately reset unread count
        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                if (conv.name === conversation.name) {
                    return {
                        ...conv,
                        unreadCount: 0,
                        readStatus: 'read'
                    };
                }
                return conv;
            });
        });

        // Call backend to mark messages as read
        try {
            if (originalUnreadCount > 0) {
                const success = ChatService.markMessagesAsRead(conversation.name);

                if (!success) {
                    logger.warn('⚠️ Failed to send mark as read request', { conversationName: conversation.name });
                    rollbackReadStatus(conversation.id, originalUnreadCount);
                }
            }
        } catch (error) {
            logger.error('❌ Error marking messages as read', { error: error.message, conversationName: conversation.name });
            rollbackReadStatus(conversation.id, originalUnreadCount);
        }

        // Navigate to ChatScreen
        navigation.navigate('ChatScreen', {
            conversationId: conversation.id,
            userName: conversation.name,
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
            logger.info('✅ Chat connection retry successful');
        } catch (error) {
            logger.error('❌ Chat connection retry failed', { error: error.message });
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
