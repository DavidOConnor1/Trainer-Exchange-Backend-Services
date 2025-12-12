import { pokemonAPI } from "../api/APIClient.js";  
import searchCache from "../cache/SearchCache.js";

// Query Sanitization
export class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        const sanitized = input.replace(/[^a-zA-Z0-9\s\-']/g, '');
        return sanitized.trim().slice(0, 100);
    }//end sanitize String

    static sanitizeQueryObject(params) {  
        if (!params || typeof params !== 'object') return {};
        const sanitized = {};
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'number') {
                sanitized[key] = isFinite(value) ? value : 0;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'string' ? this.sanitizeString(item) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeQueryObject(value);
            } else {
                sanitized[key] = value;
            }//end elese
        }//end for
        return sanitized;
    }//end sanitize obj

    static validateCardName(name) {
        if (!name || typeof name !== 'string') return null;
        const sanitizedName = this.sanitizeString(name);
        if (!sanitizedName.trim()) return null;
        if (sanitizedName.length > 30) return null;
        return sanitizedName;
    }//end validate card name
}//end query sanitizer

/**
 * Builds a proper q parameter for Pokemon TCG API
 */
function buildQueryString(params = {}) {
    const queryParts = [];
    
    // Handle name search - USE WILDCARD BY DEFAULT
    if (params.name) {
        const name = params.name.trim();
        queryParts.push(`name:${name}*`);
    }//end if
    
    // Handle type search
    if (params.type) {
        queryParts.push(`types:${params.type}`);
    }//end if
    
    // Handle set search
    if (params.set) {
        queryParts.push(`set.name:${params.set}*`);
    }//end if
    
    // Handle rarity search
    if (params.rarity) {
        queryParts.push(`rarity:${params.rarity}`);
    }//end if
    
    // Handle HP search (numeric)
    if (params.hp) {
        queryParts.push(`hp:${params.hp}`);
    }//end if
    
    // Handle direct q parameter
    if (params.q) {
        if (queryParts.length > 0) {
            queryParts.push(params.q);
        } else {
            return params.q;
        }//end else
    }//end if
    
    if (queryParts.length === 0) {
        return '';
    }//end if
    
    return queryParts.join(' ');
}//end query builder

/**
 Search function
 */
export async function searchCards(params = {}, options = {}) {
    try {
        //cache key
          const cacheKey = { params, options };
        const cached = searchCache.get(cacheKey);
        if (cached) {
            return cached;
        }//end if


        // Handle string input (simple name search)
        if (typeof params === 'string') {
            const sanitizedName = QuerySanitizer.validateCardName(params);
            if (!sanitizedName) return [];
            
            params = { name: sanitizedName };
        }
        
        // Sanitize all parameters
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
        
        // Build the query string for external API
        const queryString = buildQueryString(sanitizedParams);
        
        // Prepare API parameters - ONLY q, page, pageSize, orderBy
        const apiParams = {
            page: Math.max(1, options.page || sanitizedParams.page || 1),
            pageSize: Math.min(10, Math.max(1, options.pageSize || sanitizedParams.pageSize || 10)),
            orderBy: options.orderBy || sanitizedParams.orderBy || 'name'
        };
        
        
        if (queryString.trim()) {
            apiParams.q = queryString;
        }//end if
        
        console.log('Search Details:');
        console.log('Input params:', sanitizedParams);
        console.log('Built query:', queryString);
        console.log('API params:', apiParams);
        
        // Make the API call
        const result = await pokemonAPI.fetchCards(apiParams);
        
        
        // We need to extract the data array
        let cards = [];
        if (result && typeof result === 'object') {
            if (Array.isArray(result.data)) {
                cards = result.data;
            } else if (Array.isArray(result)) {
                cards = result;
            }//end else if 
        }//end if
        
        console.log(`Found ${cards.length} cards`);
        searchCache.set(cacheKey, cards);
        return cards;
        
    } catch (error) {
        console.error('Search error:', error.message);
        return [];
    }//end catch
}//end search

// Keep these for backward compatibility
export async function searchCardsPaginated(query, page = 1, pageSize = 20) {
    return searchCards(query, { page, pageSize });
}

export async function searchCardsByName(name, options = {}) {
    return searchCards({ name }, options);
}

export async function searchCardsByType(type, options = {}) {
    return searchCards({ type }, options);
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