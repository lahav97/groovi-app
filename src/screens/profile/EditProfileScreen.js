import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import VideoEditManager from '../../components/profile/VideoEditManager';
import Button from '../../components/common/Button';
import { COLORS } from '../../styles/theme';


const predefinedInstruments = {
  Strings: ['Guitar', 'Bass', 'Violin', 'Cello'],
  Percussion: ['Drums', 'Cajon', 'Bongos'],
  Keys: ['Piano', 'Synth'],
  Vocals: ['Lead Vocals', 'Backing Vocals'],
};

const predefinedGenres = ['Rock', 'Jazz', 'Pop', 'Funk', 'Classical', 'Hip Hop', 'Electronic', 'R&B'];

// Modern selectable chip component
const SelectableChip = ({ label, selected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      selected && styles.chipSelected
    ]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
    {selected && (
      <View style={styles.checkmarkContainer}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

// Profile Card Component
const ProfileCard = ({ title, icon, children, style = {} }) => {
  const isDark = useColorScheme() === 'dark';
  const cardColor = isDark ? '#2c2c2e' : '#fff';
  const textColor = isDark ? '#fff' : '#000';

  return (
    <View style={[styles.card, { backgroundColor: cardColor }, style]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={24} color={COLORS.static.primaryGradient[0]} />
        <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

const EditProfileScreen = ({ navigation }) => {
  const isDark = useColorScheme() === 'dark';

  // Simplified address state - just city and country
  const [city, setCity] = useState('Tel Aviv');
  const [country, setCountry] = useState('Israel');

  const [bio, setBio] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);

  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [customGenre, setCustomGenre] = useState('');

  const [videos, setVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);

  useEffect(() => {
    // Initialize with example data
    setBio('Percussionist. Music lover.');
    setSelectedInstruments(['Drums']);
    setSelectedGenres(['Rock']);
  }, []);

  const toggleSelection = (item, list, setList) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addCustomItem = (value, list, setList, setInput) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const pickProfilePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Allow media access to choose a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 500 } }], {
        compress: 0.7,
        format: 'jpeg',
      });
      setProfilePictureUri(compressed.uri);
    }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Allow media access to choose a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const { uri, duration, fileSize } = result.assets[0];

      if (videoUrls.includes(uri)) {
        Alert.alert('Duplicate video', 'This video is already added.');
        return;
      }

      if ((duration || 0) > 30000) {
        Alert.alert('Too long', 'Max 30 seconds allowed.');
        return;
      }

      if (fileSize > 4 * 1024 * 1024) {
        Alert.alert('Too big', 'Max 4MB allowed.');
        return;
      }

      const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000 });
      setVideos((prev) => [...prev, { uri, id: Date.now().toString(), thumbnail: thumb.uri }]);
      setVideoThumbnails((prev) => [...prev, thumb.uri]);
      setVideoUrls((prev) => [...prev, uri]);
    }
  };

  const deleteVideo = (index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoThumbnails((prev) => prev.filter((_, i) => i !== index));
    setVideoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const moveVideo = (from, to) => {
    if (to < 0 || to >= videos.length) return;
    const move = (arr) => {
      const updated = [...arr];
      const [item] = updated.splice(from, 1);
      updated.splice(to, 0, item);
      return updated;
    };
    setVideos(move);
    setVideoThumbnails(move);
    setVideoUrls(move);
  };

  const isFormValid = () => {
    return city.trim() && country.trim() && bio && profilePictureUri && videos.length && selectedInstruments.length && selectedGenres.length;
  };

  const handleSave = () => {
    if (!isFormValid()) {
      Alert.alert('Incomplete', 'Fill in all fields and upload at least one video.');
      return;
    }
    
    const profileData = {
      bio,
      profilePicture: profilePictureUri,
      instruments: selectedInstruments,
      genres: selectedGenres,
      videos: videoUrls,
      location: `${city}, ${country}`,
      city,
      country,
    };
    
    console.log('Saving profile data:', profileData);
    Alert.alert('Saved', 'Your profile has been updated.');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f5f5f7' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: isDark ? '#fff' : '#000' }]}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Card */}
        <ProfileCard title="Location" icon="location-outline">
          <View style={styles.rowContainer}>
            <TextInput
              style={[styles.input, styles.halfInput, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              placeholder="City"
              placeholderTextColor="#9E9E9E"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={[styles.input, styles.halfInput, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              placeholder="Country"
              placeholderTextColor="#9E9E9E"
              value={country}
              onChangeText={setCountry}
            />
          </View>
        </ProfileCard>

        {/* Profile Picture Card */}
        <ProfileCard title="Profile Picture" icon="person-outline">
          <TouchableOpacity onPress={pickProfilePicture} style={styles.profilePictureContainer}>
            {profilePictureUri ? (
              <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person-circle-outline" size={60} color={isDark ? '#777' : '#aaa'} />
                <Text style={[styles.placeholderText, { color: isDark ? '#aaa' : '#666' }]}>
                  Tap to add photo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ProfileCard>

        {/* Bio Card */}
        <ProfileCard title="Bio" icon="document-text-outline">
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#9E9E9E"
            multiline
            style={[styles.bioInput, { 
              backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
              color: isDark ? '#fff' : '#000'
            }]}
          />
        </ProfileCard>

        {/* Instruments Card */}
        <ProfileCard title="Instruments" icon="musical-notes-outline">
          {Object.entries(predefinedInstruments).map(([category, instruments]) => (
            <View key={category}>
              <Text style={[styles.categoryLabel, { color: isDark ? '#fff' : '#000' }]}>{category}</Text>
              <View style={styles.chipGrid}>
                {instruments.map(instrument => (
                  <SelectableChip
                    key={instrument}
                    label={instrument}
                    selected={selectedInstruments.includes(instrument)}
                    onSelect={() => toggleSelection(instrument, selectedInstruments, setSelectedInstruments)}
                  />
                ))}
              </View>
            </View>
          ))}
          
          <View style={styles.customRow}>
            <TextInput
              value={customInstrument}
              onChangeText={setCustomInstrument}
              placeholder="Add custom instrument..."
              placeholderTextColor="#9E9E9E"
              style={[styles.input, styles.flex1, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              onSubmitEditing={() => {
                addCustomItem(customInstrument, selectedInstruments, setSelectedInstruments, setCustomInstrument);
              }}
            />
            <TouchableOpacity
              onPress={() => addCustomItem(customInstrument, selectedInstruments, setSelectedInstruments, setCustomInstrument)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ProfileCard>

        {/* Genres Card */}
        <ProfileCard title="Genres" icon="disc-outline">
          <View style={styles.chipGrid}>
            {predefinedGenres.map(genre => (
              <SelectableChip
                key={genre}
                label={genre}
                selected={selectedGenres.includes(genre)}
                onSelect={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
              />
            ))}
          </View>
          
          <View style={styles.customRow}>
            <TextInput
              value={customGenre}
              onChangeText={setCustomGenre}
              placeholder="Add custom genre..."
              placeholderTextColor="#9E9E9E"
              style={[styles.input, styles.flex1, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              onSubmitEditing={() => {
                addCustomItem(customGenre, selectedGenres, setSelectedGenres, setCustomGenre);
              }}
            />
            <TouchableOpacity
              onPress={() => addCustomItem(customGenre, selectedGenres, setSelectedGenres, setCustomGenre)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedGenres.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedTitle, { color: isDark ? '#fff' : '#000' }]}>Selected:</Text>
              <View style={styles.selectedChips}>
                {selectedGenres.map(genre => (
                  <View key={genre} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{genre}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedGenres(selectedGenres.filter(g => g !== genre))}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Ionicons name="close-circle" size={16} color={COLORS.static.primaryGradient[0]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ProfileCard>

        {/* Videos Card */}
        <ProfileCard title="Videos" icon="videocam-outline">
          <TouchableOpacity onPress={pickVideo} style={styles.uploadBtn}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.static.primaryGradient[0]} />
            <Text style={[styles.uploadText, { color: isDark ? '#fff' : '#000' }]}>Upload Video</Text>
          </TouchableOpacity>

          <VideoEditManager
            videos={videos}
            setVideos={setVideos}
            videoThumbnails={videoThumbnails}
            setVideoThumbnails={setVideoThumbnails}
            videoUrls={videoUrls}
            setVideoUrls={setVideoUrls}
            onDelete={deleteVideo}
            onMove={moveVideo}
          />
        </ProfileCard>

        {/* Save Button - Part of ScrollView Content */}
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} activeOpacity={0.8}>
          <LinearGradient 
            colors={COLORS.static.primaryGradient} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={styles.gradient}
          >
            <Text style={styles.saveText}>Save Changes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scroll: { 
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40, // Reduced padding since button is now in content
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  input: { 
    borderRadius: 12, 
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  bioInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    height: 100,
    textAlignVertical: 'top',
  },
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginVertical: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  profilePicture: { 
    width: '100%', 
    height: '100%' 
  },
  profilePicturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 12,
  },
  chip: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    marginRight: 8, 
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  chipSelected: { 
    backgroundColor: '#E1C4FF',
    borderColor: COLORS.static.primaryGradient[0],
  },
  chipText: { 
    color: '#555', 
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: { 
    color: COLORS.static.primaryGradient[0], 
    fontWeight: '600' 
  },
  checkmarkContainer: {
    backgroundColor: COLORS.static.primaryGradient[0],
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  flex1: { flex: 1 },
  addBtn: {
    backgroundColor: COLORS.static.primaryGradient[0],
    padding: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  selectedContainer: {
    marginTop: 16
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1C4FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.static.primaryGradient[0],
  },
  selectedChipText: {
    fontSize: 14,
    color: COLORS.static.primaryGradient[0],
    marginRight: 6,
    fontWeight: '500'
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.static.primaryGradient[0],
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  // Save button as part of content
  saveButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 30,
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});

export default EditProfileScreen;