import TCGdex, { Query } from '@tcgdex/sdk';
import { CacheManager } from './utils/CacheManager.js';
import { RetryHandler } from './utils/RetryHandler.js';
import { QuerySanitizer } from './utils/QuerySanitizer.js';
import { CardSearchMethods } from './methods/cardSearch.js';
import { CardPricingMethods } from './methods/cardPricing.js';
import { CardDetailsMethods } from './methods/cardDetails.js';
import { SetMethods } from './methods/setMethods.js';
import { BatchMethods } from './methods/batchMethods.js';
import { LoggingObserver } from './observers/LoggingObserver.js';
import { ErrorTrackingObserver } from './observers/ErrorTrackingObserver.js';

// Observer Pattern
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

// Singleton Pattern
class PokemonAPI {
    static instance = null;
    static observer = new APIObserver();

    constructor() {
        if (PokemonAPI.instance) {
            return PokemonAPI.instance;
        }
        
        // Initialize TCGdex SDK
        this.tcgdex = new TCGdex('en');
        this.tcgdex.setCacheTTL(3600);
        
        // Initialize utilities
        this.cache = new CacheManager(300, 500);
        this.retryHandler = new RetryHandler(3, 1000);
        
        this.apiCallLog = new Map();
        this.callId = 0;
        
        // Initialize method modules
        this.pricingMethods = new CardPricingMethods(
            this.cache, this.retryHandler, this.logAPICall.bind(this)
        );
        
        this.cardSearch = new CardSearchMethods(
            this.cache, this.retryHandler, this.logAPICall.bind(this), this.pricingMethods
        );
        
        this.cardDetails = new CardDetailsMethods(
            this.cache, this.retryHandler, this.logAPICall.bind(this), this.pricingMethods
        );
        
        this.setMethods = new SetMethods(
            this.cache, this.retryHandler, this.logAPICall.bind(this)
        );
        
        this.batchMethods = new BatchMethods(
            this.cache, this.retryHandler, this.logAPICall.bind(this)
        );
        
        PokemonAPI.instance = this;
    }
    //retrieves instance
    static getInstance() {
        if (!PokemonAPI.instance) {
            PokemonAPI.instance = new PokemonAPI(); //if there is no instance create one
        }
        return PokemonAPI.instance;
    }

    // Logging
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
        
        if (success) {
            PokemonAPI.observer.notify('apiCallSuccess', logEntry);
        } else {
            PokemonAPI.observer.notify('apiCallError', { ...logEntry, error });
        }
        
        return callId;
    }

    // ========== CARD METHODS ==========
    
    //Get card by using the identifier on the actual card
    async getCardByLocalId(localId) {
        const cardData = await this.cardSearch.getCardByLocalId(localId);
        return this.cardDetails.getCardById(cardData.id);
    }

    //get card using its set id and local id
    async getCardBySetAndLocalId(setId, localId) {
        const cardData = await this.cardSearch.getCardBySetAndLocalId(setId, localId);
        return this.cardDetails.getCardById(cardData.id);
    }

    //retrieve card by id provided by the sdk/api
    async getCardById(cardId) {
        return this.cardDetails.getCardById(cardId);
    }

    //works similarly to the previous but it rebuilds the full id after it has been separated
    async getCardByFullId(fullId) {
    const cardData = await this.cardSearch.getCardByFullId(fullId);
    return this.cardDetails.getCardById(cardData.id);
}

    // ========== SEARCH METHODS ==========
    
    async searchCards(searchParams) {
        return this.cardSearch.searchCards(searchParams);
    }

    // ========== SET METHODS ==========
    
    async getAllSets() {
        return this.setMethods.getAllSets();
    }

    async getCardsBySet(setId, page, pageSize) {
        return this.setMethods.getCardsBySet(setId, page, pageSize);
    }

    // ========== BATCH METHODS ==========
    
    async getCardsBatch(cardIds) {
        return this.batchMethods.getCardsBatch(cardIds);
    }

    async getCardsByLocalIdsBatch(localIds) {
        return this.batchMethods.getCardsByLocalIdsBatch(localIds);
    }

    // ========== UTILITY METHODS ==========
    
    getAPICallLog() {
        return Array.from(this.apiCallLog.values());
    }

    getCallDetails(callId) {
        return this.apiCallLog.get(callId);
    }

    //used in the server routes
    clearCache() {
        const previousSize = this.cache.clear();
        PokemonAPI.observer.notify('cacheCleared', {
            timestamp: new Date().toISOString(),
            cacheSize: previousSize
        });
        return previousSize;
    }

    clearCallLog() {
        this.apiCallLog.clear();
    }

    getCacheStats() {
        return this.cache.getStats();
    }
}

// Get singleton instance
const pokemonAPI = PokemonAPI.getInstance();

// Set up observers
const loggingObserver = new LoggingObserver();
const errorTracker = new ErrorTrackingObserver();

PokemonAPI.observer.subscribe(loggingObserver);
PokemonAPI.observer.subscribe(errorTracker);

const apiObserver = PokemonAPI.observer;

// Export everything
export { 
    pokemonAPI, 
    PokemonAPI,
    apiObserver,
    LoggingObserver,
    ErrorTrackingObserver,
    QuerySanitizer
};