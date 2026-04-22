export class TokenBucket {
    constructor(capacity = 100, refillRate = 10, refillInterval = 1000) {
        this.capacity = capacity; // Maximum tokens
        this.tokens = capacity; // Current tokens
        this.refillRate = refillRate; // Tokens added per interval
        this.refillInterval = refillInterval; // Interval in ms
        this.lastRefill = Date.now();
    }

    async consume(tokens = 1) {
        this.refill();
        
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        
        // Calculate wait time for next token
        const waitTime = ((tokens - this.tokens) / this.refillRate) * this.refillInterval;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.consume(tokens);
    }

    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const refillAmount = Math.floor(timePassed / this.refillInterval) * this.refillRate;
        
        if (refillAmount > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
            this.lastRefill = now;
        }
    }

    getTokens() {
        this.refill();
        return this.tokens;
    }

    reset() {
        this.tokens = this.capacity;
        this.lastRefill = Date.now();
    }
}