import getTCGdexClient from '../tcgdexClient.js';

export class CardPricingMethods {
    constructor(cacheManager, retryHandler, logAPICall) {
        this.tcgdex = getTCGdexClient();
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
    }

    extractCardmarketPricing(cardData) {
        if (!cardData.pricing?.cardmarket) return null;
        
        // Direct access as per TCGdex SDK documentation (no nested 'prices' object)
        const cm = cardData.pricing.cardmarket;
        
        return {
            updated: cm.updated,
            unit: cm.unit,
            avg: cm.avg,
            low: cm.low,
            trend: cm.trend,
            avg1: cm.avg1,
            avg7: cm.avg7,
            avg30: cm.avg30,
            // Holo versions
            avgHolo: cm['avg-holo'],
            lowHolo: cm['low-holo'],
            trendHolo: cm['trend-holo'],
            avg1Holo: cm['avg1-holo'],
            avg7Holo: cm['avg7-holo'],
            avg30Holo: cm['avg30-holo']
        };
    }

    getCurrentPrice(pricing) {
        if (!pricing) return null;
        return pricing.avg30 || pricing.trend || pricing.avg;
    }

    getCurrentHoloPrice(pricing) {
        if (!pricing) return null;
        return pricing.avg30Holo || pricing.trendHolo || pricing.avgHolo;
    }

    async fetchCardWithPricing(cardId) {
        const cacheKey = `card:pricing:${cardId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;
        
        try {
            const card = await this.retryHandler.withRetry(async () => {
                return await this.tcgdex.card.get(cardId);
            }, `fetchCardWithPricing(${cardId})`, { cardId });
            
            // Extract pricing using direct access
            let pricing = null;
            if (card.pricing?.cardmarket) {
                const cm = card.pricing.cardmarket;
                pricing = {
                    avg30: cm.avg30,
                    trend: cm.trend,
                    avg: cm.avg,
                    low: cm.low,
                    avg1: cm.avg1,
                    avg7: cm.avg7
                };
                
                // Log the actual values for debugging
                console.log(`  📊 Raw pricing for ${card.name}:`, {
                    avg30: cm.avg30,
                    trend: cm.trend,
                    avg: cm.avg,
                    low: cm.low,
                    hasData: !!(cm.avg30 || cm.trend || cm.avg)
                });
            }
            
            const hasPricing = pricing && (pricing.avg30 || pricing.trend || pricing.avg);
            
            const result = { 
                card, 
                pricing: pricing,
                hasPricing: hasPricing
            };
            
            if (hasPricing) {
                console.log(`  💰 Pricing fetched for ${card.name}: avg30=€${pricing.avg30 || 'N/A'}, trend=€${pricing.trend || 'N/A'}`);
            } else {
                console.log(`  ⚠️ No pricing available for ${card.name} (${cardId})`);
            }
            
            this.cache.set(cacheKey, result, 1800);
            return result;
        } catch (error) {
            console.error(`Failed to fetch pricing for ${cardId}:`, error.message);
            this.logAPICall('fetchCardWithPricing', { cardId }, false, 0, error);
            return { card: null, pricing: null, hasPricing: false, error: error.message };
        }
    }

    async batchFetchPricing(cardIds) {
        const results = await Promise.all(
            cardIds.map(async (cardId) => {
                const result = await this.fetchCardWithPricing(cardId);
                return {
                    cardId,
                    hasPricing: result.hasPricing,
                    pricing: result.pricing,
                    name: result.card?.name
                };
            })
        );
        
        const withPricing = results.filter(r => r.hasPricing).length;
        console.log(`📊 Batch pricing fetch: ${withPricing}/${cardIds.length} cards have pricing data`);
        
        return results;
    }
}//end card pricing methods