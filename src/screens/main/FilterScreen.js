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
  Easing,
  Platform,
  UIManager,
  LayoutAnimation,
  useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const INSTRUMENTS = {
  Strings: ['Guitar', 'Bass', 'Violin', 'Cello'],
  Percussion: ['Drums', 'Cajon', 'Bongos'],
  Keys: ['Piano', 'Synth'],
};
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Pro'];
const GENRES = ['Rock', 'Jazz', 'Pop', 'Classical', 'Other'];
const GENDERS = ['Male', 'Female', 'Any'];


// Collapsible section component for better organization
const CollapsibleSection = ({ title, children, initiallyExpanded = false }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [animation] = useState(new Animated.Value(initiallyExpanded ? 1 : 0));
  
  const toggleExpand = () => {
    setExpanded(!expanded);
    Animated.timing(animation, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false
    }).start();
  };

  const rotateIcon = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
          <Ionicons name="chevron-down" size={22} color="#555" />
        </Animated.View>
      </TouchableOpacity>
      {expanded && (
        <Animated.View style={{ opacity: animation }}>
          {children}
        </Animated.View>
      )}
    </View>
  );
};

// Modern selectable chip component
const SelectableChip = ({ label, selected, onSelect, multiSelect = true }) => (
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
    {selected && multiSelect && (
      <View style={styles.checkmarkContainer}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

const FilterScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? '#1c1c1e' : '#f5f5f7';
  const textColor = isDark ? '#fff' : '#000';
  const cardColor = isDark ? '#2c2c2e' : '#fff';
  const navigation = useNavigation();

  // Default state values
  const defaultDistance = 10;
  const defaultAnywhere = false;
  const defaultInstruments = [];
  const defaultSkill = [];
  const defaultGenres = [];

  // States
  const [distance, setDistance] = useState(defaultDistance);
  const [sliderMoving, setSliderMoving] = useState(false);
  const [anywhere, setAnywhere] = useState(defaultAnywhere);
  const [selectedInstruments, setSelectedInstruments] = useState(defaultInstruments);
  const [expandedInstrumentGroups, setExpandedInstrumentGroups] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(defaultSkill);
  const [selectedGenres, setSelectedGenres] = useState(defaultGenres);
  const [customGenre, setCustomGenre] = useState('');
  const [selectedGender, setSelectedGender] = useState('Any');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [manualLocation, setManualLocation] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // New state to track if filters have been modified
  const [filtersModified, setFiltersModified] = useState(false);

  // Check if any filter has been modified
  useEffect(() => {
    const isModified = 
      distance !== defaultDistance ||
      anywhere !== defaultAnywhere ||
      selectedInstruments.length > 0 ||
      selectedSkill.length > 0 ||
      selectedGenres.length > 0 ||
      selectedGender !== 'Any' ||
      !useCurrentLocation ||
      manualLocation.trim() !== '';
    
    setFiltersModified(isModified);
  }, [
    distance,
    anywhere,
    selectedInstruments,
    selectedSkill,
    selectedGenres,
    selectedGender,
    useCurrentLocation,
    manualLocation
  ]);

  const toggleMulti = (arr, setArr, value) => {
    setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  const toggleGroup = (group) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedInstrumentGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const resetFilters = () => {
    setDistance(defaultDistance);
    setAnywhere(defaultAnywhere);
    setSelectedInstruments(defaultInstruments);
    setExpandedInstrumentGroups([]);
    setSelectedSkill(defaultSkill);
    setSelectedGenres(defaultGenres);
    setCustomGenre('');
    setSelectedGender('Any');
    setUseCurrentLocation(true);
    setManualLocation('');
    setShowAdvanced(false);
  };

  const applyFilters = () => {
    // Apply filters and navigate back to Feed
    navigation.navigate('Feed');
  };

  const navigateBack = () => {
    navigation.navigate('Feed');
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
      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, {paddingTop: 23}]}>
          <TouchableOpacity style={styles.backIcon} onPress={navigateBack}>
            <Ionicons name="arrow-back" size={28} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: textColor }]}>Filter Musicians</Text>
          <View style={{ width: 28 }} />
        </View>
        
        <CollapsibleSection title="Distance" initiallyExpanded={true}>
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: textColor }]}>Search {anywhere ? 'Anywhere' : 'By Distance'}</Text>
              <Switch 
                value={anywhere} 
                onValueChange={setAnywhere}
                trackColor={{ false: '#D1D1D6', true: '#ffc2e3' }}
                thumbColor={anywhere ? '#e91e63' : '#f4f3f4'}
              />
            </View>
            
            {!anywhere && (
              <View style={styles.sliderContainer}>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={1}
                  maximumValue={150}
                  step={1}
                  value={distance}
                  onValueChange={(val) => {
                    setSliderMoving(true);
                    setDistance(val);
                  }}
                  onSlidingComplete={(val) => {
                    setDistance(val);
                    setSliderMoving(false);
                  }}
                  minimumTrackTintColor="#e91e63"
                  maximumTrackTintColor={isDark ? "#555" : "#EEEEEE"}
                  thumbTintColor="#e91e63"
                />
                <View style={styles.sliderLabels}>
                  <Text style={[styles.sliderMinLabel, { color: isDark ? '#aaa' : '#888' }]}>1 km</Text>
                  <Text style={[styles.sliderValue, { color: '#e91e63' }]}>{distance} km</Text>
                  <Text style={[styles.sliderMaxLabel, { color: isDark ? '#aaa' : '#888' }]}>150 km</Text>
                </View>
              </View>
            )}
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Instruments" initiallyExpanded={true}>
          <View style={styles.card}>
            {Object.entries(INSTRUMENTS).map(([group, instruments]) => (
              <View key={group} style={styles.groupBlock}>
                <TouchableOpacity 
                  style={styles.groupHeader}
                  onPress={() => toggleGroup(group)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupTitle}>{group}</Text>
                  <Ionicons 
                    name={expandedInstrumentGroups.includes(group) ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color="#555" 
                  />
                </TouchableOpacity>
                
                {expandedInstrumentGroups.includes(group) && (
                  <View style={styles.chipGrid}>
                    {instruments.map(instr => (
                      <SelectableChip
                        key={instr}
                        label={instr}
                        selected={selectedInstruments.includes(instr)}
                        onSelect={() => toggleMulti(selectedInstruments, setSelectedInstruments, instr)}
                      />
                    ))}
                  </View>
                )}
                
                {group !== Object.keys(INSTRUMENTS)[Object.keys(INSTRUMENTS).length - 1] && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Skill Level">
          <View style={styles.card}>
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
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Genre">
          <View style={styles.card}>
            <View style={styles.chipGrid}>
              {GENRES.map(genre => (
                <SelectableChip
                  key={genre}
                  label={genre}
                  selected={selectedGenres.includes(genre)}
                  onSelect={() => {
                    if (genre === 'Other') return;
                    toggleMulti(selectedGenres, setSelectedGenres, genre);
                  }}
                />
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Add custom genre..."
              placeholderTextColor="#9E9E9E"
              value={customGenre}
              onChangeText={setCustomGenre}
              onSubmitEditing={() => {
                if (customGenre.trim() && !selectedGenres.includes(customGenre.trim())) {
                  setSelectedGenres([...selectedGenres, customGenre.trim()]);
                  setCustomGenre('');
                }
              }}
            />

            {selectedGenres.length > 0 && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedTitle}>Selected Genres:</Text>
                <View style={styles.selectedChips}>
                  {selectedGenres.map(genre => (
                    <View key={genre} style={styles.selectedChip}>
                      <Text style={styles.selectedChipText}>{genre}</Text>
                      <TouchableOpacity
                        onPress={() => setSelectedGenres(selectedGenres.filter(g => g !== genre))}
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#673AB7" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Advanced Filters">
          <View style={styles.card}>
            <Text style={styles.advancedLabel}>Gender Preference</Text>
            <View style={styles.chipGrid}>
              {GENDERS.map(gender => (
                <SelectableChip
                  key={gender}
                  label={gender}
                  selected={selectedGender === gender}
                  onSelect={() => setSelectedGender(gender)}
                  multiSelect={false}
                />
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.advancedLabel}>Location</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Use my current location</Text>
              <Switch 
                value={useCurrentLocation} 
                onValueChange={setUseCurrentLocation}
                trackColor={{ false: '#D1D1D6', true: '#D1C4E9' }}
                thumbColor={useCurrentLocation ? '#673AB7' : '#f4f3f4'}
              />
            </View>
            
            {!useCurrentLocation && (
              <TextInput
                style={styles.input}
                placeholder="Enter city or area"
                placeholderTextColor="#9E9E9E"
                value={manualLocation}
                onChangeText={setManualLocation}
              />
            )}

            <View style={styles.divider} />

            <Text style={styles.advancedLabel}>Sort Results By</Text>
            <View style={styles.chipGrid}>
              {['Distance', 'Newest', 'Most Active'].map(option => (
                <SelectableChip
                  key={option}
                  label={option}
                  selected={option === 'Distance'} // Default to Distance
                  onSelect={() => {}} // You would implement sorting logic here
                  multiSelect={false}
                />
              ))}
            </View>
          </View>
        </CollapsibleSection>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.resetBtn} 
            onPress={resetFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>
          
          {/* Apply button with animation */}
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
                colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text> 
                <Ionicons name="search" size={18} color="#fff" style={styles.applyBtnIcon} />
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
    backgroundColor: '#F5F5F7'
  },
  scroll: { 
    padding: 16, 
    paddingBottom: 100 
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    alignSelf: 'center'
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sectionTitle: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    color: '#333'
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backIcon: {
    width: 28,
    padding: 4,  // Added padding for better touch area
  },
  sliderContainer: { 
    marginVertical: 10 
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  sliderMinLabel: {
    color: '#888',
    fontSize: 12
  },
  sliderMaxLabel: {
    color: '#888',
    fontSize: 12
  },
  sliderValue: { 
    textAlign: 'center', 
    fontSize: 15,
    fontWeight: '600',
    color: '#673AB7'
  },
  groupBlock: { 
    marginBottom: 4 
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  groupTitle: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#444'
  },
  chipGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginVertical: 8 
  },
  chip: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8, 
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  chipSelected: { 
    backgroundColor: '#FFE6F2',
    borderColor: '#e91e63'
  },
  chipText: { 
    color: '#555', 
    fontSize: 14
  },
  chipTextSelected: { 
    color: '#e91e63', 
    fontWeight: '600' 
  },
  checkmarkContainer: {
    backgroundColor: '#e91e63',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6
  },
  input: { 
    backgroundColor: '#F5F5F5', 
    borderRadius: 10, 
    padding: 12,
    paddingHorizontal: 16, 
    marginTop: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB'
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 16
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginVertical: 8
  },
  rowLabel: {
    fontSize: 15,
    color: '#444'
  },
  selectedContainer: {
    marginTop: 16
  },
  selectedTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ffb0d9'
  },
  selectedChipText: {
    fontSize: 14,
    color: '#e91e63',
    marginRight: 4,
    fontWeight: '500'
  },
  advancedLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8
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
    padding: 15, 
    borderRadius: 30, 
    marginRight: 10, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  resetBtnText: { 
    color: '#666', 
    fontWeight: '600',
    fontSize: 15
  },
  applyBtnContainer: {
    flex: 2,
  },
  applyBtn: { 
    borderRadius: 30, 
    overflow: 'hidden',
  },
  gradientBtn: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1
  },
  applyBtnIcon: {
    marginLeft: 8
  }
});

export default FilterScreen;