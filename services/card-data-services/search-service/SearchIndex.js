import { pokemonAPI, QuerySanitizer, searchCards as tcgdexSearch } from "../api/APIClient.js";
import TCGdex, { Query } from '@tcgdex/sdk';  
import searchCache from "../cache/SearchCache.js";

/**
 * Builds search parameters for TCGdex SDK with advanced options
 */
function buildSearchParams(params = {}) {
    const searchParams = {};
    
    // Handle name search with exact match option
    if (params.name) {
        searchParams.name = params.name;
        searchParams.exactName = params.exactName || false;
    }
    
    // Handle type search (can be single or multiple)
    if (params.type || params.types) {
        searchParams.types = params.type ? [params.type] : params.types;
    }
    
    // Handle set search
    if (params.set || params.setId) {
        searchParams.set = params.set || params.setId;
    }
    
    // Handle rarity
    if (params.rarity) {
        searchParams.rarity = params.rarity;
    }
    
    // Handle HP range
    if (params.hp) {
        if (typeof params.hp === 'string' && params.hp.includes('-')) {
            const [min, max] = params.hp.split('-').map(Number);
            if (!isNaN(min)) searchParams.minHp = min;
            if (!isNaN(max)) searchParams.maxHp = max;
        } else if (!isNaN(parseInt(params.hp))) {
            searchParams.minHp = parseInt(params.hp);
            searchParams.maxHp = parseInt(params.hp);
        }
    }
    
    // Handle direct minHp/maxHp
    if (params.minHp) searchParams.minHp = parseInt(params.minHp);
    if (params.maxHp) searchParams.maxHp = parseInt(params.maxHp);
    
    // Handle stage (Basic, Stage 1, Stage 2, etc.)
    if (params.stage) {
        searchParams.stage = params.stage;
    }
    
    // Handle retreat cost
    if (params.retreat !== undefined && params.retreat !== null) {
        searchParams.retreat = parseInt(params.retreat);
    }
    
    // Handle ability keyword search
    if (params.abilityKeyword) {
        searchParams.abilityKeyword = params.abilityKeyword;
    }
    
    // Handle attack keyword search
    if (params.attackKeyword) {
        searchParams.attackKeyword = params.attackKeyword;
    }
    
    // Handle regulation mark
    if (params.regulationMark) {
        searchParams.regulationMark = params.regulationMark;
    }
    
    // Handle sorting
    if (params.sortBy) {
        searchParams.sortBy = params.sortBy;
        searchParams.sortOrder = params.sortOrder || 'ASC';
    }
    
    // Handle q parameter (legacy support)
    if (params.q) {
        const qParts = params.q.split(' ');
        qParts.forEach(part => {
            if (part.includes(':')) {
                const [key, value] = part.split(':');
                const cleanValue = value.replace('*', '');
                if (key === 'name') searchParams.name = cleanValue;
                if (key === 'types') searchParams.types = [cleanValue];
                if (key === 'rarity') searchParams.rarity = cleanValue;
                if (key === 'set') searchParams.set = cleanValue;
                if (key === 'stage') searchParams.stage = cleanValue;
            }
        });
    }
    
    return searchParams;
}

/**
 * Main search function using TCGdex SDK with full features
 */
export async function searchCards(params = {}, options = {}) {
    try {
        // Generate cache key
        const cacheKey = { params, options };
        const cached = searchCache.get(cacheKey);
        if (cached) {
            console.log('📦 Returning from search cache');
            return cached;
        }

        // Handle string input (simple name search)
        if (typeof params === 'string') {
            const sanitizedName = QuerySanitizer.validateCardName(params);
            if (!sanitizedName) return [];
            params = { name: sanitizedName };
        }
        
        // Sanitize parameters
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
        
        // Build search parameters for TCGdex
        const searchParams = buildSearchParams(sanitizedParams);
        
        // Add pagination
        const page = Math.max(1, options.page || sanitizedParams.page || 1);
        const pageSize = Math.min(50, Math.max(1, options.pageSize || sanitizedParams.pageSize || 20));
        
        console.log('🔍 Enhanced Search Details:');
        console.log('Input params:', sanitizedParams);
        console.log('Search params:', searchParams);
        console.log('Pagination:', { page, pageSize });
        
        // Perform search using TCGdex
        const result = await pokemonAPI.searchCards({
            ...searchParams,
            page,
            pageSize
        });
        
        console.log(`✅ Found ${result.data.length} cards`);
        if (result.data.length > 0) {
            console.log(`📊 Sample card: ${result.data[0].name} (${result.data[0].id})`);
            if (result.data[0].pricing?.cardmarket) {
                console.log(`💰 Price trend: €${result.data[0].pricing.cardmarket.trend}`);
            }
        }
        
        // Cache the results
        searchCache.set(cacheKey, result.data);
        
        return result.data;
        
    } catch (error) {
        console.error('❌ Search error:', error.message);
        return [];
    }
}

/**
 * Get complete card details including pricing and relationships
 */
