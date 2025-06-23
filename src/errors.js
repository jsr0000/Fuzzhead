// src/errors.js
// Custom error classes for structured error handling

export class FuzzerError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'FuzzerError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

export class CompilationError extends FuzzerError {
    constructor(message, diagnostics = []) {
        super(message, 'COMPILATION_ERROR', { diagnostics });
        this.name = 'CompilationError';
    }
}

export class ImportError extends FuzzerError {
    constructor(message, modulePath) {
        super(message, 'IMPORT_ERROR', { modulePath });
        this.name = 'ImportError';
    }
}

export class ExecutionError extends FuzzerError {
    constructor(message, methodName, args) {
        super(message, 'EXECUTION_ERROR', { methodName, args });
        this.name = 'ExecutionError';
    }
}

export class ValidationError extends FuzzerError {
    constructor(message, field, value) {
        super(message, 'VALIDATION_ERROR', { field, value });
        this.name = 'ValidationError';
    }
}

export class ResourceError extends FuzzerError {
    constructor(message, resource, operation) {
        super(message, 'RESOURCE_ERROR', { resource, operation });
        this.name = 'ResourceError';
    }
}

export class TimeoutError extends FuzzerError {
    constructor(message, duration) {
        super(message, 'TIMEOUT_ERROR', { duration });
        this.name = 'TimeoutError';
    }
}

// Error codes for consistent error handling
export const ErrorCodes = {
    INVALID_INPUT: 'INVALID_INPUT',
    COMPILATION_ERROR: 'COMPILATION_ERROR',
    IMPORT_ERROR: 'IMPORT_ERROR',
    EXECUTION_ERROR: 'EXECUTION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RESOURCE_ERROR: 'RESOURCE_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error severity levels
export const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Helper function to create standardized error responses
export function createErrorResponse(error, logs = []) {
    const isFuzzerError = error instanceof FuzzerError;

    return {
        statusCode: isFuzzerError ? getStatusCodeForError(error.code) : 500,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
            success: false,
            error: {
                message: error.message,
                code: isFuzzerError ? error.code : ErrorCodes.UNKNOWN_ERROR,
                type: error.name,
                timestamp: isFuzzerError ? error.timestamp : new Date().toISOString(),
                details: isFuzzerError ? error.details : {}
            },
            output: logs.join('\n')
        })
    };
}

// Helper function to get appropriate HTTP status code
function getStatusCodeForError(errorCode) {
    const statusCodeMap = {
        [ErrorCodes.INVALID_INPUT]: 400,
        [ErrorCodes.VALIDATION_ERROR]: 400,
        [ErrorCodes.COMPILATION_ERROR]: 422,
        [ErrorCodes.IMPORT_ERROR]: 422,
        [ErrorCodes.EXECUTION_ERROR]: 422,
        [ErrorCodes.RESOURCE_ERROR]: 503,
        [ErrorCodes.TIMEOUT_ERROR]: 408,
        [ErrorCodes.UNKNOWN_ERROR]: 500
    };

    return statusCodeMap[errorCode] || 500;
}

// Helper function to safely execute operations with error handling
export async function safeExecute(operation, errorContext = {}) {
    try {
        return await operation();
    } catch (error) {
        // Log the error with context
        console.error('Operation failed:', {
            error: error.message,
            stack: error.stack,
            context: errorContext
        });

        // Re-throw as FuzzerError if it's not already
        if (error instanceof FuzzerError) {
            throw error;
        }

        throw new FuzzerError(
            error.message || 'An unexpected error occurred',
            ErrorCodes.UNKNOWN_ERROR,
            { ...errorContext, originalError: error.name }
        );
    }
}

// Helper function to validate input
export function validateInput(input, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
        const value = input[field];

        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(new ValidationError(
                `${field} is required`,
                field,
                value
            ));
        }

        if (value !== undefined && value !== null) {
            if (rules.type && typeof value !== rules.type) {
                errors.push(new ValidationError(
                    `${field} must be of type ${rules.type}`,
                    field,
                    value
                ));
            }

            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(new ValidationError(
                    `${field} format is invalid`,
                    field,
                    value
                ));
            }

            if (rules.minLength && value.length < rules.minLength) {
                errors.push(new ValidationError(
                    `${field} must be at least ${rules.minLength} characters`,
                    field,
                    value
                ));
            }
        }
    }

    if (errors.length > 0) {
        throw new ValidationError(
            'Input validation failed',
            'input',
            { errors: errors.map(e => e.message) }
        );
    }
} 