export class RetryHandler {
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  shouldRetry(error) {
    const message = error.message || "";
    const statusCode = error.status || error.statusCode;

    // Never retry rate limits
    if (message.includes("Rate limit")) return false;

    // Never retry client errors (4xx)
    if (statusCode && statusCode >= 400 && statusCode < 500) return false;

    // Never retry data errors
    if (message.includes("Cannot read properties of null")) return false;
    if (message.includes("not found")) return false;
    if (message.toLowerCase().includes("no card")) return false;
    if (message.toLowerCase().includes("does not exist")) return false;

    // Only retry on server errors (5xx) or network issues
    return true;
  }

  async withRetry(fn, context, params, retries = this.maxRetries) {
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${context} successful (${duration}ms)`);
      return result;
    } catch (error) {
      console.log(`❌ ${context} failed:`, error.message, error.status);

      if (retries > 0 && this.shouldRetry(error)) {
        const baseDelay = this.retryDelay * (this.maxRetries - retries + 1);
        const jitter = baseDelay * (0.8 + Math.random() * 0.4); // ±20% jitter
        console.log(
          `🔄 Retrying in ${Math.round(jitter)}ms... (${retries} attempts left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, jitter));
        return this.withRetry(fn, context, params, retries - 1);
      }

      throw error;
    }
  }
}
