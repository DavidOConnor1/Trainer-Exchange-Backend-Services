import fetch from "node-fetch";
import { POKEMON_TCG_API_BASE_URL, HEADERS } from "./config.js";


// Observer Pattern Implementation
class APIObserver {
    constructor() {
        this.observers = [];
    }

    subscribe(observer) {
        this.observers.push(observer);
        return () => this.unsubscribe(observer);
    }

    unsubscribe(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notify(event, data) {
        this.observers.forEach(observer => {
            if (observer[event]) {
                observer[event](data);
            }
        });
    }
}//end APIObserver

// Singleton Pattern Implementation
class PokemonAPI {
    static instance = null;
    static observer = new APIObserver();

    constructor() {
        if (PokemonAPI.instance) {
            return PokemonAPI.instance;
        }//end if
        
        this.apiCallLog = new Map();
        this.cache = new Map();
        PokemonAPI.instance = this;
    }//end constructor

    static getInstance() {
        if (!PokemonAPI.instance) {
            PokemonAPI.instance = new PokemonAPI();
        }//end if
        return PokemonAPI.instance;
    }//end get instance

    async makeRequest(endpoint, params = null) {
    const baseUrl = POKEMON_TCG_API_BASE_URL;
    const fullEndpoint = endpoint.startsWith('http') 
        ? endpoint 
        : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const url = params
        ? `${fullEndpoint}?${new URLSearchParams(params).toString()}`
        : fullEndpoint;

    console.log('makeRequest Details:');
    console.log('Full URL:', url);
    
    const cacheKey = url;

    // Check cache first
    if (this.cache.has(cacheKey)) {
        PokemonAPI.observer.notify('cacheHit', { endpoint: url });
        console.log('Returning from cache');
        return this.cache.get(cacheKey);
    }

    // Retry logic
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 45000); // 45 seconds
            
            const startTime = Date.now();
            const res = await fetch(url, {
                headers: HEADERS,
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            const duration = Date.now() - startTime;
            console.log(`Request successful in ${duration}ms`);
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            const responseData = data.data || data;

            console.log(`Received ${Array.isArray(responseData) ? responseData.length : '1'} items`);
            
            // Cache the response
            this.cache.set(cacheKey, responseData);
            
            return responseData;

        } catch (error) {
            lastError = error;
            console.log(`❌ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // All retries failed
    console.error('All retries failed:', lastError.message);
    throw lastError;
}//end make request

    // Fetch a single card by its id
    async fetchCardById(cardId) {
        const endpoint = `/cards/${cardId}`;
        return this.makeRequest(endpoint);
    } //end fetchCardById

    // Fetch multiple cards with query parameters
    async fetchCards(params = {}) {
        return this.makeRequest('/cards', params);
    }//end fetch cards

    // Get API call history
    getAPICallLog() {
        return Array.from(this.apiCallLog.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    } //end get api call log

    // Get specific call details
    getCallDetails(callId) {
        return this.apiCallLog.get(callId);
    }//end get call details

    // Clear cache
    clearCache() {
        this.cache.clear();
        PokemonAPI.observer.notify('cacheCleared', {
            timestamp: new Date().toISOString(),
            cacheSize: 0
        });
    } //end clear cache

    // Clear API call log
    clearCallLog() {
        this.apiCallLog.clear();
    }
}//end pokemon api

// observers for monitoring
class LoggingObserver {
    apiCallStart(data) {
        console.log(`[${data.timestamp}] API Call Started: ${data.endpoint}`);
    }

    apiCallSuccess(data) {
        console.log(`[${data.timestamp}] API Call Successful: ${data.endpoint} (${data.dataLength} items)`);
    }

    apiCallError(data) {
        console.error(`[${data.timestamp}] API Call Failed: ${data.endpoint} - ${data.error}`);
    }

    cacheHit(data) {
        console.log(`[${data.timestamp}] Cache Hit: ${data.endpoint}`);
    }
}//end logging observer

class ErrorTrackingObserver {
    constructor() {
        this.errors = [];
    }

    apiCallError(data) {
        this.errors.push({
            ...data,
            type: 'API_ERROR'
        });
    }

    getErrors() {
        return this.errors;
    }

    clearErrors() {
        this.errors = [];
    }
}//end tracking observer


//  SANITIZATION 

class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        // Remove potentially dangerous characters
        const sanitized = input.replace(/[<>{}[\];'"\\|`~!@#$%^&*()+=]/g, '');
        
        // Trim and limit length
        return sanitized.trim().slice(0, 100);
    }//end sanitizeString

    static sanitizeQueryObject(params) {
        if (typeof params !== 'object' || params === null) return {};
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'number') {
                sanitized[key] = isFinite(value) ? value : 0;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'string' ? this.sanitizeString(item) : item
                );
            } else {
                sanitized[key] = value;
            }
        }//end for
        
        return sanitized;
    }//end sanitizeQueryObject
}//end Query Sanitizer


// SEARCH FUNCTION 

async function searchCards(params) {
    const instance = PokemonAPI.getInstance();
    
    // If params is a string, treat it as a simple name search
    if (typeof params === 'string') {
        const sanitizedName = QuerySanitizer.sanitizeString(params);
        if (!sanitizedName) return [];
        
        return instance.fetchCards({ 
            q: `name:${sanitizedName}*`,
            pageSize: 50 
        });
    }
    
    // If params is an object, treat it as advanced search
    if (typeof params === 'object' && params !== null) {
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
        return instance.fetchCards(sanitizedParams);
    }
    
    // Invalid input
    return [];
}


// EXPORTS


// Get singleton instance
const pokemonAPI = PokemonAPI.getInstance();

// Set up default observers
const loggingObserver = new LoggingObserver();
const errorTracker = new ErrorTrackingObserver();

PokemonAPI.observer.subscribe(loggingObserver);
PokemonAPI.observer.subscribe(errorTracker);

// Export singleton instance
export { pokemonAPI };

// Export observer
export const apiObserver = PokemonAPI.observer;

// Export observer classes
export { LoggingObserver, ErrorTrackingObserver };

// Export sanitizer
export { QuerySanitizer };

// Export the search function
export { searchCards };

// Export functions
export async function fetchCardById(cardId) {
    const sanitizedId = QuerySanitizer.sanitizeString(cardId);
    return pokemonAPI.fetchCardById(sanitizedId);
}

export async function fetchCards(params = {}) {
    const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
    return pokemonAPI.fetchCards(sanitizedParams);
}