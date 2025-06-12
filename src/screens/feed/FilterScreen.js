import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Switch,
  Animated,
  useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/theme';
import Slider from '@react-native-community/slider';
import {
  createValidationError,
  handleError
} from '../../utils/errors';

const INSTRUMENTS = {
  Strings: ['Guitar', 'Bass', 'Violin', 'Cello'],
  Percussion: ['Drums', 'Cajon', 'Bongos'],
  Keys: ['Piano', 'Synth'],
  Vocals: ['Lead Vocals', 'Backing Vocals'],
  Winds: ['Saxophone', 'Trumpet', 'Flute'],
};

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Pro'];
const GENRES = ['Rock', 'Jazz', 'Pop', 'Classical', 'Hip Hop', 'Electronic', 'R&B'];
const GENDERS = ['Any', 'Male', 'Female', 'Other'];

// Modern selectable chip component
const SelectableChip = ({ label, selected, onSelect, style = {} }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      selected && styles.chipSelected,
      style
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

// Filter Card Component
const FilterCard = ({ title, icon, children, style = {} }) => {
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

const DiscoverFiltersScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? '#1c1c1e' : '#f5f5f7';
  const textColor = isDark ? '#fff' : '#000';
  const navigation = useNavigation();

  // States
  const [distance, setDistance] = useState(10);
  const [anywhere, setAnywhere] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');
  const [selectedGender, setSelectedGender] = useState('Any');
  
  // Track if filters have been modified
  const [filtersModified, setFiltersModified] = useState(false);

  // Check if any filter has been modified
  useEffect(() => {
    const isModified = 
      distance !== 10 ||
      anywhere !== false ||
      selectedInstruments.length > 0 ||
      selectedSkill.length > 0 ||
      selectedGenres.length > 0 ||
      selectedGender !== 'Any';
    
    setFiltersModified(isModified);
  }, [
    distance,
    anywhere,
    selectedInstruments,
    selectedSkill,
    selectedGenres,
    selectedGender
  ]);

  const toggleMulti = (arr, setArr, value) => {
    setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  const resetFilters = () => {
    setDistance(10);
    setAnywhere(false);
    setSelectedInstruments([]);
    setSelectedSkill([]);
    setSelectedGenres([]);
    setCustomGenre('');
    setSelectedGender('Any');
  };

  const applyFilters = () => {
    // Apply filters and navigate back to Discover
    navigation.goBack();
  };

  // Example: Validate custom genre before adding
  const handleAddCustomGenre = () => {
    try {
      if (!customGenre.trim()) {
        throw createValidationError('REQUIRED_FIELD', 'customGenre');
      }
      if (selectedGenres.includes(customGenre.trim())) {
        throw createValidationError('VALIDATION', 'customGenre', { message: 'Genre already selected' });
      }
      setSelectedGenres([...selectedGenres, customGenre.trim()]);
      setCustomGenre('');
    } catch (error) {
      // Show user-friendly error message
      alert(handleError(error, 'FilterScreen/AddCustomGenre'));
    }
  };

  // Button animation for Apply button
  const scaleAnim = useRef(new Animated.Value(filtersModified ? 1 : 0.95)).current;
  const opacityAnim = useRef(new Animated.Value(filtersModified ? 1 : 0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: filtersModified ? 1 : 0.95,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(opacityAnim, {
        toValue: filtersModified ? 1 : 0.5,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  }, [filtersModified, scaleAnim, opacityAnim]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: textColor }]}>Discover Filters</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Card */}
        <FilterCard title="Location" icon="location-outline">
          {/* Distance Range */}
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: textColor }]}>
              {anywhere ? 'Show musicians anywhere' : 'Limit by distance'}
            </Text>
            <Switch 
              value={anywhere} 
              onValueChange={setAnywhere}
              trackColor={{ false: '#D1D1D6', true: '#E1C4FF' }}
              thumbColor={anywhere ? COLORS.static.primaryGradient[0] : '#f4f3f4'}
            />
          </View>
          
          {!anywhere && (
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderTitle, { color: textColor }]}>Distance Range</Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={150}
                step={1}
                value={distance}
                onValueChange={setDistance}
                onSlidingComplete={setDistance}
                minimumTrackTintColor={COLORS.static.primaryGradient[0]}
                maximumTrackTintColor={isDark ? "#555" : "#EEEEEE"}
                thumbTintColor={COLORS.static.primaryGradient[0]}
              />
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: isDark ? '#aaa' : '#888' }]}>1 km</Text>
                <Text style={[styles.sliderValue, { color: COLORS.static.primaryGradient[0] }]}>
                  {distance} km radius
                </Text>
                <Text style={[styles.sliderLabel, { color: isDark ? '#aaa' : '#888' }]}>150 km</Text>
              </View>
            </View>
          )}
        </FilterCard>

        {/* Instruments Card */}
        <FilterCard title="Instruments" icon="musical-notes-outline">
          {Object.entries(INSTRUMENTS).map(([category, instruments]) => (
            <View key={category}>
              <Text style={[styles.categoryLabel, { color: textColor }]}>{category}</Text>
              <View style={styles.chipGrid}>
                {instruments.map(instrument => (
                  <SelectableChip
                    key={instrument}
                    label={instrument}
                    selected={selectedInstruments.includes(instrument)}
                    onSelect={() => toggleMulti(selectedInstruments, setSelectedInstruments, instrument)}
                  />
                ))}
              </View>
            </View>
          ))}
        </FilterCard>

        {/* Skill Level Card */}
        <FilterCard title="Skill Level" icon="star-outline">
          <View style={styles.chipGrid}>
            {SKILL_LEVELS.map(level => (
              <SelectableChip
                key={level}
                label={level}
                selected={selectedSkill.includes(level)}
                onSelect={() => toggleMulti(selectedSkill, setSelectedSkill, level)}
              />
            ))}
          </View>
        </FilterCard>

        {/* Genres Card */}
        <FilterCard title="Genres" icon="disc-outline">
          <View style={styles.chipGrid}>
            {GENRES.map(genre => (
              <SelectableChip
                key={genre}
                label={genre}
                selected={selectedGenres.includes(genre)}
                onSelect={() => toggleMulti(selectedGenres, setSelectedGenres, genre)}
              />
            ))}
          </View>
          
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5' }]}
            placeholder="Add custom genre..."
            placeholderTextColor="#9E9E9E"
            value={customGenre}
            onChangeText={setCustomGenre}
            onSubmitEditing={handleAddCustomGenre}
          />

          {selectedGenres.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedTitle, { color: textColor }]}>Selected:</Text>
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
        </FilterCard>

        {/* Advanced Filters Card */}
        <FilterCard title="Additional Filters" icon="options-outline">
          <Text style={[styles.categoryLabel, { color: textColor }]}>Gender Preference</Text>
          <View style={styles.chipGrid}>
            {GENDERS.map(gender => (
              <SelectableChip
                key={gender}
                label={gender}
                selected={selectedGender === gender}
                onSelect={() => setSelectedGender(gender)}
              />
            ))}
          </View>
        </FilterCard>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.resetBtn} 
            onPress={resetFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>
          
          <Animated.View 
            style={[
              styles.applyBtnContainer,
              { 
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.applyBtn} 
              onPress={applyFilters}
              activeOpacity={filtersModified ? 0.7 : 1}
              disabled={!filtersModified}
            >
              <LinearGradient
                colors={COLORS.static.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text> 
                <Ionicons name="checkmark" size={18} color="#fff" style={styles.applyBtnIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
    paddingBottom: 100 
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
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginVertical: 8
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  sliderContainer: { 
    marginVertical: 16 
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sliderValue: { 
    fontSize: 16,
    fontWeight: '600',
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
  input: { 
    borderRadius: 12, 
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 16
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
  buttonRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 24,
    marginBottom: 40
  },
  resetBtn: { 
    flex: 1, 
    backgroundColor: '#EEEEEE', 
    padding: 16, 
    borderRadius: 30, 
    marginRight: 12, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  resetBtnText: { 
    color: '#666', 
    fontWeight: '600',
    fontSize: 16
  },
  applyBtnContainer: {
    flex: 2,
  },
  applyBtn: { 
    borderRadius: 30, 
    overflow: 'hidden',
  },
  gradientBtn: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  applyBtnIcon: {
    marginLeft: 8
  }
});

export default DiscoverFiltersScreen;