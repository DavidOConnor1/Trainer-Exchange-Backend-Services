// Import TCGdex Query builder for constructing search filters
import { Query } from "@tcgdex/sdk";
// Import function to get the shared TCGdex client instance (singleton pattern)
import getTCGdexClient from "../tcgdexClient.js";
// Import pricing methods to fetch Cardmarket price data for cards
import { CardPricingMethods } from "./cardPricing.js";

/**
 * CardSearchMethods - Handles all card search and retrieval operations
 * Uses TCGdex SDK with proper Query syntax and relationship methods
 */
export class CardSearchMethods {
  /**
   * Constructor - Initializes the search methods with dependencies
   * @param {Object} cacheManager - Handles caching of API responses
   * @param {Object} retryHandler - Handles retry logic for failed API calls
   * @param {Function} logAPICall - Logs API calls for monitoring
   */
  constructor(cacheManager, retryHandler, logAPICall) {
    // Get the shared TCGdex client instance (singleton pattern)
    this.tcgdex = getTCGdexClient();
    this.cache = cacheManager;
    this.retryHandler = retryHandler;
    this.logAPICall = logAPICall;
    // Initialize pricing methods to fetch Cardmarket data
    this.pricingMethods = new CardPricingMethods(
      cacheManager,
      retryHandler,
      logAPICall,
    );
  }

