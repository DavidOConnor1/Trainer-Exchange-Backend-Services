export class OptimizedCache {
    constructor(ttl = 300, maxSize = 500) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.hits = 0;
        this.misses = 0;
    }

    async getOrSet(key, fetcher, ttl = null) {
        const cached = this.get(key);
        if (cached !== undefined) {
            this.hits++;
            return cached;
        }
        
        this.misses++;
        const value = await fetcher();
        this.set(key, value, ttl);
        return value;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return undefined;
        
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        
        return item.value;
    }

    set(key, value, ttl = null) {
        // LRU eviction
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ((ttl || this.ttl) * 1000)
        });
    }

    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%'
        };
    }
}