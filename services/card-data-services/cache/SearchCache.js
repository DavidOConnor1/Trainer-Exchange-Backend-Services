
class SearchCache {
    constructor() {
        this.cache = new Map();
        this.maxAge = 5 * 60 * 1000; // 5 minutes
    }//end constructor
    
    getKey(params) {
        return JSON.stringify(params);
    }//end get key
    
    get(params) {
        const key = this.getKey(params);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.maxAge) {
            console.log('Returning from search cache');
            return cached.data;
        }//end if
        
        return null;
    }//end get
    
    set(params, data) {
        const key = this.getKey(params);
        this.cache.set(key, {
            timestamp: Date.now(),
            data: data
        });
        
        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }//end if
    }//end set
}//end search cache

// Create a singleton instance
const searchCache = new SearchCache();

export default searchCache;