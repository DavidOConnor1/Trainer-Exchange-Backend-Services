// Import TCGdex Query builder for constructing search filters
import { Query } from "@tcgdex/sdk";
// Import function to get the shared TCGdex client instance (singleton pattern)
import getTCGdexClient from "../tcgdexClient.js";
// Import pricing methods to fetch Cardmarket price data for cards
import { CardPricingMethods } from "./cardPricing.js";
import { SetMethods } from "./setMethods.js";

export class CardSearchMethods {
  /**
   * @param {Object} cacheManager
   * @param {Object} retryHandler
   * @param {Function} logAPICall
   * @param {CardPricingMethods} pricingMethods
   * @param {SetMethods} setMethods
   */
  constructor(
    cacheManager,
    retryHandler,
    logAPICall,
    pricingMethods,
    setMethods,
  ) {
    this.tcgdex = getTCGdexClient();
    this.cache = cacheManager;
    this.retryHandler = retryHandler;
    this.logAPICall = logAPICall;
    this.pricingMethods = pricingMethods;
    this.setMethods = setMethods;
  }

  async getCardByLocalId(localId) {
    const cacheKey = `card:localId:${localId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const card = await this.retryHandler.withRetry(
        async () => {
          const query = Query.create().equal("localId", localId).paginate(1, 1);
          const cards = await this.tcgdex.card.list(query);
          if (!cards || cards.length === 0) {
            throw new Error(`No card found with localId: ${localId}`);
          }
          const fullCard = await cards[0].getCard();
          return fullCard;
        },
        `getCardByLocalId(${localId})`,
        { localId },
      );

      this.logAPICall("getCardByLocalId", { localId }, true, 1);
      this.cache.set(cacheKey, card, 3600);
      return card;
    } catch (error) {
      this.logAPICall("getCardByLocalId", { localId }, false, 0, error);
      throw error;
    }
  }

  async getCardBySetAndLocalId(setId, localId) {
    const canUseCache = this.cache && typeof this.cache.get === "function";
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

  async getCardByFullId(fullId) {
    const cacheKey = `card:full:${fullId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const card = await this.retryHandler.withRetry(
        async () => {
          const cardData = await this.tcgdex.card.get(fullId);
          const set = await cardData.getSet();
          const serie = set ? await set.getSerie() : null;

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
  }

  /**
   * Optimized search: pagination applied BEFORE expensive details/pricing,
   * and pricing completely removed from search results.
   */
  async searchCards(searchParams = {}) {
    const {
      name = "",
      exactName = false,
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

    const cacheKey = `search:${JSON.stringify(searchParams)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.retryHandler.withRetry(
        async () => {
          // --- Build filters ---
          let query = Query.create();

          if (name && name.trim()) {
            if (exactName) {
              query = query.equal("name", name.trim());
            } else {
              query = query.contains("name", name.trim());
            }
          }
          if (types && types.length > 0) {
            query = query.contains("types", types);
          }
          if (set && set.trim()) {
            const setInput = set.trim();
            const looksLikeId =
              /^[a-z]+\d/.test(setInput) || setInput.includes(".");
            if (looksLikeId) {
              query = query.equal("set.id", setInput);
            } else if (this.setMethods) {
              const allSets = await this.setMethods.getAllSets();
              const match = allSets.find(
                (s) =>
                  s.name.toLowerCase() === setInput.toLowerCase() ||
                  s.name.toLowerCase().includes(setInput.toLowerCase()),
              );
              query = query.equal("set.id", match ? match.id : setInput);
            }
          }
          if (rarity && rarity.trim()) {
            query = query.equal("rarity", rarity);
          }
          if (minHp !== null && !isNaN(minHp)) {
            query = query.greaterOrEqualThan("hp", minHp);
          }
          if (maxHp !== null && !isNaN(maxHp)) {
            query = query.lesserOrEqualThan("hp", maxHp);
          }

          query = query.sort(sortBy, sortOrder);

          // --- Fetch resume list (fast, no details) ---
          const allResumes = await this.tcgdex.card.list(query);

          // Apply localId filter early (on resumes)
          let filteredResumes = allResumes;
          if (localId && localId.trim()) {
            filteredResumes = allResumes.filter(
              (card) => card.localId === localId.trim(),
            );
          }

          // Total estimate (before Pocket removal – slight overcount)
          const totalEstimate = filteredResumes.length;

          // Paginate first – only fetch details for the current page
          const fetchSize = pageSize + 10;
          const start = (page - 1) * pageSize;
          const end = start + fetchSize;
          const pageResumes = filteredResumes.slice(start, end);

          // Fetch full details only for the 5–20 cards on this page
          const fullCards = await Promise.all(
            pageResumes.map(async (resume) => {
              try {
                const fullCard = await resume.getCard();
                const set = await fullCard.getSet();
                const serie = set ? await set.getSerie() : null;

                // Exclude Pokémon TCG Pocket
                if (serie && serie.name === "Pokémon TCG Pocket") {
                  return null;
                }

                // NO pricing – speed
                return {
                  fullCard,
                  pricingData: null,
                  hasPricing: false,
                  relatedSet: set,
                  relatedSerie: serie,
                };
              } catch (error) {
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

          const filteredCards = fullCards.filter((card) => card !== null);
          const transformedCards = filteredCards.map((cardData) =>
            this.transformCardData(cardData),
          );

          return {
            data: transformedCards,
            page,
            pageSize,
            total: totalEstimate,
            hasMore: end < totalEstimate,
          };
        },
        "searchCards",
        searchParams,
      );

      this.logAPICall("searchCards", searchParams, true, result.data.length);
      this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logAPICall("searchCards", searchParams, false, 0, error);
      throw error;
    }
  }

  transformCardData({
    fullCard,
    pricingData,
    hasPricing,
    relatedSet,
    relatedSerie,
  }) {
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

    let imageUrls = { small: null, large: null };

    if (typeof fullCard.getImageURL === "function") {
      try {
        imageUrls.large = fullCard.getImageURL("high", "webp");
        imageUrls.small = fullCard.getImageURL("low", "webp");
      } catch (e) {}
    }

    if (!imageUrls.large && fullCard.id) {
      try {
        const parts = fullCard.id.split("-");
        if (parts.length >= 2) {
          const localIdPart = parts.pop();
          const setIdPart = parts.join("-");
          const baseUrl = `https://assets.tcgdex.net/en/${setIdPart}/${setIdPart}/${localIdPart}`;
          imageUrls.large = `${baseUrl}/high.webp`;
          imageUrls.small = `${baseUrl}/low.webp`;
        }
      } catch (e) {}
    }

    if (!imageUrls.large)
      imageUrls.large = fullCard.images?.large || fullCard.image || null;
    if (!imageUrls.small) imageUrls.small = fullCard.images?.small || null;

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
      nationalPokedexNumbers: fullCard.nationalPokedexNumbers || [],
    };
  }

