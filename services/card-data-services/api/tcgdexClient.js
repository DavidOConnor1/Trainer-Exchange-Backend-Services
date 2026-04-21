import TCGdex from '@tcgdex/sdk';

let tcgdexInstance = null;

export function getTCGdexClient() {
    if (!tcgdexInstance) {
        tcgdexInstance = new TCGdex('en');
        tcgdexInstance.setCacheTTL(3600);
        console.log('✅ TCGdex client initialized');
    }
    return tcgdexInstance;
}

export default getTCGdexClient;