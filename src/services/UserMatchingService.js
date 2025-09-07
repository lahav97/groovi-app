import { handleError } from '../utils/errors';
import { createLogger } from '../utils/Logger';

const logger = createLogger('UserMatchingService');

// Configuration constants
const API_CONFIG = {
    BASE_URL: 'https://g25kk1qcgi.execute-api.us-east-1.amazonaws.com/groovi/match',
    DEFAULT_BATCH_SIZE: 5,
    LOAD_MORE_BATCH_SIZE: 3,
    REQUEST_TIMEOUT: 10000,
    MAX_RETRY_ATTEMPTS: 2
};

const ENDPOINTS = {
    INITIAL: 'initial',
    FILTERED: 'filter'
};

/**
 * Ensures all users have valid profile pictures with fallback generation
 * @param {Array} users - Array of user objects
 * @returns {Promise<Array>} Users with guaranteed profile pictures
 */
const ensureProfilePictureIntegrity = async (users) => {
    if (!Array.isArray(users)) {
        logger.warn('Invalid users array provided to profile picture processor');
        return [];
    }

    const processUserProfilePicture = async (user) => {
        const existingPicture = user.profile_picture || user.profilePicture;

        if (existingPicture && typeof existingPicture === 'string' && existingPicture.startsWith('http')) {
            return existingPicture;
        }

        // Generate deterministic fallback based on username
        const fallbackSeed = Math.abs(user.username?.charCodeAt(0) || 1) % 70 + 1;
        const fallbackUrl = `https://i.pravatar.cc/150?img=${fallbackSeed}`;

        return fallbackUrl;
    };

    try {
        const processedUsers = await Promise.all(
            users.map(async (user) => {
                const profilePicture = await processUserProfilePicture(user);
                return {
                    ...user,
                    profilePicture,
                    profile_picture: profilePicture
                };
            })
        );

        logger.info(`Processed profile pictures for ${processedUsers.length} users`);
        return processedUsers;

    } catch (error) {
        logger.error('Failed to process user profile pictures', { error: error.message });
        throw error;
    }
};

/**
 * Transforms filter criteria from FilterScreen format to lambda-compatible format
 * @param {Object} filters - Client-side filter object from FilterScreen
 * @returns {Object} Lambda-compatible filter object
 */
const transformFiltersForAPI = (filters) => {
    if (!filters || typeof filters !== 'object') {
        logger.debug('No filters provided, returning empty filter object');
        return {};
    }

    const apiFilters = {};

    // Transform selectedCities array to address array (lambda expects address field)
    if (filters.selectedCities?.length > 0) {
        apiFilters.address = filters.selectedCities;
        logger.debug(`Transformed ${filters.selectedCities.length} city filters to address parameter`);
    }

    // Transform selectedInstruments object to instruments object (lambda format)
    // FilterScreen now sends: {"Guitar": "Intermediate", "Piano": "any"}
    if (filters.selectedInstruments && Object.keys(filters.selectedInstruments).length > 0) {
        apiFilters.instruments = filters.selectedInstruments;
        logger.debug(`Applied ${Object.keys(filters.selectedInstruments).length} instrument filters with skill levels`);
    }

    // Transform selectedGenres array to genres array (lambda format)
    if (filters.selectedGenres?.length > 0) {
        apiFilters.genres = filters.selectedGenres;
        logger.debug(`Applied ${filters.selectedGenres.length} genre filters`);
    }

    // Transform selectedGenders array to gender array (lambda format)
    if (filters.selectedGenders?.length > 0) {
        apiFilters.gender = filters.selectedGenders;
        logger.debug(`Applied ${filters.selectedGenders.length} gender filters`);
    }

    // Age range filtering (lambda expects min_age and max_age)
    if (filters.minAge && filters.minAge > 18) {
        apiFilters.min_age = filters.minAge;
    }
    if (filters.maxAge && filters.maxAge < 65) {
        apiFilters.max_age = filters.maxAge;
    }

    logger.debug('Filter transformation complete', {
        inputFilters: Object.keys(filters),
        outputFilters: Object.keys(apiFilters),
        details: {
            cities: apiFilters.address?.length || 0,
            instruments: Object.keys(apiFilters.instruments || {}).length,
            genres: apiFilters.genres?.length || 0,
            genders: apiFilters.gender?.length || 0,
            ageRange: `${apiFilters.min_age || 18}-${apiFilters.max_age || 65}`
        }
    });

    return apiFilters;
};

