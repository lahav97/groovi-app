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
import VideoManager from '../../components/profile/VideoManager';
import Button from '../../components/common/Button';

const predefinedInstruments = ['Guitar', 'Bass', 'Drums', 'Keys', 'Vocals'];
const predefinedGenres = ['Rock', 'Jazz', 'Pop', 'Funk', 'Classical'];

const EditProfileScreen = ({ navigation }) => {
  const isDark = useColorScheme() === 'dark';

  const [location, setLocation] = useState('');
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
    setLocation('Tel Aviv');
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

  const isFormValid = () =>
    location && bio && profilePictureUri && videos.length && selectedInstruments.length && selectedGenres.length;

  const handleSave = () => {
    if (!isFormValid()) {
      Alert.alert('Incomplete', 'Fill in all fields and upload at least one video.');
      return;
    }
    Alert.alert('Saved', 'Your profile has been updated.');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Your city"
          style={[styles.input, { backgroundColor: isDark ? '#222' : '#eee', color: isDark ? '#fff' : '#000' }]}
        />

        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Profile Picture</Text>
        <TouchableOpacity onPress={pickProfilePicture} style={styles.profilePictureContainer}>
          {profilePictureUri ? (
            <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
          ) : (
            <Ionicons name="person-circle-outline" size={80} color={isDark ? '#777' : '#aaa'} />
          )}
        </TouchableOpacity>

        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself"
          multiline
          style={[styles.input, { height: 100, backgroundColor: isDark ? '#222' : '#eee', color: isDark ? '#fff' : '#000' }]}
        />

        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Instruments</Text>
        <View style={styles.multiRow}>
          {predefinedInstruments.map((inst) => (
            <TouchableOpacity
              key={inst}
              style={[
                styles.tag,
                selectedInstruments.includes(inst) && styles.tagSelected,
              ]}
              onPress={() => toggleSelection(inst, selectedInstruments, setSelectedInstruments)}
            >
            <Text style={[
              styles.tagText,
              { color: isDark ? '#fff' : '#000' }
            ]}>
              {inst}
            </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            value={customInstrument}
            onChangeText={setCustomInstrument}
            placeholder="Other instrument..."
            style={[styles.input, styles.flex1, { backgroundColor: isDark ? '#222' : '#eee', color: isDark ? '#fff' : '#000' }]}
          />
          <TouchableOpacity
            onPress={() => addCustomItem(customInstrument, selectedInstruments, setSelectedInstruments, setCustomInstrument)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Genres</Text>
        <View style={styles.multiRow}>
          {predefinedGenres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.tag,
                selectedGenres.includes(genre) && styles.tagSelected,
              ]}
              onPress={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
            >
              <Text style={styles.tagText}>{genre}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            value={customGenre}
            onChangeText={setCustomGenre}
            placeholder="Other genre..."
            style={[styles.input, styles.flex1, { backgroundColor: isDark ? '#222' : '#eee', color: isDark ? '#fff' : '#000' }]}
          />
          <TouchableOpacity
            onPress={() => addCustomItem(customGenre, selectedGenres, setSelectedGenres, setCustomGenre)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Videos</Text>
        <TouchableOpacity onPress={pickVideo} style={[styles.uploadBtn, { backgroundColor: isDark ? '#222' : '#eee' }]}>
          <Ionicons name="cloud-upload-outline" size={22} color={isDark ? '#fff' : '#000'} />
          <Text style={{ marginLeft: 8, color: isDark ? '#fff' : '#000' }}>Upload Video</Text>
        </TouchableOpacity>

        <VideoManager
          videos={videos}
          setVideos={setVideos}
          videoThumbnails={videoThumbnails}
          setVideoThumbnails={setVideoThumbnails}
          videoUrls={videoUrls}
          setVideoUrls={setVideoUrls}
          onDelete={deleteVideo}
          onMove={moveVideo}
        />
      </ScrollView>

      <Button onPress={handleSave} style={styles.saveButton}>
        <LinearGradient colors={['#ff6ec4', '#ff69b4', '#ff1493']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          <Text style={styles.saveText}>Save Changes</Text>
        </LinearGradient>
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 15 },
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginVertical: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicture: { width: '100%', height: '100%' },
  multiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    margin: 4,
    borderColor: '#888',
    backgroundColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: '#ff69b433', // light pink with transparency
  },
  tagText: {
    fontWeight: '500',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  flex1: { flex: 1 },
  addBtn: {
    backgroundColor: '#ff69b4',
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
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
