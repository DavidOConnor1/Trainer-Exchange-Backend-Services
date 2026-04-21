export class CardDetailsMethods {//start card details
    constructor(tcgdex, cacheManager, retryHandler, logAPICall, pricingMethods) {
        this.tcgdex = tcgdex;
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
        this.pricingMethods = pricingMethods;
    }

    // Get full card details by SDK ID
    async getCardById(cardId) {//start get card by id
        const cacheKey = `card:${cardId}`;
        
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const card = await this.retryHandler.withRetry(async () => {
                const cardData = await this.tcgdex.fetch('card', cardId);
                
                const set = await this.tcgdex.fetch('set', cardData.set.id);
                const serie = set ? await this.tcgdex.fetch('serie', set.serie?.id) : null;
                
                const highQualityWebp = cardData.getImageURL ? cardData.getImageURL('high', 'webp') : cardData.images?.large;
                const lowQualityWebp = cardData.getImageURL ? cardData.getImageURL('low', 'webp') : cardData.images?.small;
                
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
                        small: cardData.images?.small
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
                    set: set ? {
                        id: set.id,
                        name: set.name,
                        series: set.serie?.name,
                        releaseDate: set.releaseDate,
                        totalCards: set.total,
                        logoUrl: set.logoUrl,
                        symbolUrl: set.symbolUrl
                    } : null,
                    serie: serie ? {
                        id: serie.id,
                        name: serie.name,
                        logoUrl: serie.logoUrl
                    } : null,
                    pricing: { cardmarket: pricing },
                    currentPrice: this.pricingMethods.getCurrentPrice(pricing),
                    currentHoloPrice: this.pricingMethods.getCurrentHoloPrice(pricing),
                    flavorText: cardData.flavorText,
                    nationalPokedexNumbers: cardData.nationalPokedexNumbers
                };
            }, `getCardById(${cardId})`, { cardId });
            
            this.logAPICall('getCardById', { cardId }, true, 1);
            this.cache.set(cacheKey, card, 3600);
            
            return card;
        } catch (error) {
            this.logAPICall('getCardById', { cardId }, false, 0, error);
            throw error;
        }
    }//end get card by id
}//end card details class