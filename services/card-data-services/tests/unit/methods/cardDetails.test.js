import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { CardDetailsMethods } from "../../../api/methods/cardDetails.js";

describe("CardDetailsMethods", () => {
  let cardDetails;
  let mockTCGdexClient;
  let mockCacheManager;
  let mockRetryHandler;
  let mockLogAPICall;
  let mockPricingMethods;

  beforeEach(() => {
    mockTCGdexClient = {
      fetch: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockRetryHandler = {
      withRetry: jest.fn(),
    };

    mockLogAPICall = jest.fn();
    mockPricingMethods = {
      extractCardmarketPricing: jest.fn(),
      getCurrentPrice: jest.fn(),
      getCurrentHoloPrice: jest.fn(),
    };

    mockRetryHandler.withRetry.mockImplementation(async (fn) => fn());

    // Constructor order: (tcgdex, cacheManager, retryHandler, logAPICall, pricingMethods)
    cardDetails = new CardDetailsMethods(
      mockTCGdexClient,
      mockCacheManager,
      mockRetryHandler,
      mockLogAPICall,
      mockPricingMethods,
    );
  });

  describe("getCardById", () => {
    it("should return full card details with pricing", async () => {
      const mockCardData = {
        id: "swsh3-136",
        localId: "136",
        name: "Furret",
        category: "Pokemon",
        set: { id: "swsh3" },
        getImageURL: (quality, format) =>
          `https://example.com/${quality}.${format}`,
        images: { small: "small.jpg", large: "large.jpg" },
        types: ["Colorless"],
        hp: 90,
        rarity: "Rare",
        artist: "Test Artist",
        flavorText: "A cute pokemon",
      };

      const mockSet = {
        id: "swsh3",
        name: "Rebel Clash",
        serie: { id: "swsh", name: "Sword & Shield" },
        releaseDate: "2020-05-01",
        total: 200,
        logoUrl: "logo.png",
        symbolUrl: "symbol.png",
      };

      const mockSerie = {
        id: "swsh",
        name: "Sword & Shield",
        logoUrl: "serie-logo.png",
      };
      const mockPricing = { avg30: 0.5, trend: 0.55 };

      mockTCGdexClient.fetch
        .mockResolvedValueOnce(mockCardData)
        .mockResolvedValueOnce(mockSet)
        .mockResolvedValueOnce(mockSerie);

      mockPricingMethods.extractCardmarketPricing.mockReturnValue(mockPricing);
      mockPricingMethods.getCurrentPrice.mockReturnValue(0.5);
      mockPricingMethods.getCurrentHoloPrice.mockReturnValue(null);

      mockCacheManager.get.mockReturnValue(undefined);

      const result = await cardDetails.getCardById("swsh3-136");

      expect(result.id).toBe("swsh3-136");
      expect(result.name).toBe("Furret");
      expect(result.localId).toBe("136");
      expect(result.currentPrice).toBe(0.5);
    });

    it("should return cached card when available", async () => {
      const cachedCard = { id: "swsh3-136", name: "Cached Furret" };
      mockCacheManager.get.mockReturnValue(cachedCard);

      const result = await cardDetails.getCardById("swsh3-136");

      expect(result.name).toBe("Cached Furret");
      expect(mockTCGdexClient.fetch).not.toHaveBeenCalled();
    });

    it("should handle cards without images", async () => {
      const mockCardData = {
        id: "old-card-001",
        localId: "001",
        name: "Old Card",
        category: "Pokemon",
        set: { id: "base1" },
        images: null, // No images object
        types: [],
        hp: 60,
        getImageURL: null, // No getImageURL method
      };

      const mockSet = {
        id: "base1",
        name: "Base Set",
        serie: null,
        releaseDate: "1999-01-01",
        total: 102,
        logoUrl: null,
        symbolUrl: null,
      };

      mockTCGdexClient.fetch
        .mockResolvedValueOnce(mockCardData)
        .mockResolvedValueOnce(mockSet);

      mockPricingMethods.extractCardmarketPricing.mockReturnValue(null);
      mockPricingMethods.getCurrentPrice.mockReturnValue(null);
      mockPricingMethods.getCurrentHoloPrice.mockReturnValue(null);

      mockCacheManager.get.mockReturnValue(undefined);

      const result = await cardDetails.getCardById("old-card-001");

      expect(result.name).toBe("Old Card");
      expect(result.images).toBeDefined();
      // When no images exist, these will be undefined (not null)
      expect(result.images.high).toBeUndefined();
      expect(result.images.low).toBeUndefined();
      expect(result.images.original).toBeUndefined();
      expect(result.images.small).toBeUndefined();
    });
  });
});
