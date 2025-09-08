import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    useColorScheme,
    ActivityIndicator,
    Alert,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS } from '../../styles/theme';
import { useProfileData } from '../../hooks/useProfileData';

const SettingsScreen = () => {
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

    // Get logout functionality from useProfileData hook
    const { handleLogout, loggingOut } = useProfileData();

    // Local state for settings
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [locationServices, setLocationServices] = useState(true);
    const [darkMode, setDarkMode] = useState(colorScheme === 'dark');

    const handleLogoutPress = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: handleLogout,
                },
            ]
        );
    };

    const SettingItem = ({ icon, title, subtitle, onPress, showArrow = true, rightComponent = null }) => (
        <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={onPress}
            disabled={!onPress}
        >
            <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.cardBackground }]}>
                    <Ionicons name={icon} size={22} color="#ff6ec4" />
                </View>
                <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            <View style={styles.settingRight}>
                {rightComponent}
                {showArrow && !rightComponent && (
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                )}
            </View>
        </TouchableOpacity>
    );

    const SectionHeader = ({ title }) => (
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{title}</Text>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Account Section */}
                <SectionHeader title="ACCOUNT" />

                <SettingItem
                    icon="person-outline"
                    title="Edit Profile"
                    subtitle="Update your profile information"
                    onPress={() => navigation.navigate('EditProfile')}
                />

                <SettingItem
                    icon="shield-checkmark-outline"
                    title="Privacy & Security"
                    subtitle="Manage your privacy settings"
                    onPress={() => {/* Navigate to privacy settings */}}
                />

                <SettingItem
                    icon="card-outline"
                    title="Payment & Billing"
                    subtitle="Manage subscriptions and payments"
                    onPress={() => {/* Navigate to payment settings */}}
                />

                {/* Notifications Section */}
                <SectionHeader title="NOTIFICATIONS" />

                <SettingItem
                    icon="notifications-outline"
                    title="Push Notifications"
                    subtitle="Receive notifications on your device"
                    showArrow={false}
                    rightComponent={
                        <Switch
                            value={pushNotifications}
                            onValueChange={setPushNotifications}
                            trackColor={{ false: theme.border, true: '#ff6ec4' }}
                            thumbColor={pushNotifications ? '#fff' : '#f4f3f4'}
                        />
                    }
                />

                <SettingItem
                    icon="mail-outline"
                    title="Email Notifications"
                    subtitle="Receive email updates and news"
                    showArrow={false}
                    rightComponent={
                        <Switch
                            value={emailNotifications}
                            onValueChange={setEmailNotifications}
                            trackColor={{ false: theme.border, true: '#ff6ec4' }}
                            thumbColor={emailNotifications ? '#fff' : '#f4f3f4'}
                        />
                    }
                />

                {/* Preferences Section */}
                <SectionHeader title="PREFERENCES" />

                <SettingItem
                    icon="moon-outline"
                    title="Dark Mode"
                    subtitle="Switch between light and dark themes"
                    showArrow={false}
                    rightComponent={
                        <Switch
                            value={darkMode}
                            onValueChange={setDarkMode}
                            trackColor={{ false: theme.border, true: '#ff6ec4' }}
                            thumbColor={darkMode ? '#fff' : '#f4f3f4'}
                        />
                    }
                />

                <SettingItem
                    icon="location-outline"
                    title="Location Services"
                    subtitle="Allow location-based features"
                    showArrow={false}
                    rightComponent={
                        <Switch
                            value={locationServices}
                            onValueChange={setLocationServices}
                            trackColor={{ false: theme.border, true: '#ff6ec4' }}
                            thumbColor={locationServices ? '#fff' : '#f4f3f4'}
                        />
                    }
                />

                <SettingItem
                    icon="language-outline"
                    title="Language"
                    subtitle="English"
                    onPress={() => {/* Navigate to language settings */}}
                />

                {/* Support Section */}
                <SectionHeader title="SUPPORT" />

                <SettingItem
                    icon="help-circle-outline"
                    title="Help & Support"
                    subtitle="Get help and contact support"
                    onPress={() => {/* Navigate to help */}}
                />

                <SettingItem
                    icon="document-text-outline"
                    title="Terms of Service"
                    subtitle="Read our terms and conditions"
                    onPress={() => {/* Navigate to terms */}}
                />

                <SettingItem
                    icon="shield-outline"
                    title="Privacy Policy"
                    subtitle="Read our privacy policy"
                    onPress={() => {/* Navigate to privacy policy */}}
                />

                {/* About Section */}
                <SectionHeader title="ABOUT" />

                <SettingItem
                    icon="information-circle-outline"
                    title="App Version"
                    subtitle="1.0.0"
                    showArrow={false}
                />

                {/* Logout Section */}
                <SectionHeader title="ACCOUNT ACTIONS" />

                <TouchableOpacity
                    style={[styles.logoutButton, { opacity: loggingOut ? 0.6 : 1 }]}
                    onPress={handleLogoutPress}
                    disabled={loggingOut}
                >
                    <View style={styles.logoutContent}>
                        {loggingOut ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="log-out-outline" size={22} color="#fff" />
                        )}
                        <Text style={styles.logoutText}>
                            {loggingOut ? 'Signing Out...' : 'Sign Out'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Add some bottom padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: FONTS.rubik.semiBold,
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: FONTS.rubik.semiBold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 24,
        marginBottom: 8,
        marginHorizontal: 16,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    settingText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: FONTS.rubik.medium,
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 14,
        fontFamily: FONTS.rubik.regular,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoutButton: {
        backgroundColor: '#e74c3c',
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    logoutContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: FONTS.rubik.semiBold,
        marginLeft: 8,
    },
    bottomPadding: {
        height: 32,
    },
});

export default SettingsScreen;