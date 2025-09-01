/**
 * @module ProfileSetupScreen
 * Final onboarding screen where users complete their profile with location, bio, videos, and music genres.
 * Features comprehensive video upload management with progress tracking and error handling.
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    useColorScheme,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import axios from 'axios';
import Button from '../../components/common/Button';
import AddressInput from '../../components/common/AddressInput';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUploadService } from '../../services/uploadFileService';
import {
    processBatchVideos,
    createVideoManager,
    deleteVideoFromS3
} from '../../services/videoService';
import { COLORS } from '../../styles/theme';
import {
    ERROR_MESSAGES,
    handleError
} from '../../utils/errors';
import { createLogger } from '../../utils/Logger';

const BUILD_PROFILE_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile';
const predefinedGenres = ['Pop', 'Rock', 'Metal', 'Jazz', 'Hip Hop', 'Classical', 'Electronic', 'R&B'];

// Initialize logger for profile setup operations
const logger = createLogger('ProfileSetup');

/**
 * ProfileSetupScreen Component
 * Handles the final step of user registration with comprehensive profile creation
 * @returns {JSX.Element} The profile setup screen component
 */
const ProfileSetupScreen = () => {
    const navigation = useNavigation();
    const isDark = useColorScheme() === 'dark';
    const builder = useSignupBuilder();
    const { user, completeOnboarding } = useAuth();
    const uploadService = getUploadService(user);

    // Address state with comprehensive location data structure
    const [address, setAddress] = useState({
        street: '',
        streetNumber: '',
        city: '',
        region: '',
        country: '',
        postalCode: '',
        formattedAddress: '',
        latitude: null,
        longitude: null,
    });

    // Core profile data states
    const [bio, setBio] = useState('');
    const [videos, setVideos] = useState([]);
    const [videoUrls, setVideoUrls] = useState([]);
    const [genres, setGenres] = useState([]);
    const [customGenre, setCustomGenre] = useState('');
    const [videoError, setVideoError] = useState('');
    const [profilePictureUri, setProfilePictureUri] = useState(null);
    const [videoThumbnails, setVideoThumbnails] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatuses, setUploadStatuses] = useState([]);
    const [videoKeys, setVideoKeys] = useState(new Set());
    const [uploadProgress, setUploadProgress] = useState({});

    // Video upload configuration
    const MAX_VIDEOS = 4;

    // Initialize video manager for array operations
    const videoManager = createVideoManager(videos, videoThumbnails, videoUrls, uploadStatuses);

    /**
     * Load and restore user data from AsyncStorage on component mount
     */
    useEffect(() => {
        const loadUserFromStorage = async () => {
            try {
                const stored = await AsyncStorage.getItem('signupBuilderBackup');
                if (stored) {
                    const parsedUser = JSON.parse(stored);
                    builder
                        .setFullName(parsedUser.fullName)
                        .setUsername(parsedUser.username)
                        .setEmail(parsedUser.email)
                        .setPassword(parsedUser.password)
                        .setUserType(parsedUser.userType)
                        .setPhoneNumber(parsedUser.phoneNumber)
                        .setGender(parsedUser.gender)
                        .setBirthDate(parsedUser.birthDate)
                        .setInstruments(parsedUser.instruments);
                } else {
                    logger.warn('No stored user data found for ProfileSetupScreen');
                }
            } catch (err) {
                logger.error('Failed to restore user data from storage', { error: err.message });
            }
        };

        loadUserFromStorage();
    }, []);

    /**
     * Handle address updates from the AddressInput component
     * @param {Object} newAddress - Updated address object
     */
    const handleAddressChange = (newAddress) => {
        setAddress(newAddress);
    };

    /**
     * Handle profile picture selection and upload
     * Opens device image library with crop functionality
     */
    const pickProfilePicture = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission required", ERROR_MESSAGES.PERMISSION.MEDIA_DENIED);
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const selectedAsset = result.assets[0];
                const uploadResult = await uploadService.uploadImage(selectedAsset, 'profile');

                if (uploadResult.success) {
                    setProfilePictureUri(uploadResult.imageUrl);
                    logger.info('✅ Profile picture uploaded successfully');
                } else {
                    Alert.alert('Upload Error', handleError(uploadResult.error, 'ProfileSetupScreen/pickProfilePicture'));
                    setProfilePictureUri(selectedAsset.uri);
                    logger.error('❌ Profile picture upload failed', { error: uploadResult.error });
                }
            }
        } catch (error) {
            logger.error('❌ Error picking profile picture', { error: error.message });
            Alert.alert('Error', handleError(error, 'ProfileSetupScreen/pickProfilePicture'));
        }
    };

    /**
     * Handle video selection with upload limit enforcement
     * Prevents selection when maximum video count is reached
     */
    const pickVideos = async () => {
        const currentVideoCount = videos.filter(video => video !== null).length;

        if (currentVideoCount >= MAX_VIDEOS) {
            Alert.alert(
                'Video Limit Reached',
                `You already have ${MAX_VIDEOS} videos selected. Delete some videos first to add new ones.`,
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', ERROR_MESSAGES.PERMISSION.MEDIA_DENIED);
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: true,
                quality: 1,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const remainingSlots = MAX_VIDEOS - currentVideoCount;
            const videosToProcess = result.assets.slice(0, remainingSlots);

            if (result.assets.length > remainingSlots) {
                Alert.alert(
                    'Selection Limited',
                    `You selected ${result.assets.length} videos, but you only have ${remainingSlots} slots remaining. Processing the first ${remainingSlots} videos.`,
                    [{ text: 'OK', style: 'default' }]
                );
            }

            await processSelectedVideos(videosToProcess);

        } catch (err) {
            logger.error('❌ Failed to pick videos', { error: err.message });
            setVideoError(handleError(err, 'ProfileSetupScreen/pickVideos') || 'Could not access videos.');
        }
    };

    /**
     * Process selected videos with validation and thumbnail generation
     * @param {Array} selectedVideos - Array of selected video assets
     */
    const processSelectedVideos = async (selectedVideos) => {
        const currentVideoCount = videos.filter(video => video !== null).length;

        const processingOptions = {
            maxSizeMB: 20,
            maxDurationSec: 30
        };

        try {
            const batchResult = await processBatchVideos(selectedVideos, videoKeys, processingOptions);

            if (batchResult.success) {
                let updatedVideos = [...videos];
                let updatedThumbnails = [...videoThumbnails];
                let updatedUrls = [...videoUrls];
                let updatedStatuses = [...uploadStatuses];

                batchResult.processedVideos.forEach((videoData) => {
                    updatedVideos.push(videoData);
                    updatedThumbnails.push(videoData.thumbnail);
                    updatedUrls.push(null);
                    updatedStatuses.push({ uploading: true, uploaded: false, error: null });
                });

                setVideos(updatedVideos);
                setVideoThumbnails(updatedThumbnails);
                setVideoUrls(updatedUrls);
                setUploadStatuses(updatedStatuses);
                setVideoKeys(batchResult.videoKeys);

                // Start upload process for each processed video
                batchResult.processedVideos.forEach((videoData, batchIndex) => {
                    const actualIndex = currentVideoCount + batchIndex;
                    uploadSingleVideo(videoData, actualIndex);
                });

                if (batchResult.errors.length > 0) {
                    const errorMessages = batchResult.errors.map(e => handleError(e, 'ProfileSetupScreen/pickVideos')).join('\n');
                    Alert.alert('Some videos could not be processed', errorMessages);
                }

                setVideoError('');
            } else {
                Alert.alert('Error', handleError(batchResult.error, 'ProfileSetupScreen/pickVideos') || 'Failed to process videos');
                setVideoError(handleError(batchResult.error, 'ProfileSetupScreen/pickVideos') || 'Failed to process videos');
            }
        } catch (error) {
            logger.error('❌ Failed to process selected videos', { error: error.message });
            setVideoError(handleError(error, 'ProfileSetupScreen/processSelectedVideos') || 'Failed to process videos.');
        }
    };

    /**
     * Upload individual video with progress tracking
     * @param {Object} videoData - Processed video data object
     * @param {number} index - Video index in the array
     */
    const uploadSingleVideo = async (videoData, index) => {
        try {
            const uploadResult = await uploadService.uploadVideo(
                {
                    uri: videoData.uri,
                    fileName: videoData.fileName,
                    mimeType: videoData.mimeType,
                    duration: videoData.duration,
                    assetId: videoData.id
                },
                videoKeys,
                index,
                (progress) => {
                    setUploadProgress(prev => ({
                        ...prev,
                        [index]: progress.progress || 0
                    }));
                },
                {
                    maxSizeMB: 20,
                    maxDurationSec: 30
                }
            );

            if (uploadResult.success) {
                setVideos(prev => {
                    const newVideos = [...prev];
                    newVideos[index] = uploadResult.videoData;
                    return newVideos;
                });

                setVideoUrls(prev => {
                    const newUrls = [...prev];
                    newUrls[index] = uploadResult.videoUrl;
                    return newUrls;
                });

                setUploadStatuses(prev => {
                    const newStatuses = [...prev];
                    newStatuses[index] = { uploading: false, uploaded: true, error: null };
                    return newStatuses;
                });

                if (uploadResult.videoData.thumbnail !== videoData.thumbnail) {
                    setVideoThumbnails(prev => {
                        const newThumbnails = [...prev];
                        newThumbnails[index] = uploadResult.videoData.thumbnail;
                        return newThumbnails;
                    });
                }

                logger.info(`✅ Video ${index + 1} uploaded successfully`);
                setVideoError('');
            } else {
                setUploadStatuses(prev => {
                    const newStatuses = [...prev];
                    newStatuses[index] = { uploading: false, uploaded: false, error: uploadResult.error };
                    return newStatuses;
                });

                setVideoError(`Failed to upload ${videoData.fileName}: ${uploadResult.error}`);
                logger.error(`❌ Video ${index + 1} upload failed`, { error: uploadResult.error });
            }
        } catch (error) {
            logger.error(`❌ Failed to upload video ${index + 1}`, { error: error.message });

            setUploadStatuses(prev => {
                const newStatuses = [...prev];
                newStatuses[index] = { uploading: false, uploaded: false, error: error.message };
                return newStatuses;
            });

            setVideoError(`Failed to upload video: ${error.message}`);
        }
    };

    /**
     * Remove video from local state and cloud storage
     * @param {number} index - Index of video to delete
     */
    const deleteVideo = async (index) => {
        const videoToDelete = videos[index];
        if (!videoToDelete) {
            Alert.alert('Error', 'Invalid video selected for deletion.');
            return;
        }

        Alert.alert(
            'Delete Video',
            'Are you sure you want to delete this video? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (uploadStatuses[index]?.uploaded && videoToDelete.fileName) {
                                const deleteResult = await deleteVideoFromS3(videoToDelete.fileName);
                                if (!deleteResult.success) {
                                    Alert.alert(
                                        'Warning',
                                        'Video was removed locally but may still exist on server. Please contact support if needed.'
                                    );
                                }
                            }

                            const videoKey = uploadService.createVideoKey(
                                videoToDelete.fileName || '',
                                videoToDelete.size,
                                videoToDelete.duration
                            );
                            setVideoKeys(prev => {
                                const newKeys = new Set(prev);
                                newKeys.delete(videoKey);
                                return newKeys;
                            });

                            const newArrays = videoManager.removeVideo(index);
                            setVideos(newArrays.videos);
                            setVideoThumbnails(newArrays.thumbnails);
                            setVideoUrls(newArrays.urls);
                            setUploadStatuses(newArrays.statuses);

                            // Clean up progress tracking
                            setUploadProgress(prev => {
                                const newProgress = {};
                                Object.keys(prev).forEach(key => {
                                    const keyIndex = parseInt(key);
                                    if (keyIndex < index) {
                                        newProgress[keyIndex] = prev[key];
                                    } else if (keyIndex > index) {
                                        newProgress[keyIndex - 1] = prev[key];
                                    }
                                });
                                return newProgress;
                            });

                        } catch (error) {
                            logger.error('❌ Error deleting video', { error: error.message });
                            Alert.alert('Error', 'Failed to delete video. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    /**
     * Reorder videos by moving from one position to another
     * @param {number} fromIndex - Source index
     * @param {number} toIndex - Destination index
     */
    const moveVideo = (fromIndex, toIndex) => {
        if (toIndex < 0 || toIndex >= videos.length) return;

        const newArrays = videoManager.moveVideo(fromIndex, toIndex);
        setVideos(newArrays.videos);
        setVideoThumbnails(newArrays.thumbnails);
        setVideoUrls(newArrays.urls);
        setUploadStatuses(newArrays.statuses);
    };

    /**
     * Toggle genre selection in the user's preference list
     * @param {string} genre - Genre to toggle
     */
    const toggleGenre = (genre) => {
        setGenres((prev) =>
            prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
        );
    };

    /**
     * Validate that all required profile fields are completed
     * @returns {boolean} Form completion status
     */
    const isFormComplete = () => {
        const hasLocation = address.city && address.city.trim() !== '';
        const validVideos = videos.filter(video => video !== null);
        const validVideoUrls = videoUrls.filter(url => !!url);
        const allVideosUploaded = validVideos.length > 0 && validVideos.length === validVideoUrls.length;
        const noUploading = !uploadStatuses.some(status => status && status.uploading);
        return hasLocation && bio.trim() && allVideosUploaded && genres.length > 0 && profilePictureUri && noUploading;
    };

    /**
     * Complete profile setup and handle onboarding finalization
     * Submits profile data to backend and marks onboarding as complete
     */
    const handleContinue = async () => {
        if (!isFormComplete()) {
            if (uploadStatuses.some(status => status && status.uploading)) {
                Alert.alert('Upload in Progress', 'Please wait for all videos to finish uploading.');
            } else if (!address.city || address.city.trim() === '') {
                Alert.alert('Location Required', ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
            } else if (videos.filter(v => v !== null).length === 0) {
                Alert.alert('Videos Required', ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
            }
            return;
        }

        if (isUploading) {
            logger.warn('⚠️ Profile setup already in progress, ignoring duplicate request');
            return;
        }

        setIsUploading(true);
        logger.info('🚀 Starting profile completion');

        try {
            const finalLocation = address.formattedAddress ||
                `${address.streetNumber ? address.streetNumber + ' ' : ''}${address.street ? address.street + ', ' : ''}${address.city}${address.region ? ', ' + address.region : ''}${address.country ? ', ' + address.country : ''}`;

            const completeUser = builder
                .setLocation(finalLocation)
                .setBio(bio)
                .setGenres(genres)
                .setProfilePicture(profilePictureUri)
                .setVideos(videoUrls.filter(url => !!url))
                .build();

            const requestBody = {
                username: completeUser.username,
                fullName: completeUser.fullName,
                email: completeUser.email,
                password: completeUser.password,
                userType: completeUser.userType,
                bio: completeUser.bio,
                location: completeUser.location,
                genres: completeUser.genres,
                gender: completeUser.gender,
                instruments: completeUser.instruments || {},
                videoUrls: videoUrls.filter(url => !!url),
                addressDetails: address,
                profile_pic: completeUser.profilePicture || null,
            };

            if (completeUser.link) {
                requestBody.link = completeUser.link;
            }

            logger.info('📤 Sending profile data to API');

            let lambdaSuccess = false;
            let lambdaError = null;

            try {
                const res = await axios.post(BUILD_PROFILE_API_URL, requestBody, {
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                });

                logger.info('✅ Profile API response received', { status: res.status });
                lambdaSuccess = true;

            } catch (apiError) {
                lambdaError = apiError;
                logger.error('❌ Profile API call failed', {
                    error: apiError.response?.data || apiError.message,
                    isTimeout: apiError.code === 'ECONNABORTED'
                });
            }

            logger.info('🎯 Completing onboarding process');

            const onboardingResult = await completeOnboarding();

            if (!onboardingResult.success) {
                logger.error('❌ Onboarding completion failed', { error: onboardingResult.error });
                Alert.alert(
                    'Setup Error',
                    'Failed to complete onboarding. Please try again.',
                    [{ text: 'Retry', onPress: () => setIsUploading(false) }]
                );
                return;
            } else {
                logger.info('✅ Onboarding marked complete');
            }

            // Display appropriate completion message
            if (!lambdaSuccess && lambdaError) {
                if (lambdaError.code === 'ECONNABORTED') {
                    Alert.alert(
                        'Profile Setup Complete',
                        'Your profile has been set up! Some features may sync in the background.',
                        [{ text: 'Continue', style: 'default' }]
                    );
                } else {
                    Alert.alert(
                        'Profile Setup Complete',
                        'Your profile has been created successfully!',
                        [{ text: 'Continue', style: 'default' }]
                    );
                }
            } else {
                Alert.alert(
                    'Welcome to Groovi!',
                    'Your profile has been created successfully. Let\'s start discovering music!',
                    [{ text: 'Let\'s Go!', style: 'default' }]
                );
            }

            logger.info('🎉 Profile setup completed successfully');

        } catch (error) {
            logger.error('❌ Profile setup failed', { error: error.message });

            Alert.alert(
                'Setup Error',
                'Something went wrong during profile setup. Would you like to try again?',
                [
                    { text: 'Retry', onPress: () => setIsUploading(false) },
                    {
                        text: 'Skip for now',
                        onPress: async () => {
                            try {
                                const result = await completeOnboarding();
                                if (result.success) {
                                    logger.info('✅ Onboarding completed via skip option');
                                    Alert.alert(
                                        'Setup Complete',
                                        'You can complete your profile setup later from your profile page.',
                                        [{ text: 'Continue', style: 'default' }]
                                    );
                                }
                            } catch (skipError) {
                                logger.error('❌ Skip onboarding failed', { error: skipError.message });
                            }
                        }
                    }
                ]
            );
        } finally {
            setIsUploading(false);
        }
    };

    /**
     * Calculate overall upload progress across all active uploads
     * @returns {number} Progress percentage (0-100)
     */
    const getOverallProgress = () => {
        const activeUploads = uploadStatuses.filter((status, index) =>
            status && status.uploading && videos[index] && videos[index] !== null
        );

        if (activeUploads.length === 0) return 0;

        let totalProgress = 0;
        let validProgressCount = 0;

        uploadStatuses.forEach((status, index) => {
            if (status && status.uploading && videos[index] && videos[index] !== null && uploadProgress[index] !== undefined) {
                totalProgress += uploadProgress[index];
                validProgressCount++;
            }
        });

        return validProgressCount > 0 ? Math.round(totalProgress / validProgressCount) : 0;
    };

    /**
     * Filter and return only valid video thumbnails with their metadata
     * @returns {Array} Array of valid video thumbnail objects
     */
    const getValidVideoThumbnails = () => {
        return videoThumbnails
            .map((thumb, index) => ({ thumb, index, video: videos[index], status: uploadStatuses[index] }))
            .filter(item => item.thumb !== null && item.video !== null);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
                        Set up your profile
                    </Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}>
                    {/* Profile Picture Section */}
                    <TouchableOpacity
                        onPress={pickProfilePicture}
                        style={[styles.profilePictureContainer, {
                            backgroundColor: isDark ? '#222' : '#eee',
                        }]}
                    >
                        {profilePictureUri ? (
                            <>
                                <Image
                                    source={{ uri: profilePictureUri }}
                                    style={styles.profilePicture}
                                    resizeMode="cover"
                                />
                                <View style={styles.cameraIconContainer}>
                                    <Ionicons name="camera" size={20} color="#fff" />
                                </View>
                            </>
                        ) : (
                            <View style={styles.profilePicturePlaceholder}>
                                <Ionicons name="person-circle-outline" size={80} color={isDark ? '#ccc' : '#555'} />
                                <View style={styles.cameraIconContainer}>
                                    <Ionicons name="camera" size={20} color={isDark ? '#fff' : 'white'} />
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Bio Section */}
                    <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
                        Personal Info
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                height: 100,
                                backgroundColor: isDark ? '#222' : '#eee',
                                color: isDark ? '#fff' : '#000',
                            },
                        ]}
                        placeholder="Tell us about yourself..."
                        placeholderTextColor={isDark ? '#aaa' : '#666'}
                        value={bio}
                        onChangeText={setBio}
                        multiline
                    />

                    {/* Video Upload Section */}
                    <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
                        Upload Videos
                    </Text>

                    <TouchableOpacity
                        style={[styles.uploadBtn, { backgroundColor: isDark ? '#222' : '#eee' }]}
                        onPress={pickVideos}
                        disabled={uploadStatuses.some(status => status && status.uploading)}
                    >
                        <Ionicons name="cloud-upload-outline" size={24} color={isDark ? '#ccc' : '#555'} />
                        <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333', marginLeft: 8 }}>
                            {uploadStatuses.some(status => status && status.uploading)
                                ? 'Uploading...'
                                : `Choose videos (max ${MAX_VIDEOS}, 30s/20MB each)`
                            }
                        </Text>
                    </TouchableOpacity>

                    {/* Video Thumbnails Grid */}
                    {getValidVideoThumbnails().length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 }}>
                            {getValidVideoThumbnails().map(({ thumb, index, video, status }) => (
                                <View key={index} style={{ position: 'relative', alignItems: 'center' }}>
                                    <Image
                                        source={{ uri: thumb }}
                                        style={{
                                            width: 70,
                                            height: 100,
                                            borderRadius: 10,
                                            backgroundColor: '#000',
                                        }}
                                    />

                                    {/* Upload Status Indicator */}
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            backgroundColor: 'rgba(0,0,0,0.7)',
                                            borderRadius: 12,
                                            padding: 3,
                                            minWidth: 24,
                                            alignItems: 'center',
                                        }}
                                    >
                                        {status?.uploading ? (
                                            <View style={{ alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color="#fff" />
                                                <Text style={{ color: '#fff', fontSize: 8, marginTop: 2 }}>
                                                    {uploadProgress[index] || 0}%
                                                </Text>
                                            </View>
                                        ) : status?.uploaded ? (
                                            <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                                        ) : status?.error ? (
                                            <Ionicons name="close-circle" size={16} color="#f44336" />
                                        ) : (
                                            <Ionicons name="time-outline" size={16} color="#ff9800" />
                                        )}
                                    </View>

                                    {/* Video Metadata */}
                                    <Text style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 2 }}>
                                        {video?.duration?.toFixed(1)}s • {(video?.size / (1024 * 1024))?.toFixed(1)}MB
                                    </Text>

                                    {status?.error && (
                                        <Text style={{ fontSize: 8, color: '#f44336', textAlign: 'center', marginTop: 2, width: 70 }}>
                                            {status.error}
                                        </Text>
                                    )}

                                    {/* Video Controls */}
                                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                        <TouchableOpacity
                                            onPress={() => moveVideo(index, index - 1)}
                                            disabled={index === 0 || uploadStatuses.some(status => status && status.uploading)}
                                            style={{ marginHorizontal: 2, opacity: (index === 0 || uploadStatuses.some(status => status && status.uploading)) ? 0.3 : 1 }}
                                        >
                                            <Ionicons name="arrow-back-circle" size={22} color="#888" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => moveVideo(index, index + 1)}
                                            disabled={index === getValidVideoThumbnails().length - 1 || uploadStatuses.some(status => status && status.uploading)}
                                            style={{ marginHorizontal: 2, opacity: (index === getValidVideoThumbnails().length - 1 || uploadStatuses.some(status => status && status.uploading)) ? 0.3 : 1 }}
                                        >
                                            <Ionicons name="arrow-forward-circle" size={22} color="#888" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => deleteVideo(index)}
                                            disabled={uploadStatuses.some(status => status && status.uploading)}
                                            style={{ marginHorizontal: 2, opacity: uploadStatuses.some(status => status && status.uploading) ? 0.3 : 1 }}
                                        >
                                            <Ionicons name="trash-bin" size={22} color="#888" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Upload Progress Indicator */}
                    {uploadStatuses.some(status => status && status.uploading) && (
                        <View style={styles.progressSection}>
                            <Text style={[styles.progressText, { color: isDark ? '#fff' : '#000' }]}>
                                Uploading {uploadStatuses.filter(status => status && status.uploading).length} of {videos.filter(v => v !== null).length} videos... {getOverallProgress()}%
                            </Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${getOverallProgress()}%` }]} />
                            </View>
                        </View>
                    )}

                    {videoError !== '' && (
                        <Text style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{videoError}</Text>
                    )}

                    {/* Location Section */}
                    <AddressInput
                        address={address}
                        onAddressChange={handleAddressChange}
                        autoDetectInitial={true}
                    />

                    {/* Genre Selection */}
                    <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
                        Favorite Genres
                    </Text>
                    <View style={styles.genreContainer}>
                        {predefinedGenres.map((genre) => (
                            <TouchableOpacity
                                key={genre}
                                style={[
                                    styles.genreChip,
                                    {
                                        backgroundColor: genres.includes(genre)
                                            ? COLORS.ui?.accent || '#ff6ec4'
                                            : isDark
                                                ? '#444'
                                                : '#ddd',
                                    },
                                ]}
                                onPress={() => toggleGenre(genre)}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: genres.includes(genre) ? '#fff' : isDark ? '#eee' : '#333',
                                        fontWeight: genres.includes(genre) ? 'bold' : 'normal',
                                    }}
                                >
                                    {genre}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: isDark ? '#222' : '#eee',
                                color: isDark ? '#fff' : '#000',
                            },
                        ]}
                        placeholder="Other genre (optional)"
                        placeholderTextColor={isDark ? '#aaa' : '#666'}
                        value={customGenre}
                        onChangeText={setCustomGenre}
                        onSubmitEditing={() => {
                            if (customGenre.trim() && !genres.includes(customGenre.trim())) {
                                setGenres([...genres, customGenre.trim()]);
                                setCustomGenre('');
                            }
                        }}
                    />

                    {/* Submit Button */}
                    <Button
                        disabled={!isFormComplete() || isUploading}
                        onPress={handleContinue}
                        style={[styles.continueButton, (!isFormComplete() || isUploading) && styles.disabledButton]}
                    >
                        <LinearGradient
                            colors={COLORS.static.primaryGradient}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradient}
                        >
                            {isUploading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.continueText}>FINISH</Text>
                            )}
                        </LinearGradient>
                    </Button>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        padding: 20,
        paddingBottom: 60,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        marginBottom: 12,
    },
    backButton: {
        width: 28,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        marginBottom: 12,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 10,
    },
    progressSection: {
        marginBottom: 20,
    },
    progressText: {
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    progressBar: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.static?.primaryGradient?.[0] || '#ff6ec4',
        borderRadius: 3,
    },
    genreContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    genreChip: {
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 14,
    },
    continueButton: {
        marginTop: 2,
        marginBottom: 40,
        width: '100%',
        borderRadius: 30,
        overflow: 'hidden',
    },
    disabledButton: {
        opacity: 0.5,
    },
    gradient: {
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 30,
    },
    continueText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
    },
    profilePictureContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignSelf: 'center',
        marginVertical: 15,
        overflow: 'visible',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    profilePicture: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    profilePicturePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#f0f0f0',
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        backgroundColor: '#555',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
});

export default ProfileSetupScreen;
