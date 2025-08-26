import { useRoute } from '@react-navigation/native';
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';
import MessageBubble from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import ChatService from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { getUsernameForChat } from '../../services/profileService';
import { getCurrentUserEmail } from '../../utils/userUtils';

const ChatScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { conversationId, userName } = route.params || {};

    // GET USER FROM AUTH CONTEXT
    const { user, isSignedIn } = useAuth();
    const currentUserEmail = user?.email;

    // UI STATE
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [isSending, setIsSending] = useState(false);

    // MESSAGES STATE - Replace mock with real data
    const [messages, setMessages] = useState([]);

    // ADD USERNAME STATE FOR PROPER MESSAGE IDENTIFICATION
    const [currentUsername, setCurrentUsername] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // REFS
    const flatListRef = useRef(null);
    const messageListenerRef = useRef(null);

    // ===================================
    // GET CURRENT USERNAME FOR MESSAGE IDENTIFICATION
    // ===================================

    useEffect(() => {
        const fetchCurrentUsername = async () => {
            if (!isSignedIn || !currentUserEmail) {
                console.log('❌ ChatScreen: User not signed in or no email:', { isSignedIn, currentUserEmail });
                setIsLoadingProfile(false);
                return;
            }

            try {
                setIsLoadingProfile(true);
                console.log('🔍 ChatScreen: Getting username for message identification');
                console.log('🔍 ChatScreen: Current user email:', currentUserEmail);

                const userEmail = currentUserEmail || await getCurrentUserEmail();
                if (!userEmail) {
                    console.log('❌ ChatScreen: No user email found');
                    setIsLoadingProfile(false);
                    return;
                }

                console.log('📧 ChatScreen: Using email for username lookup:', userEmail);
                const username = await getUsernameForChat(userEmail);
                console.log('📝 ChatScreen: getUsernameForChat returned:', username);

                if (username) {
                    setCurrentUsername(username);
                    console.log('✅ ChatScreen: Got username for message identification:', username);
                } else {
                    console.log('❌ ChatScreen: Failed to get username - result was null/undefined');
                }
            } catch (error) {
                console.error('❌ ChatScreen: Error getting username:', error);
                console.error('❌ ChatScreen: Error stack:', error.stack);
            } finally {
                setIsLoadingProfile(false);
                console.log('🏁 ChatScreen: Profile loading completed, isLoadingProfile set to false');
            }
        };

        fetchCurrentUsername();
    }, [isSignedIn, currentUserEmail]);

    // ===================================
    // CHATSERVICE CONNECTION LOGIC
    // ===================================

    useEffect(() => {
        // WAIT FOR USERNAME BEFORE INITIALIZING CHAT
        if (isLoadingProfile || !currentUsername) {
            console.log('⏳ Waiting for username before initializing chat...', { isLoadingProfile, currentUsername });
            return;
        }

        // Validation: Check if we have required data
        if (!isSignedIn || !currentUserEmail) {
            console.log('❌ Cannot initialize chat: User not signed in');
            setConnectionError('Please sign in to access chat');
            return;
        }

        if (!userName) {
            console.log('❌ Cannot initialize chat: No userName provided');
            setConnectionError('Invalid conversation');
            return;
        }

        console.log('💬 Initializing ChatScreen for conversation:', {
            currentUser: currentUsername, // Use username instead of email
            otherUser: userName
        });

        // Set up message listener
        const setupMessageListener = () => {
            console.log('📡 ChatScreen: Setting up message listener...');
            messageListenerRef.current = ChatService.onMessage((data) => {
                handleIncomingMessage(data);
            });
            console.log('📡 ChatScreen: Message listener setup completed');
        };

        // Connect and load chat history
        const initializeChat = async () => {
            try {
                setIsLoadingHistory(true);
                setConnectionError('');

                // Connect to ChatService (if not already connected)
                const connectionState = ChatService.getConnectionState();
                if (!connectionState.connected) {
                    console.log('🔗 Connecting to chat service with username:', currentUsername);
                    await ChatService.connectUserToWebSocket(currentUsername); // Use username
                }

                // Set up listener before loading history
                setupMessageListener();

                // Load chat history using USERNAME
                console.log('📜 Loading chat history with username:', currentUsername);
                const success = ChatService.loadChatHistory(currentUsername, userName); // Use username

                if (!success) {
                    throw new Error('Failed to load chat history');
                }

                // MARK MESSAGES AS READ when entering the chat
                console.log('✅ Marking messages as read for conversation with:', userName);
                console.log('🔍 ChatService.markMessagesAsRead exists?', typeof ChatService.markMessagesAsRead);

                try {
                    const markReadSuccess = ChatService.markMessagesAsRead(userName);
                    console.log('📤 markMessagesAsRead call result:', markReadSuccess);

                    if (markReadSuccess) {
                        console.log('✅ Successfully sent mark as read request');
                    } else {
                        console.log('⚠️ Failed to send mark as read request');
                    }
                } catch (error) {
                    console.log('❌ Error calling markMessagesAsRead:', error);
                }
            } catch (error) {
                console.error('❌ Failed to initialize chat:', error);
                setConnectionError(error.message || 'Failed to load chat');
                setIsLoadingHistory(false);
            }
        };

        initializeChat();

        // CLEANUP: Very important!
        return () => {
            console.log('🧹 Cleaning up ChatScreen...');
            if (messageListenerRef.current) {
                messageListenerRef.current(); // Unsubscribe from messages
            }
        };
    }, [currentUsername, userName, isSignedIn, isLoadingProfile]); // Add isLoadingProfile dependency

    // ===================================
    // MESSAGE HANDLING
    // ===================================

    const handleIncomingMessage = (data) => {
        console.log('🔄 Processing message data:', data.type);

        // Handle messages without a type (like error responses)
        if (!data.type) {
            if (data.statusCode && data.message) {
                // Backend error response
                console.log('❌ Backend error response:', data.statusCode, data.message);
                if (data.statusCode >= 400) {
                    setConnectionError(`Server error: ${data.message}`);
                    setIsLoadingHistory(false);
                }
                return;
            }
            // Try to infer type from data structure
            if (data.messages && Array.isArray(data.messages)) {
                data.type = 'messages';
            } else if (data.message && data.from) {
                data.type = 'message_received';
            }
        }

        switch (data.type) {
            case 'message_received':
                if (data.from === userName) {
                    const newMessage = {
                        id: Date.now().toString() + Math.random(),
                        text: data.message,
                        sender: 'other',
                        timestamp: formatTimestamp(data.timestamp),
                        from: data.from
                    };

                    setMessages(prev => {
                        // Avoid duplicates
                        const exists = prev.some(msg =>
                            msg.text === newMessage.text &&
                            msg.sender === 'other' &&
                            Math.abs(Date.now() - parseInt(msg.id)) < 5000
                        );
                        if (exists) return prev;

                        return [...prev, newMessage];
                    });

                    // Auto-scroll to bottom
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
                break;
            case 'message':  // ADD THIS NEW CASE
                // Handle real-time messages from backend (type: "message")
                if (data.from === userName) {
                    const newMessage = {
                        id: Date.now().toString() + Math.random(),
                        text: data.message,
                        sender: 'other',
                        timestamp: formatTimestamp(data.timestamp),
                        from: data.from
                    };

                    setMessages(prev => {
                        // Avoid duplicates
                        const exists = prev.some(msg =>
                            msg.text === newMessage.text &&
                            msg.sender === 'other' &&
                            Math.abs(Date.now() - parseInt(msg.id)) < 5000
                        );
                        if (exists) return prev;

                        return [...prev, newMessage];
                    });

                    // Auto-scroll to bottom
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
                break;
            case 'messages':
                // This is the actual message format from your backend
                console.log('📨 Processing messages from backend:', data.messages?.length || 0, 'messages');
                console.log('🔍 Current user identification:', { currentUsername, currentUserEmail });

                // Handle old email#username conversationIds
                if (data.conversationId && data.conversationId.includes('#')) {
                    const [user1, user2] = data.conversationId.split('#');
                    console.log('🔍 Conversation ID format:', { user1, user2 });

                    const isCorrectConversation =
                        (user1 === currentUsername && user2 === userName) ||
                        (user1 === userName && user2 === currentUsername);

                    if (!isCorrectConversation) {
                        console.log('⚠️ Message for different conversation, ignoring');
                        return;
                    }
                }

                if (data.messages && Array.isArray(data.messages)) {
                    const processedMessages = data.messages.map((msg, index) => {
                        // Handle different message formats
                        const messageText = msg.message || msg.text || '';
                        const messageFrom = msg.from || msg.sender || '';
                        const messageTimestamp = msg.timestamp || msg.createdAt || new Date().toISOString();

                        // More robust message identification - handle both email and username
                        let isFromMe = false;
                        if (currentUsername) {
                            isFromMe = messageFrom === currentUsername || messageFrom === currentUserEmail;
                        } else {
                            // Fallback if username not available yet
                            isFromMe = messageFrom === currentUserEmail;
                        }

                        return {
                            id: `msg_${index}_${messageTimestamp}`,
                            text: messageText,
                            sender: isFromMe ? 'me' : 'other',
                            timestamp: formatTimestamp(messageTimestamp),
                            from: messageFrom
                        };
                    });

                    console.log('✅ Processed messages:', processedMessages.length, 'messages');
                    console.log('🔍 Message breakdown:', processedMessages.map(m => ({ text: m.text.substring(0, 20), sender: m.sender, from: m.from })));
                    setMessages(processedMessages);

                    // Scroll to bottom after loading messages
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: false });
                    }, 500);
                } else {
                    console.log('⚠️ No messages array found in data');
                }
                setIsLoadingHistory(false);
                break;

            case 'chat_history':
                // Historical messages loaded (keep for compatibility)
                console.log('📚 Loading chat history:', data.messages?.length || 0, 'messages');

                if (data.messages && Array.isArray(data.messages)) {
                    const historyMessages = data.messages.map((msg, index) => {
                        // Use username-aware identification
                        let isFromMe = false;
                        if (currentUsername) {
                            isFromMe = msg.from === currentUsername || msg.from === currentUserEmail;
                        } else {
                            isFromMe = msg.from === currentUserEmail;
                        }

                        return {
                            id: `history_${index}_${msg.timestamp || Date.now()}`,
                            text: msg.message,
                            sender: isFromMe ? 'me' : 'other',
                            timestamp: formatTimestamp(msg.timestamp),
                            from: msg.from
                        };
                    });

                    setMessages(historyMessages);

                    // Scroll to bottom after loading history
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: false });
                    }, 500);
                }
                setIsLoadingHistory(false);
                break;

            case 'success':
                // Backend success response - this doesn't contain message content
                console.log('✅ Backend success response:', data.message);
                // Don't do anything here - this is just a confirmation
                break;

            case 'message_sent':
                // Handle message sent confirmation - this is just a confirmation, don't add to UI
                console.log('📤 Message sent confirmation:', data.message || 'Message sent successfully');
                // The optimistic message is already in the UI, this is just backend confirmation
                break;

            case 'messages_marked_read':
                // Handle mark as read confirmation
                console.log('✅ Messages marked as read confirmation:', data);
                // This is handled by ChatListScreen, no action needed here
                break;

            case 'user_status':
                // User online/offline status - could update UI here
                console.log('👤 User status update:', data);
                break;

            default:
                console.log('🤔 Unknown message type:', data.type, 'Full data:', JSON.stringify(data));
                // Try to handle as error response
                if (data.statusCode && data.statusCode >= 400) {
                    console.log('❌ Treating as error response');
                    setConnectionError(`Error: ${data.message || 'Unknown error occurred'}`);
                    setIsLoadingHistory(false);
                }
                break;
        }
    };

    // ===================================
    // SEND MESSAGE LOGIC
    // ===================================

    const handleSendMessage = async (messageText) => {
        if (!messageText.trim() || !currentUserEmail || !userName || isSending) {
            return;
        }

        // Optimistic UI update - Add message immediately
        const optimisticMessage = {
            id: Date.now().toString(),
            text: messageText.trim(),
            sender: 'me',
            timestamp: formatTimestamp(new Date().toISOString()),
            sending: true // Mark as sending
        };

        setMessages(prev => [...prev, optimisticMessage]);

        // Auto-scroll to show new message
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            setIsSending(true);

            // Send via ChatService
            const success = ChatService.sendMessage(userName, messageText.trim());

            if (success) {
                // Update the optimistic message to mark as sent
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === optimisticMessage.id
                            ? { ...msg, sending: false, sent: true }
                            : msg
                    )
                );
            } else {
                // Failed to send - show error and remove optimistic message
                setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
                Alert.alert('Failed to Send', 'Message could not be sent. Please try again.');
            }

        } catch (error) {
            console.error('❌ Error sending message:', error);

            // Remove failed message from UI
            setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
            Alert.alert('Error', 'Failed to send message. Please check your connection.');
        } finally {
            setIsSending(false);
        }
    };

    // ===================================
    // UTILITY FUNCTIONS
    // ===================================

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        try {
            return new Date(timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            return new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    // ===================================
    // UI EVENT HANDLERS
    // ===================================

    const handleRetry = async () => {
        try {
            setIsLoadingHistory(true);
            setConnectionError('');

            // Use username for retry instead of email
            if (currentUsername) {
                await ChatService.connectUserToWebSocket(currentUsername);
                ChatService.loadChatHistory(currentUsername, userName);
            } else {
                // Fallback to email if username not available yet
                await ChatService.connectUserToWebSocket(currentUserEmail);
                ChatService.loadChatHistory(currentUserEmail, userName);
            }
        } catch (error) {
            setConnectionError('Failed to reconnect');
            setIsLoadingHistory(false);
        }
    };

    // ===================================
    // RENDER FUNCTIONS
    // ===================================

    const renderConnectionError = () => (
        <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color="#666" />
            <Text style={styles.errorText}>{connectionError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLoadingHistory = () => (
        <View style={styles.loadingContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#666" />
            <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
    );

    const renderMessage = ({ item }) => (
        <MessageBubble
            message={item}
            showSending={item.sending}
            showSent={item.sent}
        />
    );

    // ===================================
    // MAIN RENDER
    // ===================================

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Chat Header */}
            <View style={styles.chatHeader}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={24} color="black" />
                    </TouchableOpacity>

                    {/* Profile Picture */}
                    <LinearGradient
                        colors={COLORS.static.primaryGradient}
                        style={styles.profilePicture}
                    >
                        <Text style={styles.profileInitials}>
                            {userName ? userName.split(' ').map(part => part[0]).join('').toUpperCase() : 'U'}
                        </Text>
                    </LinearGradient>

                    {/* User Info */}
                    <View style={styles.userInfoContainer}>
                        <Text style={styles.headerUserName}>{userName}</Text>
                        {/* TODO: Add real user instruments from profile */}
                    </View>
                </View>
            </View>

            {/* Messages Area */}
            <View style={styles.messagesContainer}>
                {connectionError ? (
                    renderConnectionError()
                ) : isLoadingHistory ? (
                    renderLoadingHistory()
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        style={styles.messagesList}
                        renderItem={renderMessage}
                        onContentSizeChange={() => {
                            if (messages.length > 0 && !showScrollButton) {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }
                        }}
                        onScroll={(event) => {
                            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                            const isAtBottom = contentOffset.y >= (contentSize.height - layoutMeasurement.height - 50);
                            setShowScrollButton(!isAtBottom && messages.length > 0);
                        }}
                        scrollEventThrottle={100}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
                <TouchableOpacity
                    style={styles.scrollToBottomButton}
                    onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
                >
                    <Ionicons name="chevron-down" size={20} color="white" />
                </TouchableOpacity>
            )}

            {/* Chat Input */}
            {!connectionError && (
                <ChatInput
                    onSendMessage={handleSendMessage}
                    disabled={isSending || isLoadingHistory}
                    placeholder={isSending ? "Sending..." : "Type a message..."}
                />
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    // MAIN CONTAINER
    container: {
        flex: 1,
        backgroundColor: 'white',
    },

    // CHAT HEADER
    chatHeader: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    profilePicture: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    profileInitials: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    userInfoContainer: {
        flex: 1,
    },
    headerUserName: {
        fontSize: 18,
        fontWeight: '600',
        color: 'black',
        marginBottom: 1,
    },
    headerInstruments: {
        fontSize: 13,
        color: '#666',
    },

    // MESSAGES AREA
    messagesContainer: {
        flex: 1,
    },
    messagesList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },

    // SCROLL BUTTON
    scrollToBottomButton: {
        position: 'absolute',
        right: 20,
        bottom: 80,
        backgroundColor: COLORS.button.primary,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    // ERROR STATES
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
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

    // LOADING STATES
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
        marginTop: 16,
    },
});

export default ChatScreen;

