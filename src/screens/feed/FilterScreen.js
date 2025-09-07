import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Animated,
    useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/theme';
import { useFilters } from '../../context/FiltersContext';
import { ISRAEL_CITIES } from '../../constants/israeliCities';
import {
    createValidationError,
    handleError
} from '../../utils/errors';

const INSTRUMENTS = {
    Strings: ['Guitar', 'Bass guitar', 'Violin', 'Cello'],
    Percussion: ['Drums', 'Cajon', 'Bongos'],
    Keys: ['Piano', 'Synth'],
    Vocals: ['Lead Vocals', 'Backing Vocals'],
    Winds: ['Saxophone', 'Trumpet', 'Flute'],
};

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Pro'];
const GENRES = ['Rock', 'Jazz', 'Pop', 'Classical', 'Hip Hop', 'Electronic', 'R&B'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Other'];

const AGE_PRESETS = [
    { label: '18-25', min: 18, max: 25 },
    { label: '26-30', min: 26, max: 30 },
    { label: '31-35', min: 31, max: 35 },
    { label: '36-40', min: 36, max: 40 },
    { label: '41-50', min: 41, max: 50 },
    { label: '50+', min: 50, max: 65 },
];

// Modern selectable chip component with app colors
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

// Filter Card Component with app colors
const FilterCard = ({ title, icon, children, style = {} }) => {
    const isDark = useColorScheme() === 'dark';
    const cardColor = isDark ? '#2c2c2e' : '#fff';
    const textColor = isDark ? '#fff' : '#000';

    return (
        <View style={[styles.card, { backgroundColor: cardColor }, style]}>
            <View style={styles.cardHeader}>
                <Ionicons name={icon} size={24} color={COLORS.static.background} />
                <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
            </View>
            {children}
        </View>
    );
};

const FiltersScreen = () => {
    const isDark = useColorScheme() === 'dark';
    const backgroundColor = isDark ? '#1c1c1e' : '#f8f9fa';
    const textColor = isDark ? '#fff' : '#000';
    const navigation = useNavigation();
    const { filters, updateFilters, resetFilters: resetGlobalFilters } = useFilters();

    // Initialize local state from global filters
    const [selectedCities, setSelectedCities] = useState(filters.selectedCities || []);
    const [selectedInstruments, setSelectedInstruments] = useState(filters.selectedInstruments || {});
    const [selectedGenres, setSelectedGenres] = useState(filters.selectedGenres || []);
    const [selectedGenders, setSelectedGenders] = useState(filters.selectedGenders || []);
    const [customGenre, setCustomGenre] = useState('');
    const [minAge, setMinAge] = useState(filters.minAge || 18);
    const [maxAge, setMaxAge] = useState(filters.maxAge || 65);
    const [showCustomAge, setShowCustomAge] = useState(false);

    // City selection state
    const [showCityDropdown, setShowCityDropdown] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState('');

    // Track if filters have been modified from their initial state
    const [filtersModified, setFiltersModified] = useState(false);

    // Check if any filter has been modified from default values
    useEffect(() => {
        const isModified =
            selectedCities.length > 0 ||
            Object.keys(selectedInstruments).length > 0 ||
            selectedGenres.length > 0 ||
            selectedGenders.length > 0 ||
            minAge !== 18 ||
            maxAge !== 65;

        setFiltersModified(isModified);
    }, [
        selectedCities,
        selectedInstruments,
        selectedGenres,
        selectedGenders,
        minAge,
        maxAge
    ]);

    // Toggle function for multi-select arrays
    const toggleMulti = (arr, setArr, value) => {
        setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
    };

    // City selection functions
    const filteredCities = ISRAEL_CITIES.filter(city =>
        city.toLowerCase().includes(citySearchTerm.toLowerCase())
    );

    const toggleCity = (city) => {
        if (selectedCities.includes(city)) {
            setSelectedCities(selectedCities.filter(c => c !== city));
        } else {
            setSelectedCities([...selectedCities, city]);
        }
    };

    const clearAllCities = () => {
        setSelectedCities([]);
        setCitySearchTerm('');
    };

    // Instrument selection functions
    const toggleInstrument = (instrument) => {
        if (selectedInstruments[instrument]) {
            const updated = { ...selectedInstruments };
            delete updated[instrument];
            setSelectedInstruments(updated);
        } else {
            setSelectedInstruments({
                ...selectedInstruments,
                [instrument]: 'any'
            });
        }
    };

    const setSkillLevel = (instrument, skillLevel) => {
        setSelectedInstruments({
            ...selectedInstruments,
            [instrument]: skillLevel
        });
    };

    // Reset all filters to default values
    const resetFilters = () => {
        setSelectedCities([]);
        setSelectedInstruments({});
        setSelectedGenres([]);
        setSelectedGenders([]);
        setCustomGenre('');
        setMinAge(18);
        setMaxAge(65);
        setShowCustomAge(false);
        setShowCityDropdown(false);
        setCitySearchTerm('');

        // Reset global filters context
        resetGlobalFilters();
    };

    // Apply filters and navigate back to Discover with refresh
    const applyFilters = () => {
        const filterData = {
            selectedCities,
            selectedInstruments,
            selectedGenres,
            selectedGenders,
            minAge,
            maxAge
        };

        console.log('🎯 Applying filters:', filterData);

        // Update global filters context
        updateFilters(filterData);

        // Navigate back to Discover with refresh flag
        navigation.goBack();
    };

    // Handle adding custom genres with validation
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

    // Animation references for Apply button
    const scaleAnim = useRef(new Animated.Value(filtersModified ? 1 : 0.95)).current;
    const opacityAnim = useRef(new Animated.Value(filtersModified ? 1 : 0.5)).current;

    // Animate Apply button based on filter modification state
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
            {/* Header with back button and title */}
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
                {/* Location filtering section */}
                <FilterCard title="Location" icon="location-outline">
                    <TouchableOpacity
                        style={[styles.citySelectHeader, { backgroundColor: isDark ? '#3c3c3e' : '#F5F0FB' }]}
                        onPress={() => setShowCityDropdown(!showCityDropdown)}
                    >
                        <Text style={[styles.citySelectText, { color: isDark ? '#fff' : '#333' }]}>
                            {selectedCities.length === 0
                                ? 'Select cities (optional)'
                                : `${selectedCities.length} cities selected`}
                        </Text>
                        <Ionicons
                            name={showCityDropdown ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={isDark ? '#fff' : '#333'}
                        />
                    </TouchableOpacity>

                    {showCityDropdown && (
                        <View style={[styles.cityDropdown, { backgroundColor: isDark ? '#3c3c3e' : '#F5F0FB' }]}>
                            <TextInput
                                style={[styles.citySearchInput, {
                                    color: isDark ? '#fff' : '#333',
                                    backgroundColor: isDark ? '#2c2c2e' : '#fff'
                                }]}
                                placeholder="Search cities..."
                                placeholderTextColor="#9E9E9E"
                                value={citySearchTerm}
                                onChangeText={setCitySearchTerm}
                            />

                            {selectedCities.length > 0 && (
                                <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllCities}>
                                    <Text style={styles.clearAllText}>Clear All</Text>
                                </TouchableOpacity>
                            )}

                            <ScrollView style={styles.cityList} nestedScrollEnabled>
                                {filteredCities.map(city => (
                                    <TouchableOpacity
                                        key={city}
                                        style={[styles.cityItem, selectedCities.includes(city) && styles.cityItemSelected]}
                                        onPress={() => toggleCity(city)}
                                    >
                                        <Text style={[
                                            styles.cityItemText,
                                            { color: isDark ? '#fff' : '#333' },
                                            selectedCities.includes(city) && styles.cityItemTextSelected
                                        ]}>
                                            {city}
                                        </Text>
                                        {selectedCities.includes(city) && (
                                            <Ionicons name="checkmark" size={16} color={COLORS.static.background} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {selectedCities.length > 0 && (
                        <View style={styles.selectedContainer}>
                            <Text style={[styles.selectedTitle, { color: isDark ? '#fff' : '#333' }]}>Selected Cities:</Text>
                            <View style={styles.selectedChips}>
                                {selectedCities.map(city => (
                                    <View key={city} style={styles.selectedChip}>
                                        <Text style={styles.selectedChipText}>{city}</Text>
                                        <TouchableOpacity
                                            onPress={() => toggleCity(city)}
                                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                        >
                                            <Ionicons name="close-circle" size={16} color={COLORS.static.background} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </FilterCard>

                {/* Gender filtering section */}
                <FilterCard title="Gender" icon="people-outline">
                    <View style={styles.chipGrid}>
                        {GENDERS.map(gender => (
                            <SelectableChip
                                key={gender}
                                label={gender}
                                selected={selectedGenders.includes(gender)}
                                onSelect={() => toggleMulti(selectedGenders, setSelectedGenders, gender)}
                            />
                        ))}
                    </View>

                    {selectedGenders.length > 0 && (
                        <View style={styles.selectedContainer}>
                            <Text style={[styles.selectedTitle, { color: isDark ? '#fff' : '#333' }]}>Selected:</Text>
                            <View style={styles.selectedChips}>
                                {selectedGenders.map(gender => (
                                    <View key={gender} style={styles.selectedChip}>
                                        <Text style={styles.selectedChipText}>{gender}</Text>
                                        <TouchableOpacity
                                            onPress={() => setSelectedGenders(selectedGenders.filter(g => g !== gender))}
                                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                        >
                                            <Ionicons name="close-circle" size={16} color={COLORS.static.background} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </FilterCard>

                {/* Instruments with skill levels filtering section */}
                <FilterCard title="Instruments & Skill Level" icon="musical-notes-outline">
                    {Object.entries(INSTRUMENTS).map(([category, instruments]) => (
                        <View key={category}>
                            <Text style={[styles.categoryLabel, { color: textColor }]}>{category}</Text>
                            <View style={styles.instrumentContainer}>
                                {instruments.map(instrument => {
                                    const isSelected = selectedInstruments[instrument];
                                    const currentSkill = selectedInstruments[instrument] || 'any';

                                    return (
                                        <View key={instrument} style={styles.instrumentSkillGroup}>
                                            <SelectableChip
                                                label={instrument}
                                                selected={isSelected}
                                                onSelect={() => toggleInstrument(instrument)}
                                                style={styles.instrumentChip}
                                            />

                                            {isSelected && (
                                                <View style={styles.skillLevelContainer}>
                                                    <Text style={[styles.skillLabel, { color: textColor }]}>Level:</Text>
                                                    <View style={styles.skillChips}>
                                                        <SelectableChip
                                                            label="Any"
                                                            selected={currentSkill === 'any'}
                                                            onSelect={() => setSkillLevel(instrument, 'any')}
                                                            style={styles.skillChip}
                                                        />
                                                        {SKILL_LEVELS.map(level => (
                                                            <SelectableChip
                                                                key={level}
                                                                label={level}
                                                                selected={currentSkill === level}
                                                                onSelect={() => setSkillLevel(instrument, level)}
                                                                style={styles.skillChip}
                                                            />
                                                        ))}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </FilterCard>

                {/* Age range filtering section */}
                <FilterCard title="Age Range" icon="person-outline">
                    <View style={styles.agePresetsContainer}>
                        {AGE_PRESETS.map(preset => {
                            const isSelected = minAge === preset.min && maxAge === preset.max;
                            return (
                                <TouchableOpacity
                                    key={preset.label}
                                    style={[
                                        styles.agePresetChip,
                                        isSelected && styles.agePresetChipSelected
                                    ]}
                                    onPress={() => {
                                        if (isSelected) {
                                            // If already selected, deselect by setting to "Any Age" default
                                            setMinAge(18);
                                            setMaxAge(65);
                                        } else {
                                            // If not selected, apply this preset
                                            setMinAge(preset.min);
                                            setMaxAge(preset.max);
                                        }
                                        setShowCustomAge(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.agePresetText,
                                        isSelected && styles.agePresetTextSelected
                                    ]}>
                                        {preset.label}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.ageCheckmark}>
                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity
                            style={[
                                styles.agePresetChip,
                                styles.customAgeChip,
                                showCustomAge && styles.agePresetChipSelected
                            ]}
                            onPress={() => setShowCustomAge(!showCustomAge)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.agePresetText,
                                showCustomAge && styles.agePresetTextSelected
                            ]}>
                                Custom
                            </Text>
                            <Ionicons
                                name={showCustomAge ? "chevron-up" : "settings-outline"}
                                size={14}
                                color={showCustomAge ? "#fff" : "#666"}
                                style={{ marginLeft: 6 }}
                            />
                        </TouchableOpacity>
                    </View>

                    {showCustomAge && (
                        <View style={styles.customAgeContainer}>
                            <View style={styles.customAgeInputs}>
                                <View style={styles.ageInputContainer}>
                                    <Text style={[styles.ageLabel, { color: textColor }]}>Min</Text>
                                    <TextInput
                                        style={[styles.ageInput, {
                                            color: textColor,
                                            backgroundColor: isDark ? '#3c3c3e' : '#F5F0FB'
                                        }]}
                                        value={minAge.toString()}
                                        onChangeText={(text) => {
                                            const age = parseInt(text) || 18;
                                            if (age >= 18 && age <= 100) setMinAge(age);
                                        }}
                                        keyboardType="numeric"
                                        maxLength={2}
                                    />
                                </View>
                                <Text style={[styles.ageRangeText, { color: textColor }]}>to</Text>
                                <View style={styles.ageInputContainer}>
                                    <Text style={[styles.ageLabel, { color: textColor }]}>Max</Text>
                                    <TextInput
                                        style={[styles.ageInput, {
                                            color: textColor,
                                            backgroundColor: isDark ? '#3c3c3e' : '#F5F0FB'
                                        }]}
                                        value={maxAge.toString()}
                                        onChangeText={(text) => {
                                            const age = parseInt(text) || 65;
                                            if (age >= 18 && age <= 100) setMaxAge(age);
                                        }}
                                        keyboardType="numeric"
                                        maxLength={2}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    <View style={styles.ageDisplayContainer}>
                        <Text style={[styles.ageDisplay, { color: isDark ? '#aaa' : '#888' }]}>
                            Selected range: {minAge} - {maxAge} years
                        </Text>
                    </View>
                </FilterCard>

                {/* Genre filtering section */}
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

                    {/* Custom genre input */}
                    <TextInput
                        style={[styles.input, { color: textColor, backgroundColor: isDark ? '#3c3c3e' : '#F5F0FB' }]}
                        placeholder="Add custom genre..."
                        placeholderTextColor="#9E9E9E"
                        value={customGenre}
                        onChangeText={setCustomGenre}
                        onSubmitEditing={handleAddCustomGenre}
                    />

                    {/* Selected genres display with remove functionality */}
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
                                            <Ionicons name="close-circle" size={16} color={COLORS.static.background} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </FilterCard>

                {/* Action buttons - Reset and Apply */}
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
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: COLORS.static.primaryGradient[0],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: `${COLORS.static.background}20`,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginLeft: 12,
    },
    categoryLabel: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        marginTop: 12,
        color: COLORS.button.primary,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
        gap: 8,
    },
    chip: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 30,
        backgroundColor: COLORS.button.tertiary,
        marginRight: 8,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: COLORS.static.primaryGradient[0],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    chipSelected: {
        backgroundColor: COLORS.button.primary,
        borderColor: COLORS.static.primaryGradient[1],
        shadowOpacity: 0.3,
        elevation: 4,
    },
    chipText: {
        color: COLORS.button.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: '#fff',
        fontWeight: '700'
    },
    checkmarkContainer: {
        backgroundColor: COLORS.static.primaryGradient[1],
        borderRadius: 12,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        shadowColor: COLORS.static.primaryGradient[1],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    input: {
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}40`,
        marginTop: 16,
        fontWeight: '500',
    },
    selectedContainer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: `${COLORS.button.primary}10`,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: `${COLORS.button.primary}30`,
    },
    selectedTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        color: COLORS.button.primary,
    },
    selectedChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.button.primary,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 25,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: COLORS.static.primaryGradient[1],
        shadowColor: COLORS.button.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    selectedChipText: {
        fontSize: 14,
        color: '#fff',
        marginRight: 8,
        fontWeight: '600'
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 32,
        marginBottom: 40,
        gap: 16,
    },
    resetBtn: {
        flex: 1,
        backgroundColor: COLORS.button.tertiary,
        padding: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}40`,
        shadowColor: COLORS.button.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    resetBtnText: {
        color: COLORS.button.primary,
        fontWeight: '700',
        fontSize: 16
    },
    applyBtnContainer: {
        flex: 2,
    },
    applyBtn: {
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: COLORS.static.primaryGradient[0],
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    gradientBtn: {
        padding: 18,
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
    },

    // City selection styles
    citySelectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}30`,
        marginVertical: 8
    },
    citySelectText: {
        fontSize: 16,
        fontWeight: '600',
    },
    cityDropdown: {
        borderRadius: 16,
        marginTop: 12,
        maxHeight: 300,
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}30`,
        overflow: 'hidden',
    },
    citySearchInput: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: `${COLORS.button.primary}30`,
        fontSize: 16,
        fontWeight: '500',
    },
    clearAllBtn: {
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: `${COLORS.button.primary}30`,
    },
    clearAllText: {
        color: COLORS.static.background,
        fontWeight: '700',
        fontSize: 14,
    },
    cityList: {
        maxHeight: 200,
    },
    cityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: `${COLORS.button.primary}20`,
    },
    cityItemSelected: {
        backgroundColor: `${COLORS.button.primary}20`,
    },
    cityItemText: {
        fontSize: 15,
        fontWeight: '600',
    },
    cityItemTextSelected: {
        color: COLORS.button.primary,
        fontWeight: '700',
    },

    // Instrument & skill selection styles
    instrumentContainer: {
        marginBottom: 20,
    },
    instrumentSkillGroup: {
        marginBottom: 20,
    },
    instrumentChip: {
        marginBottom: 12,
    },
    skillLevelContainer: {
        marginLeft: 20,
        marginTop: 12,
        padding: 16,
        backgroundColor: `${COLORS.static.primaryGradient[1]}15`,
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.static.primaryGradient[1],
    },
    skillLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        color: COLORS.static.primaryGradient[1],
    },
    skillChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    skillChip: {
        marginRight: 8,
        marginBottom: 8,
    },

    // Age range styles with preset chips
    agePresetsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginVertical: 16,
    },
    agePresetChip: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        backgroundColor: COLORS.button.tertiary,
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}30`,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: COLORS.button.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        minWidth: 70,
        justifyContent: 'center',
    },
    agePresetChipSelected: {
        backgroundColor: COLORS.button.primary,
        borderColor: COLORS.static.primaryGradient[1],
        shadowOpacity: 0.3,
        elevation: 4,
    },
    agePresetText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.button.textSecondary,
    },
    agePresetTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    ageCheckmark: {
        backgroundColor: COLORS.static.primaryGradient[1],
        borderRadius: 10,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
    },
    customAgeContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: `${COLORS.static.primaryGradient[1]}10`,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: `${COLORS.static.primaryGradient[1]}30`,
    },
    customAgeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ageInputContainer: {
        alignItems: 'center',
        flex: 1,
    },
    ageLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        color: COLORS.button.primary,
    },
    ageInput: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: `${COLORS.button.primary}30`,
        fontSize: 16,
        textAlign: 'center',
        minWidth: 70,
        fontWeight: '700',
    },
    ageRangeText: {
        fontSize: 18,
        fontWeight: '700',
        marginHorizontal: 20,
        color: COLORS.static.primaryGradient[1],
    },
    ageDisplayContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
    ageDisplay: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default FiltersScreen;