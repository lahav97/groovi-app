import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';
import AppMemoryManager from '../../utils/AppMemoryManager';

const BottomNavigation = () => {
    const navigation = useNavigation();
    const ICON_SIZE = 28;
    const ICON_COLOR = '#888';
    const PRIMARY_COLOR = '#ff6ec4';

    /**
     * Handle navigation with routine cleanup instead of emergency operations
     */
    const handleNavigation = (screenName) => {
        try {
            // Request routine cleanup through single gate instead of emergency clearing
            AppMemoryManager.requestRoutineCleanup(`navigation_to_${screenName}`);

            // Navigate to the screen
            navigation.navigate(screenName);

            console.log(`✅ Navigation to ${screenName} completed with routine cleanup`);

        } catch (error) {
            console.error('❌ Error during navigation cleanup:', error);
            // Still try to navigate even if cleanup fails
            navigation.navigate(screenName);
        }
    };

    return (
        <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Discover')}>
                <Icon name="aperture-outline" size={ICON_SIZE} color={ICON_COLOR} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Profile')}>
                <Icon name="person-outline" size={ICON_SIZE} color={ICON_COLOR} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('VideoUpload')}>
                <LinearGradient
                    colors={COLORS.static.primaryGradient}
                    style={styles.gradientCircle}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                >
                    <Icon name="add" size={24} color="white" />
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('Match')}>
                <Icon name="home-outline" size={ICON_SIZE} color={ICON_COLOR} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigation('ChatList')}>
                <Icon name="chatbubble-ellipses-outline" size={ICON_SIZE} color={ICON_COLOR} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    bottomNav: {
        flexDirection: 'row',
        height: 60,
        backgroundColor: '#000',
        borderTopWidth: 0.5,
        borderTopColor: '#333',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    navItem: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    gradientCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
});

export default BottomNavigation;