export class RequestDebouncer {
  constructor(delay = 300) {
    this.delay = delay;
    this.timers = new Map();
    this.pending = new Map();
    this.resolvers = new Map(); // store resolve functions
    this.rejecters = new Map(); // store reject functions
  }

  async debounce(key, fn) {
    // Clear existing timer (reset the debounce window)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // If there's no pending promise, create one and store its resolve/reject
    if (!this.pending.has(key)) {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      this.pending.set(key, promise);
      this.resolvers.set(key, resolve);
      this.rejecters.set(key, reject);
    }

    // Set a new timer that will resolve/reject the *existing* promise
    const timer = setTimeout(async () => {
      try {
        const result = await fn();
        const resolveFn = this.resolvers.get(key);
        if (resolveFn) resolveFn(result);
      } catch (error) {
        const rejectFn = this.rejecters.get(key);
        if (rejectFn) rejectFn(error);
      } finally {
        // Clean up
        this.timers.delete(key);
        this.pending.delete(key);
        this.resolvers.delete(key);
        this.rejecters.delete(key);
      }
    }, this.delay);
    this.timers.set(key, timer);

    // Return the same promise every time
    return this.pending.get(key);
  }
}
