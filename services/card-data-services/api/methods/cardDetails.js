import getTCGdexClient from "../tcgdexClient.js";

export class CardDetailsMethods {
  constructor(cacheManager, retryHandler, logAPICall, pricingMethods) {
    this.tcgdex = getTCGdexClient();
    this.cache = cacheManager;
    this.retryHandler = retryHandler;
    this.logAPICall = logAPICall;
    this.pricingMethods = pricingMethods;
  }

  async enrichCardData(cardData) {
    // Get related set and serie using relationships
    const set = await cardData.getSet();
    const serie = set ? await set.getSerie() : null;

    // image URL construction
    let highQualityWebp = null;
    let lowQualityWebp = null;

    // Method 1: Use SDK's getImageURL
    if (typeof cardData.getImageURL === "function") {
      try {
        highQualityWebp = cardData.getImageURL("high", "webp");
        lowQualityWebp = cardData.getImageURL("low", "webp");
      } catch (e) {
        console.warn(`SDK getImageURL failed for ${cardData.id}:`, e.message);
      }
    }

    // Method 2: Manually construct URL from card ID
    if (!highQualityWebp && cardData.id) {
      try {
        // Card ID format: "setId-localId" (e.g., "swsh3-136")
        const parts = cardData.id.split("-");
        if (parts.length >= 2) {
          const localId = parts.pop(); // "136"
          const setId = parts.join("-"); // "swsh3"
          const baseUrl = `https://assets.tcgdex.net/en/${setId}/${setId}/${localId}`;
          highQualityWebp = `${baseUrl}/high.webp`;
          lowQualityWebp = `${baseUrl}/low.webp`;
        }
      } catch (e) {
        console.warn(
          `Manual URL construction failed for ${cardData.id}:`,
          e.message,
        );
      }
    }

    // Method 3: Fallback to existing image properties
    if (!highQualityWebp) {
      highQualityWebp = cardData.images?.large || cardData.image || null;
    }
    if (!lowQualityWebp) {
      lowQualityWebp = cardData.images?.small || null;
    }

    const pricing = this.pricingMethods.extractCardmarketPricing(cardData);

    return {
      id: cardData.id,
      localId: cardData.localId,
      name: cardData.name,
      category: cardData.category,
      illustrator: cardData.illustrator || cardData.artist,
      rarity: cardData.rarity,
      variants: cardData.variants || {},
      boosters: cardData.boosters || [],
      updated: cardData.updated,
      number: cardData.number,

      // Consistent image structure
      images: {
        small: lowQualityWebp, // 245x337 webp - for lists/grids
        large: highQualityWebp, // 600x825 webp - for detail views
      },

      types: cardData.types || [],
      hp: cardData.hp,
      stage: cardData.stage,
      evolvesFrom: cardData.evolvesFrom,
      abilities: cardData.abilities || [],
      attacks: cardData.attacks || [],
      weaknesses: cardData.weaknesses || [],
      resistances: cardData.resistances || [],
      retreat: cardData.retreat,
      regulationMark: cardData.regulationMark,
      legalities: cardData.legalities,
      set: set
        ? {
            id: set.id,
            name: set.name,
            series: set.serie?.name,
            releaseDate: set.releaseDate,
            totalCards: set.total,
            logoUrl: set.logoUrl,
            symbolUrl: set.symbolUrl,
          }
        : null,
      serie: serie
        ? {
            id: serie.id,
            name: serie.name,
            logoUrl: serie.logoUrl,
          }
        : null,
      pricing: { cardmarket: pricing },
      currentPrice: this.pricingMethods.getCurrentPrice(pricing),
      currentHoloPrice: this.pricingMethods.getCurrentHoloPrice(pricing),
      flavorText: cardData.flavorText,
      nationalPokedexNumbers: cardData.nationalPokedexNumbers,
    };
  }
}

export default CardDetailsMethods;
