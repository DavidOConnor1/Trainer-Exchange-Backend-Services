import fetch, { Headers } from "node-fetch";
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
        const url = params
            ? `${endpoint}?${new URLSearchParams(params).toString()}`
            : endpoint;

        const cacheKey = url;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            PokemonAPI.observer.notify('cacheHit', {
                endpoint: url,
                timestamp: new Date().toISOString()
            });
            return this.cache.get(cacheKey);
        }

        // Log the API call
        const callId = Date.now();
        this.apiCallLog.set(callId, {
            endpoint: url,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });

        PokemonAPI.observer.notify('apiCallStart', {
            callId,
            endpoint: url,
            timestamp: new Date().toISOString()
        });

        try {
            const res = await fetch(url, {
                headers: HEADERS,
            });

            if (!res.ok) {
                const errorData = {
                    callId,
                    endpoint: url,
                    status: res.status,
                    timestamp: new Date().toISOString()
                };
                
                this.apiCallLog.set(callId, {
                    ...this.apiCallLog.get(callId),
                    status: 'error',
                    error: `HTTP ${res.status}`,
                    response: null
                });

                PokemonAPI.observer.notify('apiCallError', errorData);
                throw new Error(`Failed to fetch: ${res.status}`);
            }

            const data = await res.json();
            const responseData = data.data || data;

            // Update log with success
            this.apiCallLog.set(callId, {
                ...this.apiCallLog.get(callId),
                status: 'success',
                response: responseData,
                completedAt: new Date().toISOString()
            });

            // Cache the response
            this.cache.set(cacheKey, responseData);

            PokemonAPI.observer.notify('apiCallSuccess', {
                callId,
                endpoint: url,
                timestamp: new Date().toISOString(),
                dataLength: Array.isArray(responseData) ? responseData.length : 1
            });

            return responseData;

        } catch (error) {
            const errorData = {
                callId,
                endpoint: url,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            this.apiCallLog.set(callId, {
                ...this.apiCallLog.get(callId),
                status: 'error',
                error: error.message
            });

            PokemonAPI.observer.notify('apiCallError', errorData);
            throw error;
        }//end catch
    }//end makeRequest

    // Fetch a single card by its id
    async fetchCardById(cardId) {
        const endpoint = `${POKEMON_TCG_API_BASE_URL}/cards/${cardId}`;
        return this.makeRequest(endpoint);
    } //end fetchCardById

    // Fetch multiple cards with query parameters
    async fetchCards(params = {}) {
        const endpoint = `${POKEMON_TCG_API_BASE_URL}/cards`;
        return this.makeRequest(endpoint, params);
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