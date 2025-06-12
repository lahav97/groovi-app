/**
 * @file errors.js
 * Centralized error system for Groovi app
 * Provides consistent error handling across all screens and services
 */

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base error class for all custom errors in the app
 * Allows catching all custom errors with instanceof AppError
 */
export class AppError extends Error {
    constructor(message, userMessage = null, details = null) {
      super(message);
      this.name = this.constructor.name;
      this.userMessage = userMessage || message; // User-friendly message for UI
      this.details = details; // Additional error context
      this.timestamp = new Date().toISOString();
      
      // Capture stack trace if available
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  
    /**
     * Get the message that should be shown to users
     * @returns {string} User-friendly error message
     */
    getUserMessage() {
      return this.userMessage;
    }
  
    /**
     * Get error details for debugging
     * @returns {Object} Error details object
     */
    getDetails() {
      return {
        name: this.name,
        message: this.message,
        userMessage: this.userMessage,
        details: this.details,
        timestamp: this.timestamp
      };
    }
  }
  
  // ============================================================================
  // SPECIFIC ERROR TYPES
  // ============================================================================
  
  /**
   * ValidationError - For user input validation failures
   * Used in: SignUpScreen, ProfileSetupScreen, FilterScreen, etc.
   */
  export class ValidationError extends AppError {
    constructor(message, userMessage = null, field = null) {
      super(message, userMessage, { field });
      this.field = field; // Which field caused the validation error
    }
  }
  
  /**
   * NetworkError - For API communication issues
   * Used in: videoService, searchUsers, discoveryAPI, etc.
   */
  export class NetworkError extends AppError {
    constructor(message, userMessage = null, statusCode = null, endpoint = null) {
      super(message, userMessage, { statusCode, endpoint });
      this.statusCode = statusCode;
      this.endpoint = endpoint;
    }
  }
  
  /**
   * PermissionError - For device permission denials
   * Used in: Video upload, camera access, location access, etc.
   */
  export class PermissionError extends AppError {
    constructor(message, userMessage = null, permissionType = null) {
      super(message, userMessage, { permissionType });
      this.permissionType = permissionType; // 'camera', 'media', 'location', etc.
    }
  }
  
  /**
   * AuthError - For authentication/authorization issues
   * Used in: Login flows, AWS Cognito, token management, etc.
   */
  export class AuthError extends AppError {
    constructor(message, userMessage = null, authCode = null) {
      super(message, userMessage, { authCode });
      this.authCode = authCode; // AWS Cognito error codes
    }
  }
  
  // ============================================================================
  // ERROR CONSTANTS
  // ============================================================================
  
  /**
   * Predefined error messages for consistency across the app
   */
  export const ERROR_MESSAGES = {
    // Validation errors
    VALIDATION: {
      EMAIL_INVALID: 'Please enter a valid email address',
      EMAIL_EXISTS: 'This email is already registered',
      PASSWORD_WEAK: 'Password must contain at least 1 capital letter and 1 number',
      REQUIRED_FIELD: 'This field is required',
      AGE_RESTRICTION: 'You must be at least 13 years old to sign up',
      USERNAME_REQUIRED: 'Please enter a username',
      FULLNAME_REQUIRED: 'Please enter your full name',
      DATE_INVALID: 'Please enter a valid date',
      VIDEO_TOO_LARGE: 'Video must be under {size}MB',
      VIDEO_TOO_LONG: 'Video must be under {duration} seconds',
      VIDEO_INVALID_FORMAT: 'Invalid video format',
      PHONE_INVALID: 'Please enter a valid phone number',
    },
  
    // Network errors
    NETWORK: {
      CONNECTION_ERROR: 'Check your internet connection and try again',
      SERVER_ERROR: 'Server error. Please try again later',
      REQUEST_TIMEOUT: 'Request timed out. Please try again',
      API_ERROR: 'Unable to connect to server. Please try again',
      UPLOAD_FAILED: 'Upload failed. Please try again',
      SEARCH_FAILED: 'Search failed. Please try again',
      LOAD_FAILED: 'Failed to load content. Please try again',
      NO_MUSICIANS: 'No musicians found',
      NO_SEARCH_RESULTS: 'No users found',
    },
  
    // Permission errors
    PERMISSION: {
      CAMERA_DENIED: 'Camera access is required to record videos. Please enable it in Settings',
      MEDIA_DENIED: 'Media library access is required to select videos. Please enable it in Settings',
      LOCATION_DENIED: 'Location access helps us find musicians near you. Please enable it in Settings',
      MICROPHONE_DENIED: 'Microphone access is required for video recording. Please enable it in Settings',
      SETTINGS_PROMPT: 'Go to Settings > Privacy > {permission} and enable access for Groovi',
    },
  
    // Auth errors
    AUTH: {
      INVALID_CREDENTIALS: 'Invalid email or password',
      USER_NOT_FOUND: 'Account not found. Please check your email',
      WRONG_PASSWORD: 'Incorrect password. Please try again',
      EMAIL_NOT_VERIFIED: 'Please verify your email before signing in',
      CODE_EXPIRED: 'Verification code has expired. Please request a new one',
      CODE_INVALID: 'Invalid verification code. Please try again',
      SIGNUP_FAILED: 'Failed to create account. Please try again',
      SIGNIN_FAILED: 'Failed to sign in. Please try again',
      SESSION_EXPIRED: 'Your session has expired. Please sign in again',
      ACCOUNT_DISABLED: 'Your account has been disabled. Please contact support',
    },
  
    // General errors
    GENERAL: {
      UNKNOWN_ERROR: 'Something went wrong. Please try again',
      TRY_AGAIN: 'Please try again',
      CONTACT_SUPPORT: 'Please contact support if this problem continues',
    },
  };
  