  /**
   * Get a card by its localId (card number) across all sets
   * Example: localId "136" finds Furret from any set
   */
  async getCardByLocalId(localId) {
    // Create unique cache key for this localId
    const cacheKey = `card:localId:${localId}`;
    // Check cache first to avoid unnecessary API calls
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Use retry handler to automatically retry on failure
      const card = await this.retryHandler.withRetry(
        async () => {
          // Build query to search for card by its localId
          const query = Query.create().equal("localId", localId).paginate(1, 1);

          // Execute search across all sets
          const cards = await this.tcgdex.card.list(query);
          if (!cards || cards.length === 0) {
            throw new Error(`No card found with localId: ${localId}`);
          }

          // Use relationship method to get full card details from the resume
          const fullCard = await cards[0].getCard();
          return fullCard;
        },
        `getCardByLocalId(${localId})`,
        { localId },
      );

      // Log successful API call for monitoring
      this.logAPICall("getCardByLocalId", { localId }, true, 1);
      // Cache for 1 hour (3600 seconds)
      this.cache.set(cacheKey, card, 3600);
      return card;
    } catch (error) {
      // Log failed API call
      this.logAPICall("getCardByLocalId", { localId }, false, 0, error);
      throw error;
    }
  } //end get card by local id

  /**
   * Get a card by both set ID and localId (more specific and faster)
   * Example: setId "swsh3", localId "136" finds Furret from Rebel Clash
   */
  async getCardBySetAndLocalId(setId, localId) {
    // Safety: If cache doesn't have 'get', bypass it
    const canUseCache = this.cache && typeof this.cache.get === "function";

    // Declare cacheKey outside the if block so it's accessible everywhere
    const cacheKey = `card:set:${setId}:localId:${localId}`;

    let cached = null;
    if (canUseCache) {
      cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const card = await this.retryHandler.withRetry(
        async () => {
          const set = await this.tcgdex.set.get(setId);
          const cardResume = set.cards?.find((c) => c.localId === localId);
          if (!cardResume) {
            throw new Error(
              `No card found with localId ${localId} in set ${setId}`,
            );
          }
          const fullCard = await cardResume.getCard();
          return fullCard;
        },
        `getCardBySetAndLocalId(${setId}, ${localId})`,
        { setId, localId },
      );

      this.logAPICall("getCardBySetAndLocalId", { setId, localId }, true, 1);

      if (canUseCache) {
        this.cache.set(cacheKey, card, 3600);
      }

      return card;
    } catch (error) {
      this.logAPICall(
        "getCardBySetAndLocalId",
        { setId, localId },
        false,
        0,
        error,
      );
      throw error;
    }
  }
  /**
   * Get a card by its full SDK ID (e.g., "swsh3-136")
   * This is the most direct method but uses SDK's internal ID format
   */
  async getCardByFullId(fullId) {
    const cacheKey = `card:full:${fullId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const card = await this.retryHandler.withRetry(
        async () => {
          // Direct fetch using SDK's card.get method
          const cardData = await this.tcgdex.card.get(fullId);
          // Use relationship to get the card's set
          const set = await cardData.getSet();
          // Use relationship to get the set's serie
          const serie = set ? await set.getSerie() : null;

          // Attach related data to card for convenience
          cardData.relatedSet = set;
          cardData.relatedSerie = serie;

          return cardData;
        },
        `getCardByFullId(${fullId})`,
        { fullId },
      );

      this.logAPICall("getCardByFullId", { fullId }, true, 1);
      this.cache.set(cacheKey, card, 3600);
      return card;
    } catch (error) {
      this.logAPICall("getCardByFullId", { fullId }, false, 0, error);
      throw error;
    }
  } //end get card by full id

  /**
   * Main search method - Find cards using multiple filters
   * Supports name, type, set, rarity, HP range, and pagination
   */
  async searchCards(searchParams = {}) {
    // Destructure search parameters with default values
    const {
      name = "",
      exactName = false, // If true, matches exact name instead of partial
      types = [],
      set = "",
      rarity = "",
      minHp = null,
      maxHp = null,
      localId = "",
      page = 1,
      pageSize = 20,
      sortBy = "localId",
      sortOrder = "ASC",
    } = searchParams;

    // Create cache key from all search parameters
    const cacheKey = `search:${JSON.stringify(searchParams)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.retryHandler.withRetry(
        async () => {
          // Initialize a new query builder
          let query = Query.create();

          // --- BUILD SEARCH FILTERS ---
          // Filter by localId (exact card number)
          if (localId && localId.trim()) {
            query = query.equal("localId", localId.trim());
          }
          // Filter by card name (partial or exact match)
          if (name && name.trim()) {
            if (exactName) {
              query = query.equal("name", name.trim());
            } else {
              query = query.contains("name", name.trim());
            }
          }
          // Filter by card types (Fire, Water, Grass, etc.)
          if (types && types.length > 0) {
            query = query.contains("types", types);
          }
          // Filter by set ID
          if (set && set.trim()) {
            query = query.equal("set.id", set);
          }
          // Filter by rarity
          if (rarity && rarity.trim()) {
            query = query.equal("rarity", rarity);
          }
          // Filter by minimum HP
          if (minHp !== null && !isNaN(minHp)) {
            query = query.greaterOrEqualThan("hp", minHp);
          }
          // Filter by maximum HP
          if (maxHp !== null && !isNaN(maxHp)) {
            query = query.lesserOrEqualThan("hp", maxHp);
          }

          // Add sorting and pagination
          query = query.sort(sortBy, sortOrder);
          query = query.paginate(page, pageSize);

          // Execute search - returns card resumes (basic info only)
          const cardResumes = await this.tcgdex.card.list(query);

          // For each search result, fetch full card details including pricing
          const fullCards = await Promise.all(
            cardResumes.map(async (resume) => {
              try {
                // Get full card using relationship method
                const fullCard = await resume.getCard();
                // Fetch pricing data for this card
                const pricingResult =
                  await this.pricingMethods.fetchCardWithPricing(fullCard.id);
                // Get related set using relationship
                const set = await fullCard.getSet();
                // Get related serie using relationship
                const serie = set ? await set.getSerie() : null;

                return {
                  fullCard,
                  pricingData: pricingResult.pricing, // Store pricing data
                  hasPricing: pricingResult.hasPricing,
                  relatedSet: set,
                  relatedSerie: serie,
                };
              } catch (error) {
                console.log(
                  `  ⚠️ Failed to fetch full details for ${resume.id}: ${error.message}`,
                );
                // Return resume as fallback if full fetch fails
                return {
                  fullCard: resume,
                  pricingData: null,
                  hasPricing: false,
                  relatedSet: null,
                  relatedSerie: null,
                };
              }
            }),
          );

          // Transform card data into clean, serializable objects for API response
          const transformedCards = fullCards.map(
            ({
              fullCard,
              pricingData,
              hasPricing,
              relatedSet,
              relatedSerie,
            }) => {
              // Build set information from related set or card data
              let setInfo = null;
              if (relatedSet) {
                setInfo = {
                  id: relatedSet.id,
                  name: relatedSet.name,
                  series: relatedSerie?.name,
                  releaseDate: relatedSet.releaseDate,
                  totalCards: relatedSet.total,
                  logoUrl: relatedSet.logoUrl,
                  symbolUrl: relatedSet.symbolUrl,
                };
              } else if (fullCard.set) {
                setInfo = {
                  id: fullCard.set.id,
                  name: fullCard.set.name,
                  series: fullCard.set.serie?.name,
                };
              }

              // Build pricing information (direct access, not nested in cardmarket)
              let pricingInfo = null;
              if (
                pricingData &&
                (pricingData.avg30 || pricingData.trend || pricingData.avg)
              ) {
                pricingInfo = {
                  avg30: pricingData.avg30 || null,
                  trend: pricingData.trend || null,
                  avg: pricingData.avg || null,
                  low: pricingData.low || null,
                  avg1: pricingData.avg1 || null,
                  avg7: pricingData.avg7 || null,
                };
              }

              // Extract image URLs from various possible locations
              let imageUrls = {
                small: null,
                large: null,
              };

              if (fullCard.images) {
                imageUrls.small = fullCard.images.small;
                imageUrls.large = fullCard.images.large;
              }

              if (!imageUrls.large && fullCard.image) {
                imageUrls.large = fullCard.image;
              }

              // Fallback: use getImageURL method if available
              if (
                !imageUrls.large &&
                typeof fullCard.getImageURL === "function"
              ) {
                try {
                  imageUrls.large = fullCard.getImageURL("high", "webp");
                  imageUrls.small = fullCard.getImageURL("low", "webp");
                } catch (e) {
                  // Silently fail - image not available
                }
              }

              // Return clean card object for API response
              return {
                id: fullCard.id,
                localId: fullCard.localId,
                name: fullCard.name,
                number: fullCard.number,
                category: fullCard.category,
                rarity: fullCard.rarity,
                hp: fullCard.hp,
                types: fullCard.types || [],
                stage: fullCard.stage,
                evolvesFrom: fullCard.evolvesFrom,
                retreat: fullCard.retreat,
                regulationMark: fullCard.regulationMark,
                set: setInfo,
                images: imageUrls,
                pricing: pricingInfo,
                hasPricing: hasPricing,
                artist: fullCard.artist,
                flavorText: fullCard.flavorText,
                nationalPokedexNumbers: fullCard.nationalPokedexNumbers,
              };
            },
          );

          // Return paginated results
          return {
            data: transformedCards,
            page,
            pageSize,
            total: transformedCards.length,
            hasMore: cardResumes.length === pageSize,
          };
        },
        "searchCards",
        searchParams,
      );

      // Log successful search and cache results for 5 minutes
      this.logAPICall("searchCards", searchParams, true, result.data.length);
      this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logAPICall("searchCards", searchParams, false, 0, error);
      throw error;
    }
  } //end search cards

  //Get all cards of a specific type
  async getCardsByType(type) {
    const cacheKey = `type:${type}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const cards = await this.retryHandler.withRetry(
        async () => {
          // Query for cards containing the specified type
          const query = Query.create()
            .contains("types", [type])
            .sort("localId", "ASC");

          const cardResumes = await this.tcgdex.card.list(query);

          // Convert each resume to full card using relationship
          const fullCards = await Promise.all(
            cardResumes.map((resume) => resume.getCard()),
          );

          return fullCards;
        },
        `getCardsByType(${type})`,
        { type },
      );

      this.cache.set(cacheKey, cards, 3600);
      return cards;
    } catch (error) {
      this.logAPICall("getCardsByType", { type }, false, 0, error);
      throw error;
    }
  } //end get cards by type

  //Get all cards with a specific HP value
  async getCardsByHp(hp) {
    const cacheKey = `hp:${hp}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const cards = await this.retryHandler.withRetry(
        async () => {
          // Query for cards with exact HP value
          const query = Query.create()
            .equal("hp", parseInt(hp))
            .sort("localId", "ASC");

          const cardResumes = await this.tcgdex.card.list(query);

          const fullCards = await Promise.all(
            cardResumes.map((resume) => resume.getCard()),
          );

          return fullCards;
        },
        `getCardsByHp(${hp})`,
        { hp },
      );

      this.cache.set(cacheKey, cards, 3600);
      return cards;
    } catch (error) {
      this.logAPICall("getCardsByHp", { hp }, false, 0, error);
      throw error;
    }
  } //end get cards by hp

  //get cards by specific rarity
  async getCardsByRarity(rarity) {
    const cacheKey = `rarity:${rarity}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const cards = await this.retryHandler.withRetry(
        async () => {
          // Query for cards with exact rarity
          const query = Query.create()
            .equal("rarity", rarity)
            .sort("localId", "ASC");

          const cardResumes = await this.tcgdex.card.list(query);

          const fullCards = await Promise.all(
            cardResumes.map((resume) => resume.getCard()),
          );

          return fullCards;
        },
        `getCardsByRarity(${rarity})`,
        { rarity },
      );

      this.cache.set(cacheKey, cards, 3600);
      return cards;
    } catch (error) {
      this.logAPICall("getCardsByRarity", { rarity }, false, 0, error);
      throw error;
    }
  } //end get card by rarity
} //end search methods
