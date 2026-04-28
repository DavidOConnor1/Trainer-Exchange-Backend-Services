import getTCGdexClient from "../tcgdexClient.js";

export class CardDetailsMethods {
  constructor(cacheManager, retryHandler, logAPICall, pricingMethods) {
    this.tcgdex = getTCGdexClient();
    this.cache = cacheManager;
    this.retryHandler = retryHandler;
    this.logAPICall = logAPICall;
    this.pricingMethods = pricingMethods;
  }

  // In cardDetails.js
  async enrichCardData(cardData) {
    // Get related set and serie using relationships
    const set = await cardData.getSet();
    const serie = set ? await set.getSerie() : null;

    const highQualityWebp = cardData.getImageURL
      ? cardData.getImageURL("high", "webp")
      : cardData.images?.large;
    const lowQualityWebp = cardData.getImageURL
      ? cardData.getImageURL("low", "webp")
      : cardData.images?.small;

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
      image: highQualityWebp,
      images: {
        high: highQualityWebp,
        low: lowQualityWebp,
        original: cardData.image || cardData.images?.large,
        small: cardData.images?.small,
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
} //end card details class

export default CardDetailsMethods;
