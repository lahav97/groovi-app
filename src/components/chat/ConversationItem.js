import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/theme';

// Helper function to get initials from name
const getInitials = (name) => {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase();
};

// Helper function to format timestamp for chat list
const formatChatTimestamp = (timestamp) => {
    const now = new Date();
    const messageDate = new Date(timestamp);

    // Check if it's today
    if (messageDate.toDateString() === now.toDateString()) {
        // Show time (2:37 PM)
        return messageDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    // Check if it's this week
    const daysDiff = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Older than a week, show date
    return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

const ConversationItem = ({ conversation }) => {
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

    // Extract data from conversation object
    const {
        id,
        name,
        instruments,
        lastMessage,
        lastMessageTime,
        unreadCount,
    } = conversation;

    const initials = getInitials(name);
    const instrumentText = instruments.join(' • ');
    const formattedTime = formatChatTimestamp(lastMessageTime);

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => navigation.navigate('ChatScreen', {
                conversationId: id,
                userName: name
            })}
        >
            {/* Avatar with gradient */}
            <LinearGradient
                colors={COLORS.static.primaryGradient}
                start={{ x: 1, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={styles.avatar}
            >
                <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>

            {/* Main content area */}
            <View style={styles.contentArea}>
                {/* Top row: Name and timestamp */}
                <View style={styles.topRow}>
                    <Text style={[styles.name, { color: theme.text }]}>
                        {name}
                    </Text>
                    <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                        {formattedTime}
                    </Text>
                </View>

                {/* Instruments row with unread badge */}
                <View style={styles.instrumentsRow}>
                    <Text style={[styles.instruments, { color: theme.textSecondary }]}>
                        {instrumentText}
                    </Text>

                    {/* Unread badge positioned here - same row as instruments */}
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>

                {/* Last message */}
                <Text
                    numberOfLines={1}
                    style={[styles.lastMessage, { color: theme.textSecondary }]}
                >
                    {lastMessage}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'flex-start',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    avatarText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    contentArea: {
        flex: 1,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', //
        marginBottom: 2,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 12,
        marginRight: 0,
    },
    instruments: {
        fontSize: 13,
        flex: 1,
        marginRight: 8,
    },
    instrumentsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    lastMessage: {
        fontSize: 13,
    },
    unreadBadge: {
        backgroundColor: '#2d8cff',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 0,
    },
    unreadText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default ConversationItem;