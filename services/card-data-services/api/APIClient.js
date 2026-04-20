import TCGdex, { Query } from '@tcgdex/sdk';
import NodeCache from 'node-cache';

// Observer Pattern Implementation (keeping your existing pattern)
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
}

// Singleton Pattern Implementation for TCGdex
class PokemonAPI {
    static instance = null;
    static observer = new APIObserver();

    constructor() {
        if (PokemonAPI.instance) {
            return PokemonAPI.instance;
        }
        
        // Initialize TCGdex SDK (no API key needed!)
        this.tcgdex = new TCGdex('en'); // 'en' for English
        
        // Cache setup (keeping your existing cache structure)
        this.cache = new NodeCache({ 
            stdTTL: 300, // 5 minutes default
            checkperiod: 60,
            maxKeys: 500
        });
        
        this.apiCallLog = new Map();
        this.callId = 0;
        
        // Retry configuration
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        PokemonAPI.instance = this;
    }

    static getInstance() {
        if (!PokemonAPI.instance) {
            PokemonAPI.instance = new PokemonAPI();
        }
        return PokemonAPI.instance;
    }

    // Log API calls (keeping your existing logging pattern)
    logAPICall(endpoint, params, success, dataSize = 0, error = null) {
        const callId = ++this.callId;
        const logEntry = {
            id: callId,
            endpoint,
            params,
            timestamp: new Date().toISOString(),
            status: success ? 'success' : 'error',
            dataSize: dataSize,
            error: error?.message
        };
        
        this.apiCallLog.set(callId, logEntry);
        
        // Notify observers
        if (success) {
            PokemonAPI.observer.notify('apiCallSuccess', logEntry);
        } else {
            PokemonAPI.observer.notify('apiCallError', { ...logEntry, error });
        }
        
        return callId;
    }

    // Retry logic with exponential backoff
    async withRetry(fn, endpoint, params, retries = this.maxRetries) {
        try {
            const startTime = Date.now();
            const result = await fn();
            const duration = Date.now() - startTime;
            
            console.log(`✅ API call successful: ${endpoint} (${duration}ms)`);
            return result;
            
        } catch (error) {
            console.log(`❌ API call failed: ${endpoint} - ${error.message}`);
            
            if (retries > 0 && !error.message.includes('Rate limit')) {
                const delay = this.retryDelay * (this.maxRetries - retries + 1);
                console.log(`🔄 Retrying in ${delay}ms... (${retries} attempts left)`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(fn, endpoint, params, retries - 1);
            }
            
            throw error;
        }
    }

    // Search cards using TCGdex SDK
    async searchCards(searchParams = {}) {
        const {
            name = '',
            types = [],
            set = '',
            rarity = '',
            minHp = null,
            maxHp = null,
            page = 1,
            pageSize = 20,
            orderBy = 'name'
        } = searchParams;

        const cacheKey = `search:${JSON.stringify(searchParams)}`;
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached) {
            PokemonAPI.observer.notify('cacheHit', { endpoint: 'search', cacheKey });
            console.log('📦 Returning from cache');
            return cached;
        }

        try {
            const result = await this.withRetry(async () => {
                let query = Query.create();

                // Apply filters
                if (name && name.trim()) {
                    query = query.contains('name', name.trim());
                }

                if (types && types.length > 0) {
                    query = query.contains('types', types);
                }

                if (set && set.trim()) {
                    query = query.equalTo('set.id', set);
                }

                if (rarity && rarity.trim()) {
                    query = query.equalTo('rarity', rarity);
                }

                if (minHp !== null && minHp !== undefined) {
                    query = query.greaterOrEqualThan('hp', minHp);
                }

                if (maxHp !== null && maxHp !== undefined) {
                    query = query.lesserOrEqualThan('hp', maxHp);
                }

                // Add pagination
                query = query.paginate(page, pageSize);

                const cards = await this.tcgdex.card.list(query);
                
                // Transform to match your existing response format
                const transformedCards = cards.map(card => ({
                    id: card.id,
                    name: card.name,
                    imageUrl: card.image || card.images?.large || card.images?.small,
                    types: card.types || [],
                    hp: card.hp,
                    rarity: card.rarity,
                    set: {
                        id: card.set?.id,
                        name: card.set?.name,
                        series: card.set?.series,
                        logoUrl: card.set?.logoUrl
                    },
                    number: card.number,
                    artist: card.artist,
                    flavorText: card.flavorText,
                    abilities: card.abilities,
                    attacks: card.attacks,
                    weaknesses: card.weaknesses,
                    retreat: card.retreat,
                    price: card.prices?.mid || null
                }));
                
                return {
                    data: transformedCards,
                    page,
                    pageSize,
                    total: transformedCards.length,
                    hasMore: cards.length === pageSize
                };
            }, 'searchCards', searchParams);
            
            // Log the API call
            this.logAPICall('searchCards', searchParams, true, result.data.length);
            
            // Cache the result
            this.cache.set(cacheKey, result);
            
            return result;
            
        } catch (error) {
            this.logAPICall('searchCards', searchParams, false, 0, error);
            throw error;
        }
    }

