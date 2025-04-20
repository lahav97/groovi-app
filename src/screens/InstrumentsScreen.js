import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  UIManager,
  LayoutAnimation,
  Platform,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSignupBuilder } from '../context/SignupFlowContext';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const instrumentCategories = {
  '🎸 Strings 🎸': ['Electric Guitar', 'Acoustic Guitar', 'Bass Guitar', 'Violin', 'Cello', 'Banjo', 'Mandolin'],
  '🥁 Drums 🥁': ['Drums', 'Cajón', 'Bongos', 'Percussion'],
  '🎹 Keys 🎹': ['Keyboard', 'Piano', 'Synthesizer', 'Organ', 'MIDI Controller'],
  '🎤 Vocals 🎤': ['Lead Vocals', 'Backing Vocals', 'Rapper', 'Beatbox'],
  '🎷 Winds 🎷': ['Saxophone', 'Trumpet', 'Clarinet', 'Flute', 'Oboe', 'Harmonica'],
  '🎶 Other 🎶': ['DJ Controller', 'Sampler', 'Loop Pedal', 'FX Pad', 'Other'],
};

const skillLevels = ['Beginner', 'Intermediate', 'Pro'];

const InstrumentsScreen = () => {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? '#1c1c1e' : '#fff';
  const textColor = isDark ? '#fff' : '#000';

  const builder = useSignupBuilder();
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [instrumentLevels, setInstrumentLevels] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleInstrument = (instrument) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (selectedInstruments.includes(instrument)) {
      setSelectedInstruments((prev) => prev.filter((i) => i !== instrument));
      setInstrumentLevels((prev) => {
        const newLevels = { ...prev };
        delete newLevels[instrument];
        return newLevels;
      });
    } else {
      setSelectedInstruments((prev) => [...prev, instrument]);
      setInstrumentLevels((prev) => ({ ...prev, [instrument]: 'Intermediate' }));
    }
  };

  const handleLevelChange = (instrument, level) => {
    setInstrumentLevels((prev) => ({ ...prev, [instrument]: level }));
  };

  const toggleCategory = (category) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleContinue = () => {
    if (Object.keys(instrumentLevels).length == 0) {
      Alert.alert('Please select at least one instrument and its level.');
      return;
    }

    builder.setInstruments(instrumentLevels);
    navigation.navigate('Profile Setup');
  };

  const allInstruments = Object.values(instrumentCategories).flat().filter(i => i !== 'Other');
  const filteredFlatList = allInstruments.filter((instr) =>
    instr.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryStyle = (category, instruments) => {
    const isSelected = instruments.some(i => selectedInstruments.includes(i));
    return isSelected ? [styles.categoryTitle, { color: '#e91e63' }] : [styles.categoryTitle, { color: textColor }];
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Instruments</Text>
        <View style={{ width: 28 }} />
      </View>

      <TextInput
        placeholder="Search"
        placeholderTextColor="#aaa"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchInput, { color: isDark ? '#000' : textColor }]}
        />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {searchQuery.length > 0 ? (
          filteredFlatList.length > 0 ? (
            filteredFlatList.map((instrument) => (
              <View key={instrument}>
                <TouchableOpacity
                  onPress={() => toggleInstrument(instrument)}
                  style={styles.checkboxRow}
                >
                  <Ionicons
                    name={selectedInstruments.includes(instrument) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={selectedInstruments.includes(instrument) ? '#e91e63' : '#999'}
                  />
                  <Text style={[styles.instrumentLabel, { color: textColor }]}>{instrument}</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.notFoundText, { color: textColor }]}>No instruments found.</Text>
          )
        ) : (
          Object.entries(instrumentCategories).map(([category, instruments]) => (
            <View key={category} style={styles.categoryBlock}>
              <TouchableOpacity
                onPress={() => toggleCategory(category)}
                style={styles.categoryHeader}
              >
                <Text style={getCategoryStyle(category, instruments)}>{category}</Text>
                <Ionicons
                  name={expandedCategories[category] ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={textColor}
                />
              </TouchableOpacity>

              {expandedCategories[category] && instruments.map((instrument) => (
                <View key={instrument}>
                  <TouchableOpacity
                    onPress={() => toggleInstrument(instrument)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={selectedInstruments.includes(instrument) ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={selectedInstruments.includes(instrument) ? '#e91e63' : '#999'}
                    />
                    <Text style={[styles.instrumentLabel, { color: textColor }]}>{instrument}</Text>
                  </TouchableOpacity>

                  {selectedInstruments.includes(instrument) && (
                    <View style={styles.levelRow}>
                      {skillLevels.map((level) => {
                        const isSelected = instrumentLevels[instrument] === level;
                        const gradientColors =
                          level === 'Beginner' ? ['#a1c4fd', '#c2e9fb'] :
                          level === 'Intermediate' ? ['#f6d365', '#fda085'] :
                          ['#ff6ec4', '#ffc93c', '#1c92d2'];

                        return (
                          <TouchableOpacity
                            key={level}
                            onPress={() => handleLevelChange(instrument, level)}
                            style={styles.levelWrapper}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={gradientColors}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.levelGradient}
                              >
                                <Text style={styles.levelTextSelected}>{level}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.levelUnselected}>
                                <Text style={[styles.levelText, { color: isDark ? '#1a1a1a' : '#333', fontWeight: 'bold' }]}>{level}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))
        )}

        {selectedInstruments.length > 0 && (
          <View style={styles.selectedPreview}>
            <Text style={[styles.selectedTitle, { color: textColor }]}>Selected Instruments:</Text>
            <Text style={[styles.selectedItem, { color: textColor }]}>
              {selectedInstruments.join(', ')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          disabled={selectedInstruments.length === 0}
          onPress={handleContinue}
          style={[styles.continueButton, selectedInstruments.length === 0 && styles.disabledButton]}
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', alignSelf: 'center' },
  searchInput: {
    backgroundColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  scrollContainer: { paddingBottom: 60 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backIcon: {
    width: 28,
  },
  instrumentLabel: { marginLeft: 12, fontSize: 16 },
  continueButton: {
    marginTop: 2,
    marginBottom: 40,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  gradient: {
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
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingLeft: 36,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  levelWrapper: {
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 6,
  },
  levelGradient: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelUnselected: {
    backgroundColor: '#eee',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: {
    fontSize: 13,
  },
  levelTextSelected: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  categoryBlock: { marginBottom: 12 },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  categoryTitle: { fontSize: 18, fontWeight: 'bold' },
  notFoundText: {
    fontSize: 16,
    fontStyle: 'italic',
    paddingTop: 10,
    paddingLeft: 8,
  },
  selectedPreview: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
  },
  selectedTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  selectedItem: {
    fontSize: 15,
  },
});

export default InstrumentsScreen;
