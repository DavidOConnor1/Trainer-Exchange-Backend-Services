import NodeCache from 'node-cache';

export class CacheManager {
    constructor(ttl = 300, maxKeys = 500) {
        this.cache = new NodeCache({ 
            stdTTL: ttl,
            checkperiod: 60,
            maxKeys: maxKeys
        });
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, data, ttl = null) {
        if (ttl) {
            this.cache.set(key, data, ttl);
        } else {
            this.cache.set(key, data);
        }
    }

    has(key) {
        return this.cache.has(key);
    }

    clear() {
        const size = this.cache.keys().length;
        this.cache.flushAll();
        return size;
    }

    getStats() {
        return {
            size: this.cache.keys().length,
            keys: this.cache.keys(),
            stats: this.cache.getStats()
        };
    }
}