    // Fetch single card by ID
    async fetchCardById(cardId) {
        const cacheKey = `card:${cardId}`;
        
        const cached = this.cache.get(cacheKey);
        if (cached) {
            PokemonAPI.observer.notify('cacheHit', { endpoint: `card/${cardId}` });
            return cached;
        }

        try {
            const card = await this.withRetry(async () => {
                const result = await this.tcgdex.card.get(cardId);
                
                return {
                    id: result.id,
                    name: result.name,
                    imageUrl: result.image || result.images?.large,
                    smallImage: result.images?.small,
                    types: result.types || [],
                    hp: result.hp,
                    rarity: result.rarity,
                    set: {
                        id: result.set?.id,
                        name: result.set?.name,
                        series: result.set?.series,
                        releaseDate: result.set?.releaseDate,
                        logoUrl: result.set?.logoUrl,
                        symbolUrl: result.set?.symbolUrl
                    },
                    number: result.number,
                    artist: result.artist,
                    flavorText: result.flavorText,
                    abilities: result.abilities || [],
                    attacks: result.attacks || [],
                    weaknesses: result.weaknesses || [],
                    resistances: result.resistances || [],
                    retreat: result.retreat,
                    evolution: result.evolution,
                    prices: result.prices,
                    legalities: result.legalities,
                    nationalPokedexNumbers: result.nationalPokedexNumbers
                };
            }, 'fetchCardById', { cardId });
            
            this.logAPICall('fetchCardById', { cardId }, true, 1);
            this.cache.set(cacheKey, card, 3600); // Cache for 1 hour
            
            return card;
            
        } catch (error) {
            this.logAPICall('fetchCardById', { cardId }, false, 0, error);
            throw error;
        }
    }

    // Get all available sets
    async getAllSets() {
        const cacheKey = 'all:sets';
        
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const sets = await this.withRetry(async () => {
                const allSets = await this.tcgdex.set.list();
                
                return allSets.map(set => ({
                    id: set.id,
                    name: set.name,
                    series: set.serie?.name,
                    releaseDate: set.releaseDate,
                    totalCards: set.total,
                    logoUrl: set.logoUrl,
                    symbolUrl: set.symbolUrl
                }));
            }, 'getAllSets', {});
            
            this.logAPICall('getAllSets', {}, true, sets.length);
            this.cache.set(cacheKey, sets, 86400); // Cache for 24 hours
            
            return sets;
            
        } catch (error) {
            this.logAPICall('getAllSets', {}, false, 0, error);
            throw error;
        }
    }

    // Get cards by set
    async getCardsBySet(setId, page = 1, pageSize = 20) {
        return this.searchCards({ set: setId, page, pageSize });
    }

    // Get cards by type
    async getCardsByType(type, page = 1, pageSize = 20) {
        return this.searchCards({ types: [type], page, pageSize });
    }

    // Advanced search with multiple criteria
    async advancedSearch(filters, page = 1, pageSize = 20) {
        return this.searchCards({ ...filters, page, pageSize });
    }

    // Batch fetch multiple cards
    async fetchCardsBatch(cardIds) {
        const results = await Promise.all(
            cardIds.map(id => this.fetchCardById(id).catch(err => ({ error: err.message, id })))
        );
        return results;
    }

    // Get API call history
    getAPICallLog() {
        return Array.from(this.apiCallLog.values());
    }

    // Get specific call details
    getCallDetails(callId) {
        return this.apiCallLog.get(callId);
    }

    // Clear cache
    clearCache() {
        const previousSize = this.cache.keys().length;
        this.cache.flushAll();
        PokemonAPI.observer.notify('cacheCleared', {
            timestamp: new Date().toISOString(),
            cacheSize: previousSize
        });
        return previousSize;
    }

    // Clear API call log
    clearCallLog() {
        this.apiCallLog.clear();
    }

    // Get cache stats
    getCacheStats() {
        return {
            size: this.cache.keys().length,
            keys: this.cache.keys(),
            ttl: this.cache.getStats()
        };
    }
}

