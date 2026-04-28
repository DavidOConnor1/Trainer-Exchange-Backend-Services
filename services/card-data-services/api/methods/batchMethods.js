import { Query } from "@tcgdex/sdk";
import getTCGdexClient from "../tcgdexClient.js";

export class BatchMethods {
  constructor(cacheManager, retryHandler, logAPICall) {
    this.tcgdex = getTCGdexClient();
    this.cache = cacheManager;
    this.retryHandler = retryHandler;
    this.logAPICall = logAPICall;
  }

  // Get multiple cards by their SDK IDs
  async getCardsBatch(cardIds) {
    const startTime = Date.now();
    console.log(`📦 Batch fetching ${cardIds.length} cards...`);

    const results = await Promise.all(
      cardIds.map(async (id) => {
        try {
          const cacheKey = `card:${id}`;
          let card = this.cache.get(cacheKey);

          if (!card) {
            // FIX: Use card.get() instead of fetch('card', id)
            const cardData = await this.retryHandler.withRetry(
              async () => {
                return await this.tcgdex.card.get(id);
              },
              `batchCard(${id})`,
              { id },
            );

            // Store the raw card data in cache
            this.cache.set(cacheKey, cardData, 3600);
            card = cardData;
          }

          return {
            id,
            success: true,
            data: {
              id: card.id,
              localId: card.localId,
              name: card.name,
              set: card.set?.name,
              rarity: card.rarity,
            },
          };
        } catch (error) {
          console.log(`  ❌ Failed to fetch card ${id}: ${error.message}`);
          return { id, success: false, error: error.message };
        }
      }),
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(
      `✅ Batch complete: ${successful} successful, ${failed} failed (${duration}ms)`,
    );

    this.logAPICall("getCardsBatch", { cardIds }, true, successful);

    return {
      results,
      summary: {
        total: cardIds.length,
        successful,
        failed,
        duration: `${duration}ms`,
      },
    };
  }

  // Fetch full card details including pricing for multiple cards
  async fetchFullCardDetails(cardIds) {
    const results = await Promise.all(
      cardIds.map(async (cardId) => {
        const cacheKey = `full:card:${cardId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
          // FIX: Use card.get() instead of card.get
          const fullCard = await this.retryHandler.withRetry(
            async () => {
              return await this.tcgdex.card.get(cardId);
            },
            `fetchFullCardDetails(${cardId})`,
            { cardId },
          );

          this.cache.set(cacheKey, fullCard, 3600);
          return fullCard;
        } catch (error) {
          console.log(
            `  ❌ Failed to fetch full card ${cardId}: ${error.message}`,
          );
          return null;
        }
      }),
    );

    return results.filter((r) => r !== null);
  }

  // Get multiple cards by their localIds (searches across sets)
  async getCardsByLocalIdsBatch(localIds) {
    const startTime = Date.now();
    console.log(`📦 Batch fetching ${localIds.length} cards by localId...`);

    const results = await Promise.all(
      localIds.map(async (localId) => {
        try {
          const cacheKey = `card:localId:${localId}`;
          let cardData = this.cache.get(cacheKey);

          if (!cardData) {
            // FIX: Use proper Query syntax with card.list
            const query = Query.create()
              .equal("localId", localId)
              .paginate(1, 1);

            const cards = await this.retryHandler.withRetry(
              async () => {
                return await this.tcgdex.card.list(query);
              },
              `batchLocalId(${localId})`,
              { localId },
            );

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
              rarity: cardData.rarity,
            },
          };
        } catch (error) {
          console.log(
            `  ❌ Failed to fetch card with localId ${localId}: ${error.message}`,
          );
          return { localId, success: false, error: error.message };
        }
      }),
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(
      `✅ Batch by localId complete: ${successful} successful, ${failed} failed (${duration}ms)`,
    );

    this.logAPICall("getCardsByLocalIdsBatch", { localIds }, true, successful);

    return {
      results,
      summary: {
        total: localIds.length,
        successful,
        failed,
        duration: `${duration}ms`,
      },
    };
  }
}
