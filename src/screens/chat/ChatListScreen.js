import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    TextInput,
    useColorScheme,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConversationItem from '../../components/chat/ConversationItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES } from '../../styles/theme';

// Mock conversations with realistic chat data
const MOCK_CONVERSATIONS = [
    {
        id: '1',
        name: 'Sarah L.',
        instruments: ['🎹 Piano', '🎤 Vocals'],
        lastMessage: 'That chord progression sounds amazing!',
        lastMessageTime: '2025-08-09T14:42:00Z', // 1:42 PM today
        unreadCount: 2,
    },
    {
        id: '2',
        name: 'Mike K.',
        instruments: ['🥁 Drums', '🎸 Bass'],
        lastMessage: 'Absolutely! I know a great studio',
        lastMessageTime: '2025-08-09T14:37:00Z', // 2:37 PM today
        unreadCount: 0,
    },
    {
        id: '3',
        name: 'David J.',
        instruments: ['🎻 Violin', '🎼 Classical'],
        lastMessage: 'When are you free to practice?',
        lastMessageTime: '2025-08-08T15:30:00Z', // Yesterday
        unreadCount: 0,
    },
    {
        id: '4',
        name: 'Alex L.',
        instruments: ['🎷 Saxophone', '🎵 Jazz'],
        lastMessage: 'Check out this jazz club!',
        lastMessageTime: '2025-08-05T10:15:00Z', // Monday
        unreadCount: 1,
    },
    {
        id: '5',
        name: 'Emma R.',
        instruments: ['🎸 Guitar', '🎵 Indie Rock'],
        lastMessage: 'Just finished recording the demo!',
        lastMessageTime: '2025-08-04T16:20:00Z', // Sunday
        unreadCount: 0,
    },
    {
        id: '6',
        name: 'The Basement Band',
        instruments: ['🎸🥁🎹 Full Band'],
        lastMessage: 'Great session today everyone!',
        lastMessageTime: '2025-08-02T19:45:00Z', // Last week
        unreadCount: 3,
    },
];

const ChatListScreen = () => {
    // Theme detection
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

    // Search functionality
    const [searchQuery, setSearchQuery] = useState('');

    // Filter conversations based on search
    const filteredConversations = MOCK_CONVERSATIONS.filter(conversation =>
        conversation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
            marginLeft: 76, // Aligns with text content, not avatar
        },
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
            color: theme.textSecondary,
            fontSize: 16,
            textAlign: 'center',
        },
    });

    // Empty state component
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={theme.textSecondary}
                style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>
                {searchQuery
                    ? `No conversations found for "${searchQuery}"`
                    : 'No messages yet\nStart a conversation with someone!'
                }
            </Text>
        </View>
    );

    // Separator component for list items
    const renderSeparator = () => <View style={styles.separator} />;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.title}>Messages</Text>

                    {/* Search Bar */}
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
                </View>

                {/* Conversations List */}
                <View style={styles.listContainer}>
                    <FlatList
                        data={filteredConversations}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <ConversationItem conversation={item} />
                        )}
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

export default ChatListScreen;