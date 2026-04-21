import getTCGdexClient from '../tcgdexClient.js';

export class BatchMethods {
    
    constructor(cacheManager, retryHandler, logAPICall) {
        this.tcgdex = getTCGdexClient();
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
    }

    // Get multiple cards by their SDK IDs
    async getCardsBatch(cardIds) {//start card batch
        const startTime = Date.now();
        console.log(`📦 Batch fetching ${cardIds.length} cards...`);
        
        const results = await Promise.all(
            cardIds.map(async (id, index) => {
                try {
                    const cacheKey = `card:${id}`;
                    let card = this.cache.get(cacheKey);
                    
                    if (!card) {
                        card = await this.retryHandler.withRetry(async () => {
                            const cardData = await this.tcgdex.fetch('card', id);
                            return cardData;
                        }, `batchCard(${id})`, { id });
                        
                        this.cache.set(cacheKey, card, 3600);
                    }
                    
                    return { 
                        id, 
                        success: true, 
                        data: {
                            id: card.id,
                            localId: card.localId,
                            name: card.name,
                            set: card.set?.name,
                            rarity: card.rarity
                        }
                    };
                } catch (error) {
                    console.log(`  ❌ Failed to fetch card ${id}: ${error.message}`);
                    return { id, success: false, error: error.message };
                }
            })
        );
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const duration = Date.now() - startTime;
        
        console.log(`✅ Batch complete: ${successful} successful, ${failed} failed (${duration}ms)`);
        
        this.logAPICall('getCardsBatch', { cardIds }, true, successful);
        
        return {
            results,
            summary: {
                total: cardIds.length,
                successful,
                failed,
                duration: `${duration}ms`
            }
        };
    }//end card batch

    // Fetch full card details including pricing for multiple cards
async fetchFullCardDetails(cardIds) { //start fetchcarddetails
    const results = await Promise.all(
        cardIds.map(async (cardId) => {
            const cacheKey = `full:card:${cardId}`;
            const cached = this.cache.get(cacheKey);
            if (cached) return cached;
            
            try {
                const fullCard = await this.retryHandler.withRetry(async () => {
                    return await this.tcgdex.card.get(cardId);
                }, `fetchFullCardDetails(${cardId})`, { cardId });
                
                this.cache.set(cacheKey, fullCard, 3600);
                return fullCard;
            } catch (error) {
                console.log(`  ❌ Failed to fetch full card ${cardId}: ${error.message}`);
                return null;
            }
        })
    );
    
    return results.filter(r => r !== null);
}//end fetch card details

    // Get multiple cards by their localIds (searches across sets)
    async getCardsByLocalIdsBatch(localIds) { //get cards in a batch via local id (identifier on the actual card)
        const startTime = Date.now();
        console.log(`📦 Batch fetching ${localIds.length} cards by localId...`);
        
        const results = await Promise.all(
            localIds.map(async (localId, index) => {
                try {
                    const cacheKey = `card:localId:${localId}`;
                    let cardData = this.cache.get(cacheKey);
                    
                    if (!cardData) {
                        const query = Query.create()
                            .equal('localId', localId)
                            .paginate(1, 1);
                        
                        const cards = await this.retryHandler.withRetry(async () => {
                            return await this.tcgdex.fetch('cards', { query });
                        }, `batchLocalId(${localId})`, { localId });
                        
                        if (!cards || cards.length === 0) {
                            throw new Error(`No card found with localId: ${localId}`);
                        }
                        
                        cardData = cards[0];
                        this.cache.set(cacheKey, cardData, 3600);
                    }
                    
                    return { 
                        localId, 
                        success: true, 
                        data: {
                            id: cardData.id,
                            localId: cardData.localId,
                            name: cardData.name,
                            set: cardData.set?.name,
                            rarity: cardData.rarity
                        }
                    };
                } catch (error) {
                    console.log(`  ❌ Failed to fetch card with localId ${localId}: ${error.message}`);
                    return { localId, success: false, error: error.message };
                }
            })
        );
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const duration = Date.now() - startTime;
        
        console.log(`✅ Batch by localId complete: ${successful} successful, ${failed} failed (${duration}ms)`);
        
        this.logAPICall('getCardsByLocalIdsBatch', { localIds }, true, successful);
        
        return {
            results,
            summary: {
                total: localIds.length,
                successful,
                failed,
                duration: `${duration}ms`
            }
        };
    }//end get cards by local id
}//end batch methods