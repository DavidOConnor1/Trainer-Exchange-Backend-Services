export class ErrorHandler {
    static handle(error, req, res, next) {
        const timestamp = new Date().toISOString();
        
        console.error(`[${timestamp}] Error:`, error.message);
        
        // Log stack trace in development
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack);
        }
        
        // Handle specific error types
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'Service unavailable. Please try again later.',
                code: 'SERVICE_UNAVAILABLE',
                timestamp
            });
        }
        
        if (error.message && error.message.includes('Rate limit')) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please slow down.',
                code: 'RATE_LIMIT_EXCEEDED',
                timestamp
            });
        }
        
        if (error.message && (error.message.includes('not found') || error.message.includes('No card found'))) {
            return res.status(404).json({
                success: false,
                error: error.message,
                code: 'NOT_FOUND',
                timestamp
            });
        }
        
        if (error.message && error.message.includes('Invalid')) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: 'INVALID_REQUEST',
                timestamp
            });
        }
        
        // Default error response
        return res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            code: 'INTERNAL_ERROR',
            timestamp
        });
    }
}

// Async wrapper to catch errors in routes
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Custom error classes
export class APIError extends Error {
    constructor(message, statusCode = 500, code = 'API_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'APIError';
    }
}

export class NotFoundError extends APIError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends APIError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class RateLimitError extends APIError {
    constructor() {
        super('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    }
}