  async getCardsByType(type, page = 1, pageSize = 20) {
    const cacheKey = `type:${type}:${page}:${pageSize}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.retryHandler.withRetry(
        async () => {
          const query = Query.create()
            .contains("types", [type])
            .sort("localId", "ASC")
            .paginate(page, pageSize);

          const cardResumes = await this.tcgdex.card.list(query);
          const fullCards = await Promise.all(
            cardResumes.map(async (resume) => {
              const fullCard = await resume.getCard();
              return {
                id: fullCard.id,
                localId: fullCard.localId,
                name: fullCard.name,
                number: fullCard.number,
                image: fullCard.getImageURL?.("high", "webp"),
                types: fullCard.types,
                hp: fullCard.hp,
                rarity: fullCard.rarity,
              };
            }),
          );
          return fullCards;
        },
        `getCardsByType(${type})`,
        { type, page, pageSize },
      );

      this.cache.set(cacheKey, result, 3600);
      return result;
    } catch (error) {
      this.logAPICall("getCardsByType", { type }, false, 0, error);
      throw error;
    }
  }

  async getCardsByHp(hp) {
    const cacheKey = `hp:${hp}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const cards = await this.retryHandler.withRetry(
        async () => {
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
  }

  async getCardsByRarity(rarity) {
    const cacheKey = `rarity:${rarity}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const cards = await this.retryHandler.withRetry(
        async () => {
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
  }
}