// Observers for monitoring (keeping your existing observers)
class LoggingObserver {
    apiCallStart(data) {
        console.log(`[${data.timestamp}] API Call Started: ${data.endpoint}`);
    }

    apiCallSuccess(data) {
        console.log(`[${data.timestamp}] API Call Successful: ${data.endpoint} (${data.dataSize} items)`);
    }

    apiCallError(data) {
        console.error(`[${data.timestamp}] API Call Failed: ${data.endpoint} - ${data.error}`);
    }

    cacheHit(data) {
        console.log(`[${data.timestamp}] Cache Hit: ${data.endpoint}`);
    }

    cacheCleared(data) {
        console.log(`[${data.timestamp}] Cache Cleared: ${data.cacheSize} items removed`);
    }
}

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

    unhandledError(data) {
        this.errors.push({
            ...data,
            type: 'UNHANDLED_ERROR'
        });
    }

    getErrors() {
        return this.errors;
    }

    clearErrors() {
        this.errors = [];
    }
}

// Query Sanitizer (keeping your existing sanitization)
class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        // Remove potentially dangerous characters
        const sanitized = input.replace(/[<>{}[\];'"\\|`~!@#$%^&*()+=]/g, '');
        
        // Trim and limit length
        return sanitized.trim().slice(0, 100);
    }

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
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeQueryObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    static validateCardName(name) {
        if (!name || typeof name !== 'string') return null;
        const sanitizedName = this.sanitizeString(name);
        if (!sanitizedName.trim()) return null;
        if (sanitizedName.length > 30) return null;
        return sanitizedName;
    }
}

// Search function (updated for TCGdex)
async function searchCards(params = {}, options = {}) {
    const instance = PokemonAPI.getInstance();
    
    // Handle string input (simple name search)
    if (typeof params === 'string') {
        const sanitizedName = QuerySanitizer.validateCardName(params);
        if (!sanitizedName) return [];
        
        const result = await instance.searchCards({
            name: sanitizedName,
            page: options.page || 1,
            pageSize: options.pageSize || 20
        });
        
        return result.data;
    }
    
    // Handle object input
    if (typeof params === 'object' && params !== null) {
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
        const result = await instance.searchCards({
            ...sanitizedParams,
            page: options.page || sanitizedParams.page || 1,
            pageSize: options.pageSize || sanitizedParams.pageSize || 20
        });
        
        return result.data;
    }
    
    return [];
}

// Export functions
async function fetchCardById(cardId) {
    const sanitizedId = QuerySanitizer.sanitizeString(cardId);
    const instance = PokemonAPI.getInstance();
    return instance.fetchCardById(sanitizedId);
}

async function fetchCards(params = {}) {
    const instance = PokemonAPI.getInstance();
    const result = await instance.searchCards(params);
    return result.data;
}

async function getAllSets() {
    const instance = PokemonAPI.getInstance();
    return instance.getAllSets();
}

// Get singleton instance
const pokemonAPI = PokemonAPI.getInstance();

// Set up default observers
const loggingObserver = new LoggingObserver();
const errorTracker = new ErrorTrackingObserver();

PokemonAPI.observer.subscribe(loggingObserver);
PokemonAPI.observer.subscribe(errorTracker);

// Export everything
export { 
    pokemonAPI, 
    PokemonAPI,
    apiObserver as PokemonAPIObserver,
    LoggingObserver,
    ErrorTrackingObserver,
    QuerySanitizer,
    searchCards,
    fetchCardById,
    fetchCards,
    getAllSets
};