  // ============================================================================
  // ERROR FACTORY FUNCTIONS
  // ============================================================================
  
  /**
   * Creates validation errors with consistent formatting
   */
  export const createValidationError = (type, field = null, params = {}) => {
    let message = ERROR_MESSAGES.VALIDATION[type] || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR;
    
    // Replace parameters in message (e.g., {size}, {duration})
    Object.keys(params).forEach(key => {
      message = message.replace(`{${key}}`, params[key]);
    });
    
    return new ValidationError(
      `Validation failed: ${type}`,
      message,
      field
    );
  };
  
  /**
   * Creates network errors with status code and endpoint info
   */
  export const createNetworkError = (type, statusCode = null, endpoint = null) => {
    const message = ERROR_MESSAGES.NETWORK[type] || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR;
    
    return new NetworkError(
      `Network error: ${type} (${statusCode})`,
      message,
      statusCode,
      endpoint
    );
  };
  
  /**
   * Creates permission errors with specific permission type
   */
  export const createPermissionError = (permissionType) => {
    const typeKey = permissionType.toUpperCase() + '_DENIED';
    const message = ERROR_MESSAGES.PERMISSION[typeKey] || ERROR_MESSAGES.PERMISSION.SETTINGS_PROMPT.replace('{permission}', permissionType);
    
    return new PermissionError(
      `Permission denied: ${permissionType}`,
      message,
      permissionType
    );
  };
  
  /**
   * Creates auth errors with AWS Cognito error code mapping
   */
  export const createAuthError = (cognitoCode, customMessage = null) => {
    let message = customMessage;
    
    // Map AWS Cognito error codes to user-friendly messages
    switch (cognitoCode) {
      case 'UserNotFoundException':
        message = ERROR_MESSAGES.AUTH.USER_NOT_FOUND;
        break;
      case 'NotAuthorizedException':
        message = ERROR_MESSAGES.AUTH.WRONG_PASSWORD;
        break;
      case 'UserNotConfirmedException':
        message = ERROR_MESSAGES.AUTH.EMAIL_NOT_VERIFIED;
        break;
      case 'CodeMismatchException':
        message = ERROR_MESSAGES.AUTH.CODE_INVALID;
        break;
      case 'ExpiredCodeException':
        message = ERROR_MESSAGES.AUTH.CODE_EXPIRED;
        break;
      case 'InvalidParameterException':
        message = ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS;
        break;
      case 'UserDisabledException':
        message = ERROR_MESSAGES.AUTH.ACCOUNT_DISABLED;
        break;
      default:
        message = message || ERROR_MESSAGES.AUTH.SIGNIN_FAILED;
    }
    
    return new AuthError(
      `Auth error: ${cognitoCode}`,
      message,
      cognitoCode
    );
  };
  
  // ============================================================================
  // ERROR HANDLER UTILITIES
  // ============================================================================
  
  /**
   * Global error handler for consistent error processing
   * @param {Error} error - The error to handle
   * @param {string} context - Where the error occurred (for logging)
   * @returns {string} User-friendly error message
   */
  export const handleError = (error, context = 'Unknown') => {
    // Log error for debugging (you can integrate with crash reporting here)
    console.error(`[${context}] Error:`, error);
    
    // Return user-friendly message
    if (error instanceof AppError) {
      return error.getUserMessage();
    }
    
    // Handle common React Native/JavaScript errors
    if (error.name === 'TypeError') {
      return ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR;
    }
    
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return ERROR_MESSAGES.NETWORK.CONNECTION_ERROR;
    }
    
    // Fallback for unknown errors
    return error.message || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR;
  };
  
  /**
   * Checks if an error is retryable (network issues, temporary failures)
   * @param {Error} error - The error to check
   * @returns {boolean} True if the operation should be retried
   */
  export const isRetryableError = (error) => {
    if (error instanceof NetworkError) {
      // Retry on network issues but not on client errors (4xx)
      return !error.statusCode || error.statusCode >= 500;
    }
    
    if (error instanceof AuthError) {
      // Don't retry on auth errors (user needs to fix credentials)
      return false;
    }
    
    if (error instanceof ValidationError) {
      // Don't retry on validation errors (user needs to fix input)
      return false;
    }
    
    if (error instanceof PermissionError) {
      // Don't retry on permission errors (user needs to grant permissions)
      return false;
    }
    
    // Retry on unknown errors
    return true;
  };
  
  /**
   * Creates error objects from HTTP responses
   * @param {Response} response - Fetch API response object
   * @param {string} endpoint - API endpoint that failed
   * @returns {NetworkError} Appropriate network error
   */
  export const createErrorFromResponse = async (response, endpoint = 'Unknown') => {
    let errorType = 'API_ERROR';
    
    if (response.status >= 500) {
      errorType = 'SERVER_ERROR';
    } else if (response.status === 404) {
      errorType = 'LOAD_FAILED';
    } else if (response.status === 408) {
      errorType = 'REQUEST_TIMEOUT';
    }
    
    return createNetworkError(errorType, response.status, endpoint);
  };