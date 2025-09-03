import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Keyboard,
    Platform,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ChatInput = ({ onSendMessage, disabled, placeholder }) => {
    const [message, setMessage] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const textInputRef = useRef(null);
    const insets = useSafeAreaInsets();

    // Handle keyboard events
    useEffect(() => {
        const keyboardWillShow = (event) => {
            if (Platform.OS === 'ios') {
                setKeyboardHeight(event.endCoordinates.height);
            }
        };

        const keyboardDidShow = (event) => {
            if (Platform.OS === 'android') {
                setKeyboardHeight(event.endCoordinates.height);
            }
        };

        const keyboardWillHide = () => {
            setKeyboardHeight(0);
        };

        const keyboardDidHide = () => {
            setKeyboardHeight(0);
        };

        // Set up keyboard listeners
        const showSubscription = Platform.OS === 'ios'
            ? Keyboard.addListener('keyboardWillShow', keyboardWillShow)
            : Keyboard.addListener('keyboardDidShow', keyboardDidShow);

        const hideSubscription = Platform.OS === 'ios'
            ? Keyboard.addListener('keyboardWillHide', keyboardWillHide)
            : Keyboard.addListener('keyboardDidHide', keyboardDidHide);

        return () => {
            showSubscription?.remove();
            hideSubscription?.remove();
        };
    }, []);

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSendMessage(message.trim());
            setMessage(''); // Clear input after sending
        }
    };

    const handleSubmitEditing = () => {
        handleSend();
    };

    return (
        <View style={[
            styles.inputContainer,
            {
                paddingBottom: Math.max(insets.bottom, 12),
                // Add extra bottom padding when keyboard is visible
                marginBottom: Platform.OS === 'ios' ? 0 : keyboardHeight > 0 ? 10 : 0
            }
        ]}>
            <View style={styles.inputWrapper}>
                <TextInput
                    ref={textInputRef}
                    style={[
                        styles.textInput,
                        disabled && styles.textInputDisabled
                    ]}
                    placeholder={placeholder || "Type a message..."}
                    placeholderTextColor="#999"
                    value={message}
                    onChangeText={setMessage}
                    multiline={true}
                    maxLength={1000}
                    editable={!disabled}
                    returnKeyType="send"
                    onSubmitEditing={handleSubmitEditing}
                    blurOnSubmit={false}
                    textAlignVertical="top"
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        {
                            backgroundColor: (message.trim() && !disabled)
                                ? COLORS.button.primary
                                : '#ccc'
                        }
                    ]}
                    onPress={handleSend}
                    disabled={!message.trim() || disabled}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="send"
                        size={20}
                        color="white"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 0.5,
        borderTopColor: '#ddd',
        // Remove zIndex as it's no longer needed with the new layout
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        minHeight: 50, // Increased minimum height for better visibility
        paddingBottom: 4, // Add some bottom padding
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 25, // Slightly more rounded
        paddingHorizontal: 18, // Increased horizontal padding
        paddingVertical: 14, // Increased vertical padding
        fontSize: 16,
        lineHeight: 20,
        maxHeight: 120, // Allow for more text
        minHeight: 50, // Increased minimum height for better touch target
        marginRight: 12,
        backgroundColor: 'white',
        // Ensure proper text input behavior
        includeFontPadding: false,
        textAlignVertical: Platform.OS === 'android' ? 'top' : 'center',
    },
    textInputDisabled: {
        backgroundColor: '#f5f5f5',
        color: '#999',
    },
    sendButton: {
        width: 50, // Increased button size
        height: 50, // Increased button size
        borderRadius: 25, // Updated to match new size
        justifyContent: 'center',
        alignItems: 'center',
        // Add shadow for better visibility
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
});

export default ChatInput;