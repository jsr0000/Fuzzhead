// src/validation.js
// Input validation schemas and utilities

import { validateInput, ValidationError } from './errors.js';

// Validation schemas for different request types
export const validationSchemas = {
    // Schema for code input requests
    codeRequest: {
        code: {
            required: true,
            type: 'string',
            minLength: 10
        }
    },

    // Schema for GitHub repository requests
    repoRequest: {
        repoUrl: {
            required: true,
            type: 'string',
            pattern: /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/
        },
        branch: {
            required: false,
            type: 'string',
            pattern: /^[a-zA-Z0-9\/\-_]+$/
        },
        filePath: {
            required: false,
            type: 'string',
            pattern: /^[a-zA-Z0-9\/\-_.]+$/
        }
    },

    // Schema for general request validation
    baseRequest: {
        mode: {
            required: false,
            type: 'string',
            pattern: /^(code|repo)$/
        }
    }
};

// Validate request body based on mode
export function validateRequestBody(body) {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body is required and must be an object', 'body', body);
    }

    const mode = body.mode || 'code';

    // Validate base request fields
    validateInput(body, validationSchemas.baseRequest);

    // Validate mode-specific fields
    if (mode === 'code') {
        validateInput(body, validationSchemas.codeRequest);
    } else if (mode === 'repo') {
        validateInput(body, validationSchemas.repoRequest);
    } else {
        throw new ValidationError(`Invalid mode: ${mode}. Must be 'code' or 'repo'`, 'mode', mode);
    }

    return { mode, ...body };
}

// Validate TypeScript code content
export function validateTypeScriptCode(code) {
    if (typeof code !== 'string') {
        throw new ValidationError('Code must be a string', 'code', code);
    }

    if (code.length < 10) {
        throw new ValidationError('Code must be at least 10 characters long', 'code', code.length);
    }

    if (code.length > 100000) {
        throw new ValidationError('Code must be less than 100,000 characters', 'code', code.length);
    }

    // Check for basic TypeScript syntax indicators
    const hasImport = /import\s+.*from\s+['"]/.test(code);
    const hasClass = /class\s+\w+/.test(code);
    const hasMethod = /@method/.test(code);

    if (!hasImport && !hasClass) {
        throw new ValidationError('Code must contain imports or class definitions', 'code', 'No imports or classes found');
    }

    return true;
}

// Validate GitHub repository URL
export function validateGitHubUrl(url) {
    const githubPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/;

    if (!githubPattern.test(url)) {
        throw new ValidationError(
            'Invalid GitHub repository URL. Must be in format: https://github.com/username/repo',
            'repoUrl',
            url
        );
    }

    // Check for common issues
    if (url.includes('..')) {
        throw new ValidationError('Repository URL contains invalid path traversal', 'repoUrl', url);
    }

    return true;
}

// Validate file path
export function validateFilePath(filePath) {
    if (!filePath) return true; // Optional field

    const pathPattern = /^[a-zA-Z0-9\/\-_.]+$/;

    if (!pathPattern.test(filePath)) {
        throw new ValidationError(
            'Invalid file path. Must contain only letters, numbers, slashes, hyphens, underscores, and dots',
            'filePath',
            filePath
        );
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) {
        throw new ValidationError('Invalid file path: potential path traversal detected', 'filePath', filePath);
    }

    return true;
}

// Sanitize input to prevent injection attacks
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // Remove potential script injection
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
}

// Validate and sanitize all inputs
export function validateAndSanitizeInput(body) {
    // First sanitize string inputs
    const sanitizedBody = {};
    for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
            sanitizedBody[key] = sanitizeInput(value);
        } else {
            sanitizedBody[key] = value;
        }
    }

    // Then validate the sanitized input
    return validateRequestBody(sanitizedBody);
} 