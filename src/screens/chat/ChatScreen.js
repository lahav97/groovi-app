import { useRoute } from '@react-navigation/native';
import React, {useState, useRef, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform
} from 'react-native';import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';
import MessageBubble from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';

const ChatScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { conversationId, userName } = route.params || {};
    const [showScrollButton, setShowScrollButton] = useState(false);

    const instruments = ['🥁 Drums', '🎸 Bass'];

    // Mock messages for the chat
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: 'Hey! I saw you play guitar too 🎸',
            sender: 'other',
            timestamp: '2:34 PM'
        },
        {
            id: '2',
            text: 'Yeah! Love your drumming videos',
            sender: 'me',
            timestamp: '2:35 PM'
        },
        {
            id: '3',
            text: 'Want to jam sometime?',
            sender: 'other',
            timestamp: '2:36 PM'
        },
        {
            id: '4',
            text: 'Absolutely! I know a great studio',
            sender: 'me',
            timestamp: '2:37 PM'
        }
    ]);

    const handleSendMessage = (messageText) => {
        const newMessage = {
            id: Date.now().toString(),
            text: messageText,
            sender: 'me',
            timestamp: new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }

    const flatListRef = useRef(null);

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
                        <Text style={styles.headerInstruments}>
                            {instruments.join(' • ')}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                renderItem={({ item }) => (
                    <MessageBubble message={item} />
                )}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onScroll={(event) => {
                    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                    const isAtBottom = contentOffset.y >= (contentSize.height - layoutMeasurement.height - 50);
                    setShowScrollButton(!isAtBottom);
                }}
                scrollEventThrottle={100}
            />

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
                <TouchableOpacity
                    style={styles.scrollToBottomButton}
                    onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
                >
                    <Ionicons name="chevron-down" size={20} color="white" />
                </TouchableOpacity>
            )}

            <ChatInput onSendMessage={handleSendMessage} />
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
    scrollToBottomButton: {
        position: 'absolute',
        right: 20,
        bottom: 80,  // Above the input bar
        backgroundColor: COLORS.button.primary,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,  // Android shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    // MESSAGES LIST
    messagesList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
});

export default ChatScreen;