// Logger utility for the Groovi app
// Provides structured logging with performance tracking and memory monitoring

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.timers = new Map();
        this.isDevelopment = __DEV__;
    }

    // Format timestamp for logs
    getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    // Format log message with context and timestamp
    formatMessage(level, message, data = {}) {
        const timestamp = this.getTimestamp();
        const prefix = `[${timestamp}] ${this.context} ${level}:`;

        if (Object.keys(data).length > 0) {
            return `${prefix} ${message}`;
        }
        return `${prefix} ${message}`;
    }

    // Start performance timer
    time(label) {
        const key = `${this.context}_${label}`;
        this.timers.set(key, Date.now());
        if (this.isDevelopment) {
            console.time(key);
        }
    }

    // End performance timer and log duration
    timeEnd(label) {
        const key = `${this.context}_${label}`;
        const startTime = this.timers.get(key);

        if (startTime) {
            const duration = Date.now() - startTime;
            this.timers.delete(key);

            if (this.isDevelopment) {
                console.timeEnd(key);
                console.log(this.formatMessage('PERF', `${label} completed in ${duration}ms`));
            }
        }
    }

    // Memory usage tracking
    memory(label = 'Memory Check') {
        if (this.isDevelopment && global.performance && global.performance.memory) {
            const memory = global.performance.memory;
            const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
            const total = Math.round(memory.totalJSHeapSize / 1024 / 1024);
            console.log(this.formatMessage('MEMORY', `${label}: ${used}MB / ${total}MB`));
        }
    }

    // Debug level logging (only in development)
    debug(message, data = {}) {
        if (this.isDevelopment) {
            console.log(this.formatMessage('DEBUG', message, data));
            if (Object.keys(data).length > 0) {
                console.log(data);
            }
        }
    }

    // Info level logging
    info(message, data = {}) {
        console.log(this.formatMessage('INFO', message, data));
        if (Object.keys(data).length > 0) {
            console.log(data);
        }
    }

    // Warning level logging
    warn(message, data = {}) {
        console.warn(this.formatMessage('WARN', message, data));
        if (Object.keys(data).length > 0) {
            console.warn(data);
        }
    }

    // Error level logging
    error(message, data = {}) {
        console.error(this.formatMessage('ERROR', message, data));
        if (Object.keys(data).length > 0) {
            console.error(data);
        }
    }

    // Log method for general use
    log(message, data = {}) {
        this.info(message, data);
    }
}

// Factory function to create logger instances
export const createLogger = (context) => {
    return new Logger(context);
};

// Default logger instance
export const logger = new Logger('App');

// Export the Logger class for direct use if needed
export default Logger;
