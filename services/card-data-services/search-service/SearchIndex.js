import { pokemonAPI } from "../api/APIClient.js";  

// Query Sanitization to prevent any sort of attacks on the system

export class QuerySanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string') {
            return '';
        }//end if

       
        // Allow letters, numbers, spaces, hyphens, and apostrophes
        const sanitized = input.replace(/[^a-zA-Z0-9\s\-']/g, '');

        // trim and limit length
        return sanitized.trim().slice(0, 100);
    } // end sanitizeString

    // sanitize objects
    static sanitizeQueryObject(params) {  
        const sanitized = {};
        
        // Handle null/undefined params
        if (!params || typeof params !== 'object') {
            return sanitized;
        }
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'number') {
                sanitized[key] = isFinite(value) ? value : 0;  // Handle NaN/Infinity
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'string' ? this.sanitizeString(item) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizeQueryObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    } // end sanitizeQueryObject

    static validateCardName(name) {
        if (!name || typeof name !== 'string') return null;  

        // simple validation for card names
        const sanitizedName = this.sanitizeString(name);  

        // ensure name does not return blank
        if (!sanitizedName.trim()) return null;

        // check the length
        if (sanitizedName.length > 30) return null;

        return sanitizedName;
    } // end validateCardName
} // end query sanitizer


export async function searchCards(params) {
    // If params is a string, perform simple search
    if (typeof params === 'string') {
        const sanitized = QuerySanitizer.validateCardName(params);
    
        if (!sanitized) {
            console.warn(`Invalid Search Query: ${params}`);
            return [];
        }//end
    
        try {
            const result = await pokemonAPI.fetchCards({
                q: `name:${sanitized}*`,  // wildcard 
                pageSize: 50  // Increased from 20 for better results
            });
            return Array.isArray(result) ? result : [];
        } catch (error) {
            // Fixed variable name from sanitizedName to sanitized
            console.error(`Error searching for "${sanitized}":`, error);
            return [];
        }//end catch
    }//end searchCards

    // If params is an object, perform advanced search
    if (typeof params === 'object' && params !== null) {
        // First sanitize the input params
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(params);
        
        // Set defaults
        const searchParams = {
            page: 1,
            pageSize: 20,
            orderBy: 'name',
            ...sanitizedParams
        };

        
        try {
            const result = await pokemonAPI.fetchCards(searchParams);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            console.error('Error with the advanced search: ', error, { params: searchParams });
            return [];
        }//end catch
    }//end if

    // Invalid input, return nothing
    console.warn('Invalid search params: ', params);
    return [];
} // end searchCards

// Helps with paginated searches
export async function searchCardsPaginated(params, page = 1, pageSize = 20) {
    const searchParams = typeof params === 'string'
        ? { q: `name:${QuerySanitizer.validateCardName(params) || ''}*` }
        : QuerySanitizer.sanitizeQueryObject(params);

    // Use our main searchCards function with pagination
    return searchCards({
        ...searchParams,
        page: Math.max(1, page),
        pageSize: Math.min(100, Math.max(1, pageSize))
    });
} // end function

// Get total amount of cards for matching search
export async function getSearchCount(params) {
    const cards = await searchCards(params);
    return cards.length;
} // end function



export async function searchCardsByName(name, options = {}) {
    const sanitizedName = QuerySanitizer.validateCardName(name);
    if (!sanitizedName) return [];
    
    return searchCards({
        q: `name:${sanitizedName}*`,
        ...options
    });
}//end

export async function searchCardsByType(type, options = {}) {
    const sanitizedType = QuerySanitizer.sanitizeString(type);
    if (!sanitizedType) return [];
    
    return searchCards({
        q: `types:${sanitizedType}`,
        ...options
    });
}//end

export async function searchCardsBySet(setName, options = {}) {
    const sanitizedSet = QuerySanitizer.sanitizeString(setName);
    if (!sanitizedSet) return [];
    
    return searchCards({
        q: `set.name:${sanitizedSet}*`,
        ...options
    });
}//end search by set

// Get cards with multiple criteria
export async function searchByMultipleCriteria(criteria = {}) {
    const queryParts = [];
    const { name, type, set, rarity, ...otherParams } = criteria;
    
    if (name) {
        const sanitizedName = QuerySanitizer.validateCardName(name);
        if (sanitizedName) queryParts.push(`name:${sanitizedName}*`);
    }//end
    
    if (type) {
        const sanitizedType = QuerySanitizer.sanitizeString(type);
        if (sanitizedType) queryParts.push(`types:${sanitizedType}`);
    }//end
    
    if (set) {
        const sanitizedSet = QuerySanitizer.sanitizeString(set);
        if (sanitizedSet) queryParts.push(`set.name:${sanitizedSet}*`);
    }//end
    
    if (rarity) {
        const sanitizedRarity = QuerySanitizer.sanitizeString(rarity);
        if (sanitizedRarity) queryParts.push(`rarity:${sanitizedRarity}`);
    }//end 
    
    if (queryParts.length === 0) return [];
    
    return searchCards({
        q: queryParts.join(' '),
        ...otherParams
    });
}//end search