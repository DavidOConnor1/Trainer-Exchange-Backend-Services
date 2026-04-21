export const HEADERS = {
    "Content-Type": "application/json"
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
};

// Cache configuration
export const CACHE_CONFIG = {
    stdTTL: 300, // Default 5 minutes
    checkperiod: 60,
    maxKeys: 500
};

console.log('✅ TCGdex SDK initialized');