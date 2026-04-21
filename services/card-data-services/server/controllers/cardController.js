import { pokemonAPI } from '../../api/APIClient.js';
import { ResponseHandler } from '../utils/responseHandler.js';

// Helper function to clean card data
function cleanCardData(card) {
    return {
        id: card.id,
        localId: card.localId,
        name: card.name,
        number: card.number,
        category: card.category,
        rarity: card.rarity,
        hp: card.hp,
        types: card.types || [],
        stage: card.stage,
        evolvesFrom: card.evolvesFrom,
        abilities: card.abilities || [],
        attacks: card.attacks || [],
        weaknesses: card.weaknesses || [],
        resistances: card.resistances || [],
        retreat: card.retreat,
        regulationMark: card.regulationMark,
        legalities: card.legalities,
        set: card.set ? {
            id: card.set.id,
            name: card.set.name,
            series: card.set.series,
            releaseDate: card.set.releaseDate,
            totalCards: card.set.totalCards,
            logoUrl: card.set.logoUrl,
            symbolUrl: card.set.symbolUrl
        } : null,
        serie: card.serie ? {
            id: card.serie.id,
            name: card.serie.name,
            logoUrl: card.serie.logoUrl
        } : null,
        images: {
            high: card.images?.high,
            low: card.images?.low,
            small: card.images?.small,
            large: card.images?.large
        },
        pricing: card.pricing?.cardmarket ? {
            avg30: card.pricing.cardmarket.avg30,
            trend: card.pricing.cardmarket.trend,
            avg: card.pricing.cardmarket.avg,
            low: card.pricing.cardmarket.low
        } : null,
        currentPrice: card.currentPrice,
        currentHoloPrice: card.currentHoloPrice,
        artist: card.artist,
        flavorText: card.flavorText,
        nationalPokedexNumbers: card.nationalPokedexNumbers
    };
}

export const cardController = {
    async getCardByLocalId(req, res) {
        const startTime = Date.now();
        try {
            const { localId } = req.params;
            console.log(`🔍 Fetching card with localId: ${localId}`);
            
            const card = await pokemonAPI.getCardByLocalId(localId);
            
            if (!card) {
                return ResponseHandler.notFound(res, `Card with localId ${localId}`);
            }
            
            // Clean the card data
            const cleanedCard = cleanCardData(card);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Card found: ${card.name} (${duration}ms)`);
            
            ResponseHandler.success(res, cleanedCard, 'Card retrieved successfully');
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ getCardByLocalId failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    },

    async getCardBySetAndLocalId(req, res) {
        const startTime = Date.now();
        try {
            const { setId, localId } = req.params;
            console.log(`🔍 Fetching card with set: ${setId}, localId: ${localId}`);
            
            const card = await pokemonAPI.getCardBySetAndLocalId(setId, localId);
            
            if (!card) {
                return ResponseHandler.notFound(res, `Card with set ${setId} and localId ${localId}`);
            }
            
            // Clean the card data
            const cleanedCard = cleanCardData(card);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Card found: ${card.name} (${duration}ms)`);
            
            ResponseHandler.success(res, cleanedCard, 'Card retrieved successfully');
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ getCardBySetAndLocalId failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    },

    async getCardBySdkId(req, res) {
        const startTime = Date.now();
        try {
            const { sdkId } = req.params;
            console.log(`🔍 Fetching card with SDK ID: ${sdkId}`);
            
            const card = await pokemonAPI.getCardById(sdkId);
            
            if (!card) {
                return ResponseHandler.notFound(res, `Card with SDK ID ${sdkId}`);
            }
            
            // Clean the card data
            const cleanedCard = cleanCardData(card);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Card found: ${card.name} (${duration}ms)`);
            
            ResponseHandler.success(res, cleanedCard, 'Card retrieved successfully', 200, {
                warning: 'This is an internal SDK ID. Use /api/cards/:localId for user-facing queries.'
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ getCardBySdkId failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    },

    async getCardPricing(req, res) {
        const startTime = Date.now();
        try {
            const { localId } = req.params;
            console.log(`💰 Fetching pricing for localId: ${localId}`);
            
            const card = await pokemonAPI.getCardByLocalId(localId);
            
            if (!card) {
                return ResponseHandler.notFound(res, `Card with localId ${localId}`);
            }
            
            const duration = Date.now() - startTime;
            const hasPricing = !!card.pricing?.cardmarket;
            console.log(`${hasPricing ? '✅' : '⚠️'} Pricing fetched for ${card.name} (${duration}ms) - ${hasPricing ? 'Pricing available' : 'No pricing data'}`);
            
            ResponseHandler.success(res, {
                pricing: card.pricing,
                currentPrice: card.currentPrice,
                currentHoloPrice: card.currentHoloPrice
            }, 'Pricing retrieved successfully');
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ getCardPricing failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    },

    async batchGetCards(req, res) {
        const startTime = Date.now();
        try {
            const { cardIds } = req.body;
            
            if (!cardIds || !Array.isArray(cardIds) || cardIds.length > 50) {
                return ResponseHandler.error(res, 'Invalid request. Maximum 50 cards per batch', 400);
            }
            
            console.log(`📦 Batch fetching ${cardIds.length} cards`);
            
            const results = await pokemonAPI.getCardsBatch(cardIds);
            
            // Clean the results
            if (results.results) {
                results.results = results.results.map(result => {
                    if (result.success && result.data) {
                        return { ...result, data: cleanCardData(result.data) };
                    }
                    return result;
                });
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ Batch complete: ${results.summary?.successful || 0} successful, ${results.summary?.failed || 0} failed (${duration}ms)`);
            
            ResponseHandler.success(res, results, 'Batch request completed');
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ batchGetCards failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    }
};