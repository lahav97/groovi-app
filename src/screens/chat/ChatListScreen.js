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
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ConversationItem from '../../components/chat/ConversationItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS } from '../../styles/theme';
import ChatService from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { fetchUserProfile } from '../../services/profileService';
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

    // SINGLE LOADING STATE - consolidated
    const [isFullyLoading, setIsFullyLoading] = useState(true);
    const [loadingStage, setLoadingStage] = useState('profile'); // 'profile', 'connecting', 'conversations'
    const [connectionError, setConnectionError] = useState('');

    // REAL CHAT DATA STATE
    const [conversations, setConversations] = useState([]);
    const [currentUsername, setCurrentUsername] = useState(null);

    // Profile pictures and instruments state
    const [profilePictures, setProfilePictures] = useState(new Map());
    const [userInstruments, setUserInstruments] = useState(new Map());
    const [loadingProfiles, setLoadingProfiles] = useState(new Set());

    // Refs - KEEP ALL SAFETY MECHANISMS
    const hasReceivedChatData = useRef(false);
    const cleanupFunctions = useRef([]);
    const mountedRef = useRef(true);

    const updateConversationFromMessage = (messageData) => {
        const { from, to, text, timestamp, isReceived } = messageData;
        const otherUser = (from === currentUsername) ? to : from;

        fetchUserProfileData(otherUser);

        setConversations(prevConversations => {
            const existingIndex = prevConversations.findIndex(conv => conv.name === otherUser);

            if (existingIndex !== -1) {
                const updatedConversations = [...prevConversations];
                const existingConv = updatedConversations[existingIndex];

                let newUnreadCount = existingConv.unreadCount || 0;
                let newReadStatus = existingConv.readStatus || 'read';

                if (isReceived) {
                    newUnreadCount = newUnreadCount + 1;
                    newReadStatus = 'unread';
                }

                const updatedConv = {
                    ...existingConv,
                    lastMessage: text,
                    lastMessageTime: timestamp || new Date().toISOString(),
                    unreadCount: newUnreadCount,
                    readStatus: newReadStatus
                };

                updatedConversations.splice(existingIndex, 1);
                updatedConversations.unshift(updatedConv);
                return updatedConversations;
            } else {
                const newConversation = {
                    id: `conv_${otherUser}_${Date.now()}`,
                    name: otherUser,
                    lastMessage: text,
                    lastMessageTime: timestamp || new Date().toISOString(),
                    unreadCount: isReceived ? 1 : 0,
                    instruments: [],
                    readStatus: isReceived ? 'unread' : 'read'
                };

                logger.info('New conversation created', { otherUser });
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

    const fetchUserProfileData = async (username) => {
        if (loadingProfiles.has(username) || (profilePictures.has(username) && userInstruments.has(username))) {
            return;
        }

        setLoadingProfiles(prev => new Set([...prev, username]));

        try {
            const profileData = await ChatService.fetchUserProfile(username);

            if (profileData) {
                if (profileData.message && profileData.message.includes('not found')) {
                    setProfilePictures(prev => new Map([...prev, [username, null]]));
                    setUserInstruments(prev => new Map([...prev, [username, []]]));
                    return;
                }

                let profilePicture = null;
                const pictureFields = ['profile_picture', 'profilePicture', 'profilePic', 'avatar', 'image'];
                for (const field of pictureFields) {
                    if (profileData[field]) {
                        profilePicture = profileData[field];
                        break;
                    }
                }

                let instruments = [];
                const instrumentFields = ['instruments', 'instrument', 'musical_instruments'];
                for (const field of instrumentFields) {
                    if (profileData[field]) {
                        if (typeof profileData[field] === 'object' && !Array.isArray(profileData[field])) {
                            instruments = Object.keys(profileData[field]);
                        } else if (Array.isArray(profileData[field])) {
                            instruments = profileData[field];
                        } else if (typeof profileData[field] === 'string') {
                            instruments = profileData[field].split(/[,;]/).map(i => i.trim()).filter(i => i);
                        }
                        break;
                    }
                }

                setProfilePictures(prev => new Map([...prev, [username, profilePicture]]));
                setUserInstruments(prev => new Map([...prev, [username, instruments]]));
            } else {
                setProfilePictures(prev => new Map([...prev, [username, null]]));
                setUserInstruments(prev => new Map([...prev, [username, []]]));
            }
        } catch (error) {
            logger.error('Failed to fetch user profile data', { username, error: error.message });
            setProfilePictures(prev => new Map([...prev, [username, null]]));
            setUserInstruments(prev => new Map([...prev, [username, []]]));
        } finally {
            setLoadingProfiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(username);
                return newSet;
            });
        }
    };

    // SINGLE INITIALIZATION EFFECT - keep all important logic
    useEffect(() => {
        mountedRef.current = true;

        const initializeChatSystem = async () => {
            try {
                // STAGE 1: Load User Profile
                setLoadingStage('profile');
                setIsFullyLoading(true);
                setConnectionError('');

                if (!isSignedIn) {
                    setConnectionError('Please sign in to access chat');
                    if (mountedRef.current) {
                        setIsFullyLoading(false);
                    }
                    return;
                }

                // Get user profile and username
                const userEmail = user?.email || await getCurrentUserEmail();
                if (!userEmail) {
                    setConnectionError('Unable to identify user');
                    if (mountedRef.current) {
                        setIsFullyLoading(false);
                    }
                    return;
                }

                const profileResult = await fetchUserProfile('email', userEmail);
                let username = null;

                if (profileResult && profileResult.profile && profileResult.profile.username) {
                    username = profileResult.profile.username;
                } else if (profileResult && profileResult.username) {
                    username = profileResult.username;
                } else {
                    setConnectionError('Profile setup incomplete');
                    if (mountedRef.current) {
                        setIsFullyLoading(false);
                    }
                    return;
                }

                setCurrentUsername(username);

                // STAGE 2: Connect to chat service
                setLoadingStage('connecting');
                await ChatService.connectUserToWebSocket(username);

                // STAGE 3: Set up all listeners
                setLoadingStage('conversations');

                const messageUnsubscribe = ChatService.onMessage((message) => {
                    if (message.type === 'message_received') {
                        if (!username) return;
                        updateConversationFromMessage({
                            from: message.from,
                            to: message.to || username,
                            text: message.message,
                            timestamp: message.timestamp,
                            isReceived: true
                        });
                    } else if (message.type === 'message_sent') {
                        if (!username) return;
                        updateConversationFromMessage({
                            from: username,
                            to: message.to,
                            text: message.message,
                            timestamp: message.timestamp,
                            isReceived: false
                        });
                    } else if (message.from && message.message && !message.type) {
                        if (!username) return;
                        updateConversationFromMessage({
                            from: message.from,
                            to: username,
                            text: message.message,
                            timestamp: message.timestamp || new Date().toISOString(),
                            isReceived: true
                        });
                    } else if (message.type === 'messages_marked_read' || message.type === 'conversation_updated') {
                        const otherUser = message.otherUser || message.otherUserName;
                        const conversationId = message.conversationId;

                        setConversations(prevConversations => {
                            return prevConversations.map(conv => {
                                let conversationMatch = false;
                                if (conversationId) {
                                    conversationMatch = conv.id === conversationId;
                                } else if (otherUser) {
                                    conversationMatch = conv.name === otherUser;
                                }

                                if (conversationMatch) {
                                    return { ...conv, unreadCount: 0, readStatus: 'read' };
                                }
                                return conv;
                            });
                        });
                    } else if (message.message && message.message.includes('marked as read')) {
                        let otherUser = message.otherUserName || message.otherUser;
                        if (!otherUser && message.conversationId && message.conversationId.includes('#')) {
                            const parts = message.conversationId.split('#');
                            otherUser = parts.find(part => part !== username);
                        }

                        if (otherUser) {
                            setConversations(prevConversations => {
                                return prevConversations.map(conv => {
                                    if (conv.name === otherUser) {
                                        return { ...conv, unreadCount: 0, readStatus: 'read' };
                                    }
                                    return conv;
                                });
                            });
                        }
                    } else if (message.type === 'conversations_list' && Array.isArray(message.data)) {
                        const transformedConversations = message.data.map(conv => ({
                            id: conv.SK || conv.id || `conv_${Date.now()}_${Math.random()}`,
                            name: conv.SK ? conv.SK.replace('CONVO#', '') : conv.name || 'Unknown',
                            lastMessage: conv.lastMessage || '',
                            lastMessageTime: conv.timestamp || new Date().toISOString(),
                            unreadCount: Number(conv.unreadCount || 0),
                            instruments: conv.instruments ? Object.keys(conv.instruments) : [],
                            readStatus: conv.readStatus || 'read'
                        }));

                        const sortedConversations = transformedConversations.sort((a, b) => {
                            const timeA = new Date(a.lastMessageTime).getTime();
                            const timeB = new Date(b.lastMessageTime).getTime();
                            return timeB - timeA;
                        });

                        setConversations(sortedConversations);
                        hasReceivedChatData.current = true;

                        transformedConversations.forEach(conv => {
                            if (conv.name && conv.name !== 'Unknown') {
                                fetchUserProfileData(conv.name);
                            }
                        });

                        // ONLY set loading to false when we have conversations
                        if (mountedRef.current) {
                            setIsFullyLoading(false);
                        }
                    }
                });

                const chatListUnsubscribe = ChatService.onChatListUpdate((data) => {
                    if ((data.type === 'chat_list' || data.type === 'conversations_list') && Array.isArray(data.conversations || data.data)) {
                        const conversationsArray = data.conversations || data.data;

                        const transformedConversations = conversationsArray.map(conv => ({
                            id: conv.SK || conv.id,
                            name: conv.SK ? conv.SK.replace('CONVO#', '') : conv.name,
                            lastMessage: conv.lastMessage || '',
                            lastMessageTime: conv.timestamp || new Date().toISOString(),
                            unreadCount: Number(conv.unreadCount || 0),
                            instruments: conv.instruments ? Object.keys(conv.instruments) : [],
                            readStatus: conv.readStatus || 'read'
                        }));

                        const sortedConversations = transformedConversations.sort((a, b) => {
                            const timeA = new Date(a.lastMessageTime).getTime();
                            const timeB = new Date(b.lastMessageTime).getTime();
                            return timeB - timeA;
                        });

                        setConversations(sortedConversations);
                        hasReceivedChatData.current = true;

                        transformedConversations.forEach(conv => {
                            if (conv.name && conv.name !== 'Unknown') {
                                fetchUserProfileData(conv.name);
                            }
                        });

                        if (mountedRef.current) {
                            setIsFullyLoading(false);
                        }
                    }
                });

                const connectionUnsubscribe = ChatService.onConnectionChange((connectionData) => {
                    if (connectionData.state === 'FAILED' || connectionData.error === 'Connection reset') {
                        if (mountedRef.current) {
                            setConnectionError('Connection lost, reconnecting...');
                        }
                    } else if (connectionData.state === 'RECONNECTING') {
                        if (mountedRef.current) {
                            setConnectionError('Reconnecting...');
                        }
                    } else if (connectionData.state === 'CONNECTED') {
                        if (mountedRef.current) {
                            setConnectionError('');
                        }
                    }
                });

                // Store cleanup functions
                cleanupFunctions.current = [messageUnsubscribe, chatListUnsubscribe, connectionUnsubscribe];

                // Load chat list
                const loadSuccess = ChatService.loadChatList(username);
                if (!loadSuccess) {
                    throw new Error('Failed to request chat list');
                }

                // Timeout fallback - set loading to false after timeout
                setTimeout(() => {
                    if (mountedRef.current && !hasReceivedChatData.current) {
                        setConversations([]);
                        setIsFullyLoading(false);
                    }
                }, 8000);

            } catch (error) {
                logger.error('Failed to initialize chat system', { error: error.message });
                if (mountedRef.current) {
                    setConnectionError(error.message || 'Failed to connect to chat');
                    setIsFullyLoading(false);
                }
            }
        };

        initializeChatSystem();

        return () => {
            mountedRef.current = false;
            cleanupFunctions.current.forEach(cleanup => {
                if (cleanup && typeof cleanup === 'function') {
                    cleanup();
                }
            });
        };
    }, [isSignedIn, user?.email]);

    // Refresh on screen focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (currentUsername && ChatService.isConnected()) {
                ChatService.loadChatList(currentUsername);
            }
        });

        return unsubscribe;
    }, [navigation, currentUsername]);

    // Event handlers
    const handleConversationPress = async (conversation) => {
        const originalUnreadCount = conversation.unreadCount;

        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                if (conv.name === conversation.name) {
                    return { ...conv, unreadCount: 0, readStatus: 'read' };
                }
                return conv;
            });
        });

        try {
            if (originalUnreadCount > 0) {
                const success = ChatService.markMessagesAsRead(conversation.name);
                if (!success) {
                    rollbackReadStatus(conversation.id, originalUnreadCount);
                }
            }
        } catch (error) {
            rollbackReadStatus(conversation.id, originalUnreadCount);
        }

        navigation.navigate('ChatScreen', {
            conversationId: conversation.id,
            userName: conversation.name,
        });
    };

    const handleRetry = () => {
        setConnectionError('');
        setConversations([]);
        setCurrentUsername(null);
        hasReceivedChatData.current = false;

        // Restart initialization
        setIsFullyLoading(true);
        setLoadingStage('profile');
    };

    // Filter conversations
    const filteredConversations = conversations.filter(conversation =>
        conversation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Render functions
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQuery
                    ? `No conversations found for "${searchQuery}"`
                    : 'No messages yet\nStart a conversation with someone!'
                }
            </Text>
        </View>
    );

    const renderConversationItem = ({ item }) => (
        <ConversationItem
            conversation={item}
            profilePicture={profilePictures.get(item.name)}
            instruments={userInstruments.get(item.name) || []}
            onPress={() => handleConversationPress(item)}
        />
    );

    const renderSeparator = () => <View style={[styles.separator, { backgroundColor: theme.border }]} />;

    // Get loading text based on stage
    const getLoadingText = () => {
        switch (loadingStage) {
            case 'profile':
                return 'Loading Messages';
            case 'conversations':
                return 'Loading Messages';
            default:
                return 'Loading Messages';
        }
    };

    const getLoadingSubtext = () => {
        switch (loadingStage) {
            case 'profile':
                return 'Setting up your chat experience';
            case 'conversations':
                return 'Getting your messages ready';
            default:
                return 'Preparing your chat experience';
        }
    };

    // MAIN RENDER - SINGLE LOADING PATH ONLY
    if (isFullyLoading) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
                <View style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <View style={styles.loadingCard}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#ff6ec4" />
                            <Text style={styles.loadingText}>Loading Messages</Text>
                            <Text style={styles.loadingSubtext}>Please wait...</Text>
                            <ActivityIndicator size="large" color="#ff6ec4" style={{ marginTop: 16 }} />
                        </View>
                    </View>
                    <BottomNavigation />
                </View>
            </SafeAreaView>
        );
    }

    if (connectionError) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
                <View style={styles.container}>
                    <View style={styles.errorContainer}>
                        <View style={styles.errorCard}>
                            <Ionicons name="warning-outline" size={48} color="#ff6ec4" />
                            <Text style={styles.errorText}>{connectionError}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <BottomNavigation />
                </View>
            </SafeAreaView>
        );
    }

    // Main interface - only shown when fully ready
    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
                    <View style={[styles.searchContainer, {
                        backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7'
                    }]}>
                        <Ionicons
                            name="search"
                            size={20}
                            color={theme.textSecondary}
                            style={styles.searchIcon}
                        />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search"
                            placeholderTextColor={theme.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                        />
                    </View>
                </View>

                {/* Content */}
                <View style={styles.listContainer}>
                    <FlatList
                        data={filteredConversations}
                        keyExtractor={(item) => item.id}
                        renderItem={renderConversationItem}
                        ItemSeparatorComponent={renderSeparator}
                        ListEmptyComponent={renderEmptyState}
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {/* Bottom Navigation */}
                <BottomNavigation />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 34,
        fontWeight: 'bold',
        marginBottom: 15,
        marginTop: 10,
    },
    searchContainer: {
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
        fontSize: 17,
        paddingVertical: 4,
    },
    listContainer: {
        flex: 1,
    },
    separator: {
        height: 0.5,
        marginLeft: 76,
    },

    // Loading states
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingCard: {
        backgroundColor: '#fff',
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        minWidth: 200,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#333'
    },
    loadingSubtext: {
        marginTop: 6,
        fontSize: 14,
        color: '#999',
        textAlign: 'center'
    },

    // Error states
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    errorCard: {
        backgroundColor: '#fff',
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        minWidth: 250,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8
    },
    retryButton: {
        backgroundColor: '#ff6ec4',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
        shadowColor: '#ff6ec4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },

    // Empty states
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 10,
    },
});

export default ChatListScreen;