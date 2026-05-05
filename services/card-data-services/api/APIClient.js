import TCGdex, { Query } from "@tcgdex/sdk";
import { CacheManager } from "./utils/CacheManager.js";
import { RetryHandler } from "./utils/RetryHandler.js";
import { QuerySanitizer } from "./utils/QuerySanitizer.js";
import { CardSearchMethods } from "./methods/cardSearch.js";
import { CardPricingMethods } from "./methods/cardPricing.js";
import { CardDetailsMethods } from "./methods/cardDetails.js";
import { SetMethods } from "./methods/setMethods.js";
import { BatchMethods } from "./methods/batchMethods.js";
import { LoggingObserver } from "./observers/LoggingObserver.js";
import { ErrorTrackingObserver } from "./observers/ErrorTrackingObserver.js";
import { CircuitBreaker } from "./utils/CircuitBreaker.js";
import { Bulkhead } from "./utils/BulkHead.js";
import { OptimizedCache } from "./utils/OptimizedCache.js";
import { TokenBucket } from "./utils/TokenBucket.js";
import { RequestDebouncer } from "./utils/Debounce.js";
import { StaleWhileRevalidateCache } from "./utils/StaleCache.js";

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
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  notify(event, data) {
    this.observers.forEach((observer) => {
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
    this.tcgdex = new TCGdex("en");
    this.tcgdex.setCacheTTL(3600);

    // Initialize utilities
    this.cache = new CacheManager(300, 500);
    this.retryHandler = new RetryHandler(3, 1000);
    this.circuitBreaker = new CircuitBreaker(10, 10000);
    this.searchBulkhead = new Bulkhead("search", 5, 10);
    this.cardBulkhead = new Bulkhead("card", 10, 20);
    this.optimizedCache = new OptimizedCache(300, 500);
    this.tokenBucket = new TokenBucket(100, 10, 1000);
    this.debouncer = new RequestDebouncer(300);
    this.staleCache = new StaleWhileRevalidateCache(300, 3600);

    this.apiCallLog = new Map();
    this.callId = 0;

    // Initialize method modules
    this.pricingMethods = new CardPricingMethods(
      this.cache,
      this.retryHandler,
      this.logAPICall.bind(this),
    );

    this.setMethods = new SetMethods(
      this.cache, // 1st: cacheManager
      this.retryHandler, // 2nd: retryHandler
      this.logAPICall.bind(this), // 3rd: logAPICall
    );

    this.cardSearch = new CardSearchMethods(
      this.cache, // 1st: cacheManager
      this.retryHandler, // 2nd: retryHandler
      this.logAPICall.bind(this), // 3rd: logAPICall
      this.pricingMethods, // 4th: pricingMethods
      this.setMethods, //5th: setMethods
    );

    this.cardDetails = new CardDetailsMethods(
      this.cache, // 1st: cacheManager
      this.retryHandler, // 2nd: retryHandler
      this.logAPICall.bind(this), // 3rd: logAPICall
      this.pricingMethods, // 4th: pricingMethods
    );

    this.batchMethods = new BatchMethods(
      this.cache, // 1st: cacheManager
      this.retryHandler, // 2nd: retryHandler
      this.logAPICall.bind(this), // 3rd: logAPICall
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
      status: success ? "success" : "error",
      dataSize: dataSize,
      error: error?.message,
    };

    this.apiCallLog.set(callId, logEntry);

    if (success) {
      PokemonAPI.observer.notify("apiCallSuccess", logEntry);
    } else {
      PokemonAPI.observer.notify("apiCallError", { ...logEntry, error });
    }

    return callId;
  }

  // ========== CARD METHODS ==========

  // Get card by using the identifier on the actual card (localId)
  async getCardByLocalId(localId) {
    // Get raw card data from cardSearch
    const cardData = await this.cardSearch.getCardByLocalId(localId);
    // Pass the already-fetched card to cardDetails for formatting
    return this.cardDetails.enrichCardData(cardData);
  }

  //get card using its set id and local id
  async getCardBySetAndLocalId(setId, localId) {
    // Get the raw card data from cardSearch (already has full card object)
    const cardData = await this.cardSearch.getCardBySetAndLocalId(
      setId,
      localId,
    );

    // Pass the already-fetched card to cardDetails for formatting
    return this.cardDetails.enrichCardData(cardData);
  }

  // Get card by SDK ID (with all protection patterns)
  async getCardById(cardId) {
    await this.tokenBucket.consume(1);

    return this.circuitBreaker.call(async () => {
      return this.cardBulkhead.execute(async () => {
        return this.debouncer.debounce(cardId, async () => {
          return this.optimizedCache.getOrSet(
            `card:${cardId}`,
            async () => {
              // Get raw card data from SDK
              const cardData = await this.tcgdex.card.get(cardId);
              // Enrich the card data
              return this.cardDetails.enrichCardData(cardData);
            },
            3600,
          );
        });
      });
    });
  }

  // ========== SEARCH METHODS ==========

  async searchCards(searchParams) {
    // Apply multiple patterns
    await this.tokenBucket.consume(1);

    return this.circuitBreaker.call(async () => {
      return this.searchBulkhead.execute(async () => {
        const cacheKey = `search:${JSON.stringify(searchParams)}`;

        return this.staleCache.getOrSet(cacheKey, async () => {
          return this.cardSearch.searchCards(searchParams);
        });
      });
    });
  }

  // ========== SET METHODS ==========

  async getAllSets() {
    return this.setMethods.getAllSets();
  }

  async getCardsBySet(setId, page, pageSize) {
    return this.setMethods.getCardsBySet(setId, page, pageSize);
  }

  async getCardsByType(type, page, pageSize) {
    return this.cardSearch.getCardsByType(type, page, pageSize);
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
    PokemonAPI.observer.notify("cacheCleared", {
      timestamp: new Date().toISOString(),
      cacheSize: previousSize,
    });
    return previousSize;
  }

  clearCallLog() {
    this.apiCallLog.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  getPatternStats() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      searchBulkhead: this.searchBulkhead.getStats(),
      cardBulkhead: this.cardBulkhead.getStats(),
      cache: this.optimizedCache.getStats(),
      tokenBucket: "Active",
    };
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
  QuerySanitizer,
};