/**
 * Executes HTTP request to matching API with error handling and timeout
 * @param {string} endpoint - API endpoint type
 * @param {Object|null} requestBody - Request payload for filtered requests
 * @param {string} username - Username for initial requests
 * @returns {Promise<Array>} Array of user objects
 */
const executeMatchingAPIRequest = async (endpoint, requestBody = null, username = '') => {
    let url = `${API_CONFIG.BASE_URL}?type=${endpoint}`;

    let requestOptions;

    if (endpoint === 'initial') {
        // Initial requests: GET with username in query parameter
        if (username) {
            url += `&username=${encodeURIComponent(username)}`;
        }
        requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };
    } else if (endpoint === 'filter') {
        // Filter requests: POST with JSON body (only way to send body in JavaScript)
        requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        };
    }

    logger.info(`Executing API request to ${endpoint} endpoint`, {
        method: requestOptions.method,
        url: url,
        requestBody: endpoint === 'filter' ? requestBody : null
    });

    try {
        const response = await Promise.race([
            fetch(url, requestOptions),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), API_CONFIG.REQUEST_TIMEOUT)
            )
        ]);

        if (!response.ok) {
            const errorMessage = `API request failed: ${response.status} ${response.statusText}`;
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            const errorMessage = 'Invalid API response format: expected user array';
            logger.error(errorMessage, { responseType: typeof data });
            throw new Error(errorMessage);
        }

        // Map video_urls to videos for compatibility
        const processedData = data.map(user => ({
            ...user,
            videos: user.video_urls || user.videos || [],
            video_urls: undefined // Remove the original field
        }));

        logger.info(`API request successful: received ${processedData.length} users`);
        return processedData;

    } catch (error) {
        logger.error('API request failed', {
            endpoint,
            method: requestOptions.method,
            error: error.message,
            url: url
        });
        throw error;
    }
};

/**
 * Fetches initial set of users without any filtering applied
 * @param {string} currentUserEmail - Email/identifier of current user to exclude
 * @param {number} batchSize - Number of users to fetch
 * @returns {Promise<Array>} Array of user objects with profile pictures
 */
export const fetchInitialMatches = async (currentUserEmail, batchSize = API_CONFIG.DEFAULT_BATCH_SIZE) => {
    logger.info('Fetching initial user matches', { currentUserEmail, batchSize });

    try {
        const users = await executeMatchingAPIRequest(ENDPOINTS.INITIAL, null, currentUserEmail);

        // Ensure profile picture integrity
        const usersWithProfilePictures = await ensureProfilePictureIntegrity(users);

        // Return requested batch size
        const result = usersWithProfilePictures.slice(0, batchSize);

        logger.info(`Successfully fetched ${result.length} initial matches`);
        return result;

    } catch (error) {
        logger.error('Failed to fetch initial matches', { error: error.message });
        throw new Error(handleError(error, 'UserMatchingService.fetchInitialMatches'));
    }
};

/**
 * Fetches users with applied filter criteria from FilterScreen
 * @param {string} currentUserEmail - Email/identifier of current user to exclude
 * @param {Object} filters - Filter criteria object from FilterScreen
 * @param {number} batchSize - Number of users to fetch
 * @returns {Promise<Array>} Array of filtered user objects with profile pictures
 */
export const fetchFilteredMatches = async (currentUserEmail, filters, batchSize = API_CONFIG.DEFAULT_BATCH_SIZE) => {
    logger.info('Fetching filtered user matches', {
        currentUserEmail,
        batchSize,
        filterKeys: Object.keys(filters || {})
    });

    try {
        const apiFilters = transformFiltersForAPI(filters);
        const requestBody = {
            username: currentUserEmail,
            ...apiFilters
        };

        logger.debug('Sending filter request to lambda', { requestBody });

        const users = await executeMatchingAPIRequest(ENDPOINTS.FILTERED, requestBody);

        if (users.length === 0) {
            logger.info('No users match the specified filter criteria');
            return [];
        }

        // Ensure profile picture integrity
        const usersWithProfilePictures = await ensureProfilePictureIntegrity(users);

        // Return requested batch size
        const result = usersWithProfilePictures.slice(0, batchSize);

        logger.info(`Successfully fetched ${result.length} filtered matches`);
        return result;

    } catch (error) {
        logger.error('Failed to fetch filtered matches', { error: error.message });
        throw new Error(handleError(error, 'UserMatchingService.fetchFilteredMatches'));
    }
};

