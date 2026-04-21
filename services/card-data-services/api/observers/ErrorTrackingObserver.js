export class ErrorTrackingObserver {
    constructor() {
        this.errors = [];
    }

    apiCallError(data) {
        this.errors.push({
            ...data,
            type: 'API_ERROR'
        });
    }

    unhandledError(data) {
        this.errors.push({
            ...data,
            type: 'UNHANDLED_ERROR'
        });
    }

    getErrors() {
        return this.errors;
    }

    clearErrors() {
        this.errors = [];
    }
}