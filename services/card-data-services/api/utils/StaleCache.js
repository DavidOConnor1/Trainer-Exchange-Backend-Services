export class StaleWhileRevalidateCache {
    constructor(ttl = 300, staleTtl = 3600) {
        this.cache = new Map();
        this.ttl = ttl; // Fresh data TTL
        this.staleTtl = staleTtl; // Stale data TTL
    }

    async getOrSet(key, fetcher) {
        const cached = this.cache.get(key);
        const now = Date.now();
        
        if (cached) {
            const age = now - cached.timestamp;
            
            // Still fresh
            if (age < this.ttl * 1000) {
                return cached.value;
            }
            
            // Stale but still usable - revalidate in background
            if (age < this.staleTtl * 1000) {
                this.revalidate(key, fetcher);
                return cached.value;
            }
        }
        
        // Expired or not found - fetch fresh
        const value = await fetcher();
        this.set(key, value);
        return value;
    }

    async revalidate(key, fetcher) {
        try {
            const value = await fetcher();
            this.set(key, value);
            console.log(`🔄 Revalidated cache for: ${key}`);
        } catch (error) {
            console.log(`⚠️ Failed to revalidate cache for: ${key}`);
        }
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }
}