/**
 * Loads additional users for pagination (with or without filters)
 * @param {string} currentUserEmail - Email/identifier of current user to exclude
 * @param {number} batchSize - Number of additional users to fetch
 * @param {Object|null} locationOptions - Location-based filtering options (not currently used)
 * @param {Object|null} filters - Filter criteria object from FilterScreen
 * @returns {Promise<Array>} Array of additional user objects
 */
export const loadAdditionalMatches = async (
    currentUserEmail,
    batchSize = API_CONFIG.LOAD_MORE_BATCH_SIZE,
    locationOptions = null,
    filters = null
) => {
    logger.info('Loading additional user matches', {
        currentUserEmail,
        batchSize,
        hasFilters: !!filters,
        hasLocation: !!locationOptions
    });

    try {
        const hasActiveFilters = detectActiveFilters(filters);

        if (hasActiveFilters) {
            logger.debug('Loading additional matches with filters applied');
            return await fetchFilteredMatches(currentUserEmail, filters, batchSize);
        } else {
            logger.debug('Loading additional matches without filters');
            return await fetchInitialMatches(currentUserEmail, batchSize);
        }

    } catch (error) {
        logger.error('Failed to load additional matches', { error: error.message });
        // Return empty array instead of throwing to prevent UI crashes during pagination
        return [];
    }
};

/**
 * Determines if any meaningful filters are currently active
 * @param {Object|null} filters - Filter criteria object from FilterScreen
 * @returns {boolean} True if filters are active, false otherwise
 */
export const detectActiveFilters = (filters) => {
    if (!filters || typeof filters !== 'object') {
        return false;
    }

    const activeConditions = [
        filters.selectedCities?.length > 0,
        filters.selectedInstruments && Object.keys(filters.selectedInstruments).length > 0,
        filters.selectedGenres?.length > 0,
        filters.selectedGenders?.length > 0,
        filters.minAge && filters.minAge > 18,
        filters.maxAge && filters.maxAge < 65
    ];

    const isActive = activeConditions.some(condition => condition === true);

    logger.debug('Filter detection result', {
        isActive,
        filterKeys: Object.keys(filters),
        details: {
            cities: filters.selectedCities?.length || 0,
            instruments: Object.keys(filters.selectedInstruments || {}).length,
            genres: filters.selectedGenres?.length || 0,
            genders: filters.selectedGenders?.length || 0,
            minAge: filters.minAge || 18,
            maxAge: filters.maxAge || 65
        }
    });

    return isActive;
};

/**
 * Validates user matching service configuration
 * @returns {boolean} True if configuration is valid
 */
export const validateServiceConfiguration = () => {
    const requiredConfig = [
        API_CONFIG.BASE_URL,
        API_CONFIG.DEFAULT_BATCH_SIZE,
        API_CONFIG.REQUEST_TIMEOUT
    ];

    const isValid = requiredConfig.every(config => config !== undefined && config !== null);

    if (!isValid) {
        logger.error('Invalid service configuration detected');
    } else {
        logger.debug('Service configuration validated successfully');
    }

    return isValid;
};

/**
 * Gets a summary of active filters for logging/debugging
 * @param {Object} filters - Filter criteria object
 * @returns {Object} Summary of active filters
 */
export const getActiveFilterSummary = (filters) => {
    if (!detectActiveFilters(filters)) {
        return { hasFilters: false, summary: 'No active filters' };
    }

    const summary = {
        hasFilters: true,
        cities: filters.selectedCities?.length || 0,
        instruments: Object.keys(filters.selectedInstruments || {}).length,
        genres: filters.selectedGenres?.length || 0,
        genders: filters.selectedGenders?.length || 0,
        ageRange: {
            min: filters.minAge || 18,
            max: filters.maxAge || 65
        }
    };

    return summary;
};

// Service interface object for clean imports
const UserMatchingService = {
    fetchInitialMatches,
    fetchFilteredMatches,
    loadAdditionalMatches,
    detectActiveFilters,
    validateServiceConfiguration,
    getActiveFilterSummary
};

export default UserMatchingService;