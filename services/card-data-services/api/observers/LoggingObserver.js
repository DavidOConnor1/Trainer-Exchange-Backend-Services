export class LoggingObserver {
    apiCallStart(data) {
        console.log(`[${data.timestamp}] API Call Started: ${data.endpoint}`);
    }

    apiCallSuccess(data) {
        console.log(`[${data.timestamp}] API Call Successful: ${data.endpoint} (${data.dataSize} items)`);
    }

    apiCallError(data) {
        console.error(`[${data.timestamp}] API Call Failed: ${data.endpoint} - ${data.error}`);
    }

    cacheHit(data) {
        console.log(`[${data.timestamp}] Cache Hit: ${data.endpoint}`);
    }

    cacheCleared(data) {
        console.log(`[${data.timestamp}] Cache Cleared: ${data.cacheSize} items removed`);
    }
}