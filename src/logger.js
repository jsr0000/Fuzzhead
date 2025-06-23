// src/logger.js
// Structured logging utility

class Logger {
    constructor() {
        this.logs = [];
        this.levels = {
            info: 0,
            warn: 1,
            error: 2
        };
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        this.logs.push(logEntry);

        // Console output with color coding
        const colors = {
            info: '\x1b[36m', // Cyan
            warn: '\x1b[33m', // Yellow
            error: '\x1b[31m' // Red
        };

        const reset = '\x1b[0m';
        const color = colors[level] || '';

        console.log(`[${level.toUpperCase()}] ${message}`, data);
    }

    info(message, data = {}) {
        this.log('info', message, data);
    }

    warn(message, data = {}) {
        this.log('warn', message, data);
    }

    error(message, data = {}) {
        this.log('error', message, data);
    }

    methodCall(className, methodName, args) {
        this.info(`Method called: ${className}.${methodName}`, { args });
    }

    methodResult(className, methodName, result, duration) {
        this.info(`Method result: ${className}.${methodName}`, {
            result,
            duration: `${duration}ms`
        });
    }

    methodError(className, methodName, error, args) {
        this.error(`Method error: ${className}.${methodName}`, {
            error: error.message,
            args
        });
    }

    clear() {
        this.logs = [];
    }

    getSummary() {
        const summary = {
            total: this.logs.length,
            byLevel: {},
            errors: 0,
            warnings: 0
        };

        this.logs.forEach(log => {
            summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
            if (log.level === 'error') summary.errors++;
            if (log.level === 'warn') summary.warnings++;
        });

        return summary;
    }

    getLogs() {
        return this.logs;
    }
}

// Create singleton instance
const logger = new Logger();

// Export both the class and the instance
export { Logger, logger };
export const log = logger; // Alias for convenience 