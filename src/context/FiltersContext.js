// src/context/FiltersContext.js
import React, { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();

export const useFilters = () => {
    const context = useContext(FiltersContext);
    if (!context) {
        throw new Error('useFilters must be used within a FiltersProvider');
    }
    return context;
};

export const FiltersProvider = ({ children }) => {
    const [filters, setFilters] = useState({
        distance: 10,
        anywhere: false,
        selectedInstruments: [],
        selectedSkill: [],
        selectedGenres: [],
        selectedGender: 'Any',
        isActive: false // Track if any filters are applied
    });

    const updateFilters = (newFilters) => {
        const isActive =
            newFilters.distance !== 10 ||
            newFilters.anywhere !== false ||
            newFilters.selectedInstruments.length > 0 ||
            newFilters.selectedSkill.length > 0 ||
            newFilters.selectedGenres.length > 0 ||
            newFilters.selectedGender !== 'Any';

        const updatedFilters = {
            ...newFilters,
            isActive
        };

        console.log('🎯 Filters updated:', updatedFilters);
        setFilters(updatedFilters);
    };

    const resetFilters = () => {
        const defaultFilters = {
            distance: 10,
            anywhere: false,
            selectedInstruments: [],
            selectedSkill: [],
            selectedGenres: [],
            selectedGender: 'Any',
            isActive: false
        };

        console.log('🔄 Filters reset to defaults');
        setFilters(defaultFilters);
    };

    return (
        <FiltersContext.Provider value={{ filters, updateFilters, resetFilters }}>
            {children}
        </FiltersContext.Provider>
    );
};