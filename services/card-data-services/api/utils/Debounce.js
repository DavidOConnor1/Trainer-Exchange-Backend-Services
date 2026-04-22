export class RequestDebouncer {
    constructor(delay = 300) {
        this.delay = delay;
        this.timers = new Map();
        this.pending = new Map();
    }

    async debounce(key, fn) {
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        const promise = new Promise((resolve, reject) => {
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
            }

            this.timers.set(key, setTimeout(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.timers.delete(key);
                    this.pending.delete(key);
                }
            }, this.delay));
        });

        this.pending.set(key, promise);
        return promise;
    }
}