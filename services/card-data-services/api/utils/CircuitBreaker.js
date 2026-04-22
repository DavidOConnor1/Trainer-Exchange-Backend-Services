export class CircuitBreaker {
    constructor(failureThreshold = 5, timeout = 60000) {
        this.failureThreshold = failureThreshold; // 5 failures
        this.timeout = timeout; // 60 seconds
        this.failures = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async call(fn, ...args) {
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
                console.log('🔓 Circuit breaker: HALF_OPEN - testing connection');
            } else {
                throw new Error('Circuit breaker is OPEN. Service unavailable.');
            }
        }

        try {
            const result = await fn(...args);
            if (this.state === 'HALF_OPEN') {
                this.reset();
                console.log('✅ Circuit breaker: CLOSED - service restored');
            }
            return result;
        } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            
            if (this.failures >= this.failureThreshold) {
                this.state = 'OPEN';
                console.log('🔴 Circuit breaker: OPEN - service failing');
            }
            throw error;
        }
    }

    reset() {
        this.failures = 0;
        this.state = 'CLOSED';
        this.lastFailureTime = null;
    }

    getState() {
        return this.state;
    }
}