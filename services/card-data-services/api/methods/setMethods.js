import { Query } from '@tcgdex/sdk';
import getTCGdexClient from '../tcgdexClient.js';

export class SetMethods {
    constructor(cacheManager, retryHandler, logAPICall) {
        this.tcgdex = getTCGdexClient();
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
    }

    // Get all sets with series information using proper relationships
    async getAllSets() {
        const cacheKey = 'all:sets';
        
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const sets = await this.retryHandler.withRetry(async () => {
                const allSets = await this.tcgdex.set.list();
                
                return await Promise.all(allSets.map(async (set) => {
                    // Use proper relationship method
                    const serie = await set.getSerie();
                    return {
                        id: set.id,
                        name: set.name,
                        series: {
                            id: serie?.id,
                            name: serie?.name,
                            logoUrl: serie?.logoUrl
                        },
                        releaseDate: set.releaseDate,
                        totalCards: set.total,
                        cardCount: {
                            total: set.cardCount?.total,
                            official: set.cardCount?.official
                        },
                        logoUrl: set.logoUrl,
                        symbolUrl: set.symbolUrl,
                        isLegal: set.legalities?.standard === 'Legal'
                    };
                }));
            }, 'getAllSets', {});
            
            this.logAPICall('getAllSets', {}, true, sets.length);
            this.cache.set(cacheKey, sets, 86400);
            
            return sets;
        } catch (error) {
            this.logAPICall('getAllSets', {}, false, 0, error);
            throw error;
        }
    }

    // Get a specific set by ID
    async getSetById(setId) {
        const cacheKey = `set:${setId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const set = await this.retryHandler.withRetry(async () => {
                return await this.tcgdex.set.get(setId);
            }, `getSetById(${setId})`, { setId });
            
            this.cache.set(cacheKey, set, 86400);
            return set;
        } catch (error) {
            this.logAPICall('getSetById', { setId }, false, 0, error);
            throw error;
        }
    }

    // Get cards by set using proper relationship
    async getCardsBySet(setId, page = 1, pageSize = 20) {
        const cacheKey = `set:${setId}:cards:${page}:${pageSize}`;
        
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const result = await this.retryHandler.withRetry(async () => {
                const set = await this.tcgdex.set.get(setId);
                
                // Use the set's cards relationship
                const cardResumes = set.cards || [];
                
                // Apply pagination
                const start = (page - 1) * pageSize;
                const end = start + pageSize;
                const paginatedResumes = cardResumes.slice(start, end);
                
                // Get full card details for each card using relationship
                const cards = await Promise.all(
                    paginatedResumes.map(async (resume) => {
                        const fullCard = await resume.getCard();
                        return {
                            id: fullCard.id,
                            localId: fullCard.localId,
                            name: fullCard.name,
                            number: fullCard.number,
                            image: fullCard.getImageURL('high', 'webp'),
                            types: fullCard.types,
                            hp: fullCard.hp,
                            rarity: fullCard.rarity
                        };
                    })
                );
                
                return {
                    data: cards,
                    page,
                    pageSize,
                    total: cardResumes.length,
                    hasMore: end < cardResumes.length,
                    setInfo: {
                        id: set.id,
                        name: set.name,
                        totalCards: set.total
                    }
                };
            }, `getCardsBySet(${setId})`, { setId, page, pageSize });
            
            this.cache.set(cacheKey, result, 3600);
            return result;
        } catch (error) {
            console.error('Error getting cards by set:', error);
            throw error;
        }
    }
}