export async function getCardDetails(cardId) {
    try {
        const card = await pokemonAPI.getCardById(cardId);
        
        console.log(`📇 Card details fetched: ${card.name}`);
        
        if (card.currentPrice) {
            console.log(`💰 Cardmarket price: €${card.currentPrice}`);
            if (card.pricing?.prices?.avg30) {
                console.log(`📊 30-day average: €${card.pricing.prices.avg30}`);
            }
            if (card.pricing?.prices?.trendPrice) {
                console.log(`📈 Trend price: €${card.pricing.prices.trendPrice}`);
            }
        } else {
            console.log(`💰 No Cardmarket pricing available for this card`);
        }
        
        return card;
    } catch (error) {
        console.error('Error fetching card details:', error);
        return null;
    }
}

/**
 * Get card pricing only (lightweight)
 */
export async function getCardPricing(cardId) {
    try {
        const pricing = await pokemonAPI.getCardPricing(cardId);
        return pricing;
    } catch (error) {
        console.error('Error fetching card pricing:', error);
        return null;
    }
}

/**
 * Get all card sets with series information
 */
export async function getAllCardSets() {
    try {
        const sets = await pokemonAPI.getAllSets();
        return sets;
    } catch (error) {
        console.error('Error fetching sets:', error);
        return [];
    }
}

/**
 * Get cards by set with pagination
 */
export async function getCardsBySet(setId, page = 1, pageSize = 20) {
    try {
        const result = await pokemonAPI.getCardsBySet(setId, page, pageSize);
        return result;
    } catch (error) {
        console.error('Error fetching cards by set:', error);
        return { data: [], hasMore: false };
    }
}

/**
 * Get cards by type
 */
export async function getCardsByType(type, page = 1, pageSize = 20) {
    return searchCards({ types: [type] }, { page, pageSize });
}

/**
 * Search by ability text
 */
export async function searchByAbility(abilityText, page = 1, pageSize = 20) {
    const cards = await pokemonAPI.searchByAbility(abilityText, page, pageSize);
    return cards;
}

/**
 * Search by attack name
 */
export async function searchByAttack(attackName, page = 1, pageSize = 20) {
    const cards = await pokemonAPI.searchByAttack(attackName, page, pageSize);
    return cards;
}

/**
 * Get all series with their sets
 */
export async function getAllSeriesWithSets() {
    try {
        const series = await pokemonAPI.getAllSeriesWithSets();
        return series;
    } catch (error) {
        console.error('Error fetching series:', error);
        return [];
    }
}

/**
 * Advanced search with complex queries
 */
export async function advancedSearch(queryConfig) {
    try {
        const results = await pokemonAPI.advancedQuery(queryConfig);
        return results;
    } catch (error) {
        console.error('Advanced search error:', error);
        return [];
    }
}

/**
 * Search with price filtering (requires additional processing)
 */
export async function searchWithPriceFilter(searchParams, minPrice = null, maxPrice = null) {
    // First get search results
    let cards = await searchCards(searchParams);
    
    // Filter by price if specified
    if (minPrice !== null || maxPrice !== null) {
        cards = cards.filter(card => {
            const price = card.pricing?.cardmarket?.avg30 || 
                         card.pricing?.cardmarket?.trend || 
                         card.pricing?.tcgplayer?.holofoil;
            
            if (!price) return false;
            
            if (minPrice !== null && price < minPrice) return false;
            if (maxPrice !== null && price > maxPrice) return false;
            
            return true;
        });
    }
    
    return cards;
}

/**
 * Get card by localId using fetch
 */
export async function getCardByLocalId(localId) {
    try {
        const tcgdex = new TCGdex('en');
        const query = Query.create()
            .equal('localId', localId)
            .paginate(1, 1);
        
        const cards = await tcgdex.fetch('cards', { query });
        
        if (!cards || cards.length === 0) {
            return null;
        }
        
        // Get full details using the SDK ID
        const card = await getCardDetails(cards[0].id);
        return card;
    } catch (error) {
        console.error('Error fetching card by localId:', error);
        return null;
    }
}

/**
 * Get card by set ID and localId
 */
export async function getCardBySetAndLocalId(setId, localId) {
    try {
        const tcgdex = new TCGdex('en');
        const query = Query.create()
            .equal('set.id', setId)
            .equal('localId', localId)
            .paginate(1, 1);
        
        const cards = await tcgdex.fetch('cards', { query });
        
        if (!cards || cards.length === 0) {
            return null;
        }
        
        const card = await getCardDetails(cards[0].id);
        return card;
    } catch (error) {
        console.error('Error fetching card by set and localId:', error);
        return null;
    }
}

/**
 * Search by localId only (across all sets)
 * This will find the card regardless of which set it's from
 */
export async function searchByLocalId(localId, page = 1, pageSize = 20) {
    return searchCards({ localId }, { page, pageSize });
}



// Legacy support functions
export async function searchCardsPaginated(query, page = 1, pageSize = 20) {
    return searchCards(query, { page, pageSize });
}

export async function searchCardsByName(name, options = {}) {
    return searchCards({ name }, options);
}

export async function searchCardsByType(type, options = {}) {
    return searchCards({ types: [type] }, options);
}

export async function searchCardsBySet(setName, options = {}) {
    return searchCards({ set: setName }, options);
}

export async function searchByMultipleCriteria(criteria = {}, options = {}) {
    return searchCards(criteria, options);
}

export async function getSearchCount(params) {
    const cards = await searchCards(params);
    return cards.length;
}

export { QuerySanitizer };