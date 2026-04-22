import { pokemonAPI } from '../../api/APIClient.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { asyncHandler } from '../utils/errorHandler.js';

// Helper function to clean card data (remove circular references)
function cleanCardData(card) {
    // Extract set information properly
    let setInfo = null;
    if (card.set) {
        setInfo = {
            id: card.set.id || null,
            name: card.set.name || null,
            series: card.set.series || card.set.serie?.name || null,
            releaseDate: card.set.releaseDate || null,
            totalCards: card.set.totalCards || null,
            logoUrl: card.set.logoUrl || null,
            symbolUrl: card.set.symbolUrl || null
        };
    }
    
    // Extract pricing information 
    let pricingInfo = null;
    if (card.pricing && (card.pricing.avg30 || card.pricing.trend || card.pricing.avg)) {
        pricingInfo = {
            avg30: card.pricing.avg30 || null,
            trend: card.pricing.trend || null,
            avg: card.pricing.avg || null,
            low: card.pricing.low || null,
            avg1: card.pricing.avg1 || null,
            avg7: card.pricing.avg7 || null
        };
    }
    // Fallback in case it's nested (for other endpoints that might use different structure)
    else if (card.pricing?.cardmarket) {
        pricingInfo = {
            avg30: card.pricing.cardmarket.avg30 || null,
            trend: card.pricing.cardmarket.trend || null,
            avg: card.pricing.cardmarket.avg || null,
            low: card.pricing.cardmarket.low || null,
            avg1: card.pricing.cardmarket.avg1 || null,
            avg7: card.pricing.cardmarket.avg7 || null
        };
    }
    
    // Extract image URLs properly
    let imageUrls = {
        small: null,
        large: null
    };
    
    if (card.images) {
        imageUrls.small = card.images.small || null;
        imageUrls.large = card.images.large || null;
    }
    
    // If images not in images object, try direct image property
    if (!imageUrls.large && card.image) {
        imageUrls.large = card.image;
    }
    
    // If still no image, try to get from getImageURL method (for backward compatibility)
    if (!imageUrls.large && typeof card.getImageURL === 'function') {
        try {
            imageUrls.large = card.getImageURL('high', 'webp');
            imageUrls.small = card.getImageURL('low', 'webp');
        } catch (e) {
            // Silently fail
        }
    }
    
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
        retreat: card.retreat,
        regulationMark: card.regulationMark,
        set: setInfo,
        images: imageUrls,
        pricing: pricingInfo,
        hasPricing: !!pricingInfo,
        artist: card.artist,
        flavorText: card.flavorText,
        nationalPokedexNumbers: card.nationalPokedexNumbers || []
    };
}

export const searchController = {
    searchCards: asyncHandler(async (req, res) => {
        const startTime = Date.now();
        try {
            const {
                q, name, exactName, type, types, set, rarity, hp,
                minHp, maxHp, stage, retreat, abilityKeyword,
                attackKeyword, regulationMark, sortBy, sortOrder,
                minPrice, maxPrice, page = 1, pageSize = 20
            } = req.query;
            
            const searchParams = {};
            
            if (q) searchParams.q = q;
            if (name) searchParams.name = name;
            if (exactName === 'true') searchParams.exactName = true;
            if (type) searchParams.type = type;
            if (types) searchParams.types = Array.isArray(types) ? types : [types];
            if (set) searchParams.set = set;
            if (rarity) searchParams.rarity = rarity;
            if (hp) searchParams.hp = hp;
            if (minHp) searchParams.minHp = parseInt(minHp);
            if (maxHp) searchParams.maxHp = parseInt(maxHp);
            if (stage) searchParams.stage = stage;
            if (retreat) searchParams.retreat = parseInt(retreat);
            if (abilityKeyword) searchParams.abilityKeyword = abilityKeyword;
            if (attackKeyword) searchParams.attackKeyword = attackKeyword;
            if (regulationMark) searchParams.regulationMark = regulationMark;
            if (sortBy) searchParams.sortBy = sortBy;
            if (sortOrder) searchParams.sortOrder = sortOrder;
            
            console.log('🔍 Search query:', JSON.stringify(searchParams));
            
            const result = await pokemonAPI.searchCards({
                ...searchParams,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
            
            // Clean the card data to remove circular references
            const cleanedData = result.data.map(card => cleanCardData(card));
            
            // Log pricing summary for debugging
            const cardsWithPricing = cleanedData.filter(c => c.hasPricing).length;
            console.log(`📊 Pricing summary: ${cardsWithPricing}/${cleanedData.length} cards have pricing data`);
            
            const hasMore = cleanedData.length === parseInt(pageSize);
            const duration = Date.now() - startTime;
            
            console.log(`✅ Search completed: ${cleanedData.length} results in ${duration}ms`);
            
            ResponseHandler.paginated(res, cleanedData, {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                hasMore,
                total: result.total || cleanedData.length,
                responseTime: `${duration}ms`
            }, `Found ${cleanedData.length} cards`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Search failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    }),

     searchByAbility: asyncHandler(async (req, res) => {
        const startTime = Date.now();
        try {
            const { text, page = 1, pageSize = 20 } = req.query;
            
            if (!text) {
                return ResponseHandler.error(res, 'Ability text is required', 400);
            }
            
            console.log(`🔍 Searching by ability: "${text}"`);
            
            const results = await pokemonAPI.searchByAbility?.(text, parseInt(page), parseInt(pageSize)) || [];
            
            // Clean the results
            const cleanedData = results.map(card => cleanCardData(card));
            
            const duration = Date.now() - startTime;
            
            console.log(`✅ Ability search complete: ${cleanedData.length} results in ${duration}ms`);
            
            ResponseHandler.success(res, cleanedData, `Found ${cleanedData.length} cards with ability containing "${text}"`, 200, {
                metadata: {
                    responseTime: `${duration}ms`,
                    searchTerm: text
                }
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Ability search failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    }),

    searchByAttack: asyncHandler(async (req, res) => {
        const startTime = Date.now();
        try {
            const { name, page = 1, pageSize = 20 } = req.query;
            
            if (!name) {
                return ResponseHandler.error(res, 'Attack name is required', 400);
            }
            
            console.log(`🔍 Searching by attack: "${name}"`);
            
            const results = await pokemonAPI.searchByAttack?.(name, parseInt(page), parseInt(pageSize)) || [];
            
            // Clean the results
            const cleanedData = results.map(card => cleanCardData(card));
            
            const duration = Date.now() - startTime;
            
            console.log(`✅ Attack search complete: ${cleanedData.length} results in ${duration}ms`);
            
            ResponseHandler.success(res, cleanedData, `Found ${cleanedData.length} cards with attack "${name}"`, 200, {
                metadata: {
                    responseTime: `${duration}ms`,
                    searchTerm: name
                }
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Attack search failed after ${duration}ms:`, error.message);
            ResponseHandler.error(res, error);
        }
    })
};