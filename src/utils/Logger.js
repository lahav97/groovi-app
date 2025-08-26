// src/utils/Logger.js
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor(serviceName = 'App') {
        this.serviceName = serviceName;
        this.debugMode = __DEV__ || false;
        this.logLevel = this.debugMode ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const prefix = `[${this.serviceName}][${this.getLevelString(level)}][${timestamp}]`;

        switch (level) {
            case LOG_LEVELS.ERROR:
                console.error(`${prefix} ${message}`, data || '');
                break;
            case LOG_LEVELS.WARN:
                console.warn(`${prefix} ${message}`, data || '');
                break;
            case LOG_LEVELS.INFO:
                console.log(`${prefix} ${message}`, data || '');
                break;
            case LOG_LEVELS.DEBUG:
                console.log(`${prefix} ${message}`, data || '');
                break;
        }
    }

    error(message, data = null) {
        this.log(LOG_LEVELS.ERROR, message, data);
    }

    warn(message, data = null) {
        this.log(LOG_LEVELS.WARN, message, data);
    }

    info(message, data = null) {
        this.log(LOG_LEVELS.INFO, message, data);
    }

    debug(message, data = null) {
        this.log(LOG_LEVELS.DEBUG, message, data);
    }

    shouldLog(level) {
        return level <= this.logLevel;
    }

    getLevelString(level) {
        const levelMap = {
            [LOG_LEVELS.ERROR]: 'ERROR',
            [LOG_LEVELS.WARN]: 'WARN',
            [LOG_LEVELS.INFO]: 'INFO',
            [LOG_LEVELS.DEBUG]: 'DEBUG'
        };
        return levelMap[level] || 'UNKNOWN';
    }

    static createLogger(serviceName) {
        return new Logger(serviceName);
    }
}

export default Logger;
export { LOG_LEVELS };