// Import function to get the shared TCGdex client instance (singleton pattern)
import getTCGdexClient from '../tcgdexClient.js';

export class RandomMethods {
    /**
     * Constructor - Initializes random methods with dependencies
     * @param {Object} cacheManager - Handles caching of API responses
     * @param {Object} retryHandler - Handles retry logic for failed API calls
     * @param {Function} logAPICall - Logs API calls for monitoring
     */
    constructor(cacheManager, retryHandler, logAPICall) {
        // Get the shared TCGdex client instance
        this.tcgdex = getTCGdexClient();
        this.cache = cacheManager;
        this.retryHandler = retryHandler;
        this.logAPICall = logAPICall;
    }

    /**
     * Get a single random card from the entire TCGdex database
     * Uses the SDK's built-in random card endpoint
     */
    async getRandomCard() {
        try {
            // Use retry handler to automatically retry on failure
            const randomCard = await this.retryHandler.withRetry(async () => {
                // SDK method that returns a completely random card
                return await this.tcgdex.random.card();
            }, 'getRandomCard', {});
            
            // Log successful API call for monitoring
            this.logAPICall('getRandomCard', {}, true, 1);
            return randomCard;
        } catch (error) {
            // Log failed API call
            this.logAPICall('getRandomCard', {}, false, 0, error);
            throw error;
        }
    }//end get random card

     //Get a single random set from all available Pokémon TCG sets 
    async getRandomSet() {
        try {
            const randomSet = await this.retryHandler.withRetry(async () => {
                // SDK method that returns a random card set
                return await this.tcgdex.random.set();
            }, 'getRandomSet', {});
            
            this.logAPICall('getRandomSet', {}, true, 1);
            return randomSet;
        } catch (error) {
            this.logAPICall('getRandomSet', {}, false, 0, error);
            throw error;
        }
    }

    /**
     * Get a single random serie from all available series
     * A serie is a collection of sets (e.g., "Sword & Shield", "Scarlet & Violet")
     */
    async getRandomSerie() {
        try {
            const randomSerie = await this.retryHandler.withRetry(async () => {
                // SDK method that returns a random card serie
                return await this.tcgdex.random.serie();
            }, 'getRandomSerie', {});
            
            this.logAPICall('getRandomSerie', {}, true, 1);
            return randomSerie;
        } catch (error) {
            this.logAPICall('getRandomSerie', {}, false, 0, error);
            throw error;
        }
    }

    /**
     * Get multiple random cards with optional uniqueness constraint
     * Useful for generating a list of random cards for testing or discovery features
     */
    async getMultipleRandomCards(count = 5, unique = true) {
        // Array to store the collected random cards
        const randomCards = [];
        
        // Set to track card IDs we've already collected (for uniqueness)
        const usedIds = new Set();
        
        // Track number of attempts to prevent infinite loop if API keeps returning duplicates
        let attempts = 0;
        
        // Maximum attempts = requested count * 4 (gives 4 chances per card needed)
        const maxAttempts = count * 4;
        
        // Continue until we have enough cards or hit max attempts
        while (randomCards.length < count && attempts < maxAttempts) {
            attempts++;
            
            // Fetch a random card using the method above
            const randomCard = await this.getRandomCard();
            
            // Check if we got a valid card
            if (randomCard && randomCard.id) {
                // If we need unique cards, check if we've already seen this ID
                if (!unique || !usedIds.has(randomCard.id)) {
                    // If tracking uniqueness, add this ID to our set
                    if (unique) usedIds.add(randomCard.id);
                    // Add the card to our results array
                    randomCards.push(randomCard);
                }
                // If duplicate found and unique=true, we skip it and continue
            }
            // If invalid card, continue loop to try again
        }
        
        // Return the collected cards (may be fewer than requested if max attempts reached)
        return randomCards;
    }
}//end random methods