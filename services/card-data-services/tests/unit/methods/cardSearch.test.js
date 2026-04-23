import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Mock the cardPricing module BEFORE importing CardSearchMethods
jest.unstable_mockModule("../../../api/methods/cardPricing.js", () => ({
  CardPricingMethods: jest.fn().mockImplementation(function () {
    return {
      fetchCardWithPricing: jest.fn().mockResolvedValue({
        pricing: { avg30: 0.5, trend: 0.55 },
        hasPricing: true,
      }),
    };
  }),
}));

// Mock the tcgdexClient
jest.unstable_mockModule("../../../api/tcgdexClient.js", () => ({
  default: jest.fn().mockReturnValue({
    card: { list: jest.fn(), get: jest.fn() },
    set: { get: jest.fn() },
  }),
}));

// Now import the module
const { CardSearchMethods } = await import(
  "../../../api/methods/cardSearch.js"
);

describe("CardSearchMethods", () => {
  let cardSearch;
  let mockTCGdexClient;
  let mockCacheManager;
  let mockRetryHandler;
  let mockLogAPICall;

  beforeEach(() => {
    mockTCGdexClient = {
      card: { list: jest.fn(), get: jest.fn() },
      set: { get: jest.fn() },
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockRetryHandler = {
      withRetry: jest.fn(),
    };

    mockLogAPICall = jest.fn();

    mockRetryHandler.withRetry.mockImplementation(async (fn) => fn());

    cardSearch = new CardSearchMethods(
      mockCacheManager,
      mockRetryHandler,
      mockLogAPICall,
    );
    cardSearch.tcgdex = mockTCGdexClient;

    // Override the pricing methods that were created in the constructor
    cardSearch.pricingMethods = {
      fetchCardWithPricing: jest.fn().mockResolvedValue({
        pricing: { avg30: 0.5, trend: 0.55 },
        hasPricing: true,
      }),
    };
  });

  describe("getCardByLocalId", () => {
    it("should fetch card by localId successfully", async () => {
      const mockCardResume = {
        getCard: jest.fn().mockResolvedValue({
          id: "swsh3-136",
          name: "Furret",
          localId: "136",
        }),
      };
      mockTCGdexClient.card.list.mockResolvedValue([mockCardResume]);

      const result = await cardSearch.getCardByLocalId("136");

      expect(result.name).toBe("Furret");
    });

    it("should throw error when card not found", async () => {
      mockTCGdexClient.card.list.mockResolvedValue([]);

      await expect(cardSearch.getCardByLocalId("999")).rejects.toThrow(
        "No card found with localId: 999",
      );
    });
  });

  describe("searchCards", () => {
    it("should search cards with name filter", async () => {
      // Create mock set with getSerie method
      const mockSet = {
        id: "sv09",
        name: "Journey Together",
        getSerie: jest.fn().mockResolvedValue({
          id: "sv09",
          name: "Scarlet & Violet",
        }),
      };

      // Create mock full card with getSet method
      const mockFullCard = {
        id: "sv09-119",
        name: "Furret",
        localId: "199",
        set: { id: "sv09", name: "Journey Together" },
        types: ["Colorless"],
        hp: 120,
        getSet: jest.fn().mockResolvedValue(mockSet),
        getImageURL: jest.fn().mockReturnValue("image-url"),
        images: { small: "small.jpg", large: "large.jpg" },
      };

      const mockCardResume = {
        id: "sv09-119",
        getCard: jest.fn().mockResolvedValue(mockFullCard),
      };

      mockTCGdexClient.card.list.mockResolvedValue([mockCardResume]);

      const result = await cardSearch.searchCards({
        name: "Furret",
        pageSize: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Furret");
    });
  });

  describe("getCardsByType", () => {
    it("should fetch cards by type", async () => {
      const mockCardResume = {
        getCard: jest.fn().mockResolvedValue({
          id: "card1",
          name: "Fire Pokemon",
          types: ["Fire"],
        }),
      };
      mockTCGdexClient.card.list.mockResolvedValue([mockCardResume]);

      const result = await cardSearch.getCardsByType("Fire");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Fire Pokemon");
    });
  });
});
