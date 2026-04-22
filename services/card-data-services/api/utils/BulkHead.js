export class Bulkhead {
    constructor(name, maxConcurrent = 10, maxQueue = 20) {
        this.name = name;
        this.maxConcurrent = maxConcurrent;
        this.maxQueue = maxQueue;
        this.active = 0;
        this.queue = [];
    }

    async execute(fn) {
        if (this.active >= this.maxConcurrent) {
            if (this.queue.length >= this.maxQueue) {
                throw new Error(`Bulkhead ${this.name} queue full`);
            }
            
            return new Promise((resolve, reject) => {
                this.queue.push({ fn, resolve, reject });
            });
        }

        return this.run(fn);
    }

    async run(fn) {
        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            this.processQueue();
        }
    }

    processQueue() {
        if (this.queue.length > 0 && this.active < this.maxConcurrent) {
            const { fn, resolve, reject } = this.queue.shift();
            this.run(fn).then(resolve).catch(reject);
        }
    }

    getStats() {
        return {
            name: this.name,
            active: this.active,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent
        };
    }
}