export class RetryHandler {
    constructor(maxRetries = 3, retryDelay = 1000) {
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    async withRetry(fn, context, params, retries = this.maxRetries) {
        try {
            const startTime = Date.now();
            const result = await fn();
            const duration = Date.now() - startTime;
            console.log(`✅ ${context} successful (${duration}ms)`);
            return result;
        } catch (error) {
            console.log(`❌ ${context} failed: ${error.message}`);
            
            if (retries > 0 && !error.message.includes('Rate limit')) {
                const delay = this.retryDelay * (this.maxRetries - retries + 1);
                console.log(`🔄 Retrying in ${delay}ms... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(fn, context, params, retries - 1);
            }
            
            throw error;
        }
    }
}