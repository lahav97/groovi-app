import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';


const MessageBubble = ({ message }) => {
    if (message.sender === 'me') {
        // My messages - gradient bubble
        return (
            <View style={styles.myMessageWrapper}>
                <LinearGradient
                    colors={[...COLORS.static.primaryGradient].reverse()}
                    start={{x: 1, y: 1}}
                    end={{x: 0, y: 0}}
                    style={styles.myMessageBubble}
                >
                    <Text style={styles.myMessageText}>{message.text}</Text>
                </LinearGradient>
                <Text style={styles.myMessageTime}>{message.timestamp}</Text>
            </View>
        );
    } else {
        // Other messages - gray bubble
        return (
            <View style={styles.otherMessageWrapper}>
                <View style={styles.otherMessageBubble}>
                    <Text style={styles.otherMessageText}>{message.text}</Text>
                </View>
                <Text style={styles.otherMessageTime}>{message.timestamp}</Text>
            </View>
        );
    }
};

const styles = StyleSheet.create({
    // MY MESSAGES
    myMessageWrapper: {
        alignSelf: 'flex-end',
        marginLeft: 50,
        marginBottom: 15,
        maxWidth: '80%',
    },
    myMessageBubble: {
        padding: 12,
        borderRadius: 18,
        minWidth: 60,
    },
    myMessageText: {
        color: 'white',
        fontSize: 16,
        lineHeight: 20,
    },
    myMessageTime: {
        fontSize: 11,
        color: '#999',
        textAlign: 'right',
        marginTop: 4,
        marginRight: 4,
    },

    // OTHER MESSAGES
    otherMessageWrapper: {
        alignSelf: 'flex-start',
        marginRight: 50,
        marginBottom: 15,
        maxWidth: '80%',
    },
    otherMessageBubble: {
        backgroundColor: '#F5F5F7',
        padding: 12,
        borderRadius: 18,
        minWidth: 60,
    },
    otherMessageText: {
        color: 'black',
        fontSize: 16,
        lineHeight: 20,
    },
    otherMessageTime: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
        marginLeft: 4,
    },
});

export default MessageBubble;