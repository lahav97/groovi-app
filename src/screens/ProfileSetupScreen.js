import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const predefinedGenres = ['Pop', 'Rock', 'Jazz', 'Hip Hop', 'Classical', 'Electronic', 'R&B'];

const ProfileSetupScreen = () => {
  const navigation = useNavigation();

  const [location, setLocation] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [bio, setBio] = useState('');
  const [video, setVideo] = useState(null);
  const [genres, setGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUseManualLocation(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync(loc.coords);
      const city = address[0]?.city || '';
      setLocation(city);
    })();
  }, []);

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*' });
    if (!result.canceled) {
      setVideo(result.assets[0]);
    }
  };

  const toggleGenre = (genre) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const isFormComplete = () => {
    const hasLocation = useManualLocation ? manualLocation : location;
    return hasLocation && bio.trim() && video && genres.length > 0;
  };

  const handleContinue = () => {
    if (!isFormComplete()) return;
    navigation.navigate('Feed'); // or next step
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Set up your profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Location</Text>
        {useManualLocation ? (
          <TextInput
            style={styles.input}
            placeholder="Enter your city"
            value={manualLocation}
            onChangeText={setManualLocation}
          />
        ) : (
          <Text style={styles.infoText}>{location || 'Detecting location...'}</Text>
        )}

        <Text style={styles.sectionTitle}>Personal Info</Text>
        <TextInput
          style={[styles.input, { height: 100 }]}
          placeholder="Tell us about yourself..."
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <Text style={styles.sectionTitle}>Upload a Video</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickVideo}>
          <Ionicons name="cloud-upload-outline" size={24} color="#555" />
          <Text style={styles.uploadText}>Choose a video from your phone</Text>
        </TouchableOpacity>
        {video && <Text style={styles.infoText}>Selected: {video.name}</Text>}

        <Text style={styles.sectionTitle}>Favorite Genres</Text>
        <View style={styles.genreContainer}>
          {predefinedGenres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[styles.genreChip, genres.includes(genre) && styles.chipSelected]}
              onPress={() => toggleGenre(genre)}
            >
              <Text
                style={[styles.genreText, genres.includes(genre) && styles.genreTextSelected]}
              >
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Other genre (optional)"
          value={customGenre}
          onChangeText={(text) => {
            setCustomGenre(text);
            if (text.trim() && !genres.includes(text)) setGenres([...genres, text]);
          }}
        />
      </ScrollView>

      <TouchableOpacity
        disabled={!isFormComplete()}
        onPress={handleContinue}
        style={[styles.continueButton, !isFormComplete() && styles.disabledButton]}
      >
        <LinearGradient
          colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={styles.continueText}>CONTINUE</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 100 },
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
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  infoText: { fontSize: 14, color: '#555', marginBottom: 8 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  uploadText: { fontSize: 15, color: '#333' },
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
    backgroundColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#ff6ec4',
  },
  genreText: { fontSize: 14, color: '#333' },
  genreTextSelected: { color: '#fff', fontWeight: 'bold' },
  continueButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.4,
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 30,
  },
  continueText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default ProfileSetupScreen;