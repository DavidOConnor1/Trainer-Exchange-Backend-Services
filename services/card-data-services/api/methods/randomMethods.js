import getTCGdexClient from '../tcgdexClient.js';

export class RandomMethods {
    constructor(cacheManager, retryHandler, logAPICall) {
        this.tcgdex = getTCGdexClient();
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
    }

    async getRandomCard() {
        try {
            const randomCard = await this.retryHandler.withRetry(async () => {
                return await this.tcgdex.random.card();
            }, 'getRandomCard', {});
            
            this.logAPICall('getRandomCard', {}, true, 1);
            return randomCard;
        } catch (error) {
            this.logAPICall('getRandomCard', {}, false, 0, error);
            throw error;
        }
    }

    async getRandomSet() {
        try {
            const randomSet = await this.retryHandler.withRetry(async () => {
                return await this.tcgdex.random.set();
            }, 'getRandomSet', {});
            
            this.logAPICall('getRandomSet', {}, true, 1);
            return randomSet;
        } catch (error) {
            this.logAPICall('getRandomSet', {}, false, 0, error);
            throw error;
        }
    }

    async getRandomSerie() {
        try {
            const randomSerie = await this.retryHandler.withRetry(async () => {
                return await this.tcgdex.random.serie();
            }, 'getRandomSerie', {});
            
            this.logAPICall('getRandomSerie', {}, true, 1);
            return randomSerie;
        } catch (error) {
            this.logAPICall('getRandomSerie', {}, false, 0, error);
            throw error;
        }
    }

    async getMultipleRandomCards(count = 5, unique = true) {
        const randomCards = [];
        const usedIds = new Set();
        let attempts = 0;
        const maxAttempts = count * 4;
        
        while (randomCards.length < count && attempts < maxAttempts) {
            attempts++;
            const randomCard = await this.getRandomCard();
            
            if (randomCard && randomCard.id) {
                if (!unique || !usedIds.has(randomCard.id)) {
                    if (unique) usedIds.add(randomCard.id);
                    randomCards.push(randomCard);
                }
            }
        }
        
        return randomCards;
    }
}