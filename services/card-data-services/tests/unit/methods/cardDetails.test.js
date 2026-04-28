import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { CardDetailsMethods } from "../../../api/methods/cardDetails.js";

describe("CardDetailsMethods", () => {
  let cardDetails;
  let mockCacheManager;
  let mockRetryHandler;
  let mockLogAPICall;
  let mockPricingMethods;

  beforeEach(() => {
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

    cardDetails = new CardDetailsMethods(
      mockCacheManager,
      mockRetryHandler,
      mockLogAPICall,
      mockPricingMethods,
    );
  });

  describe("enrichCardData", () => {
    it("should return full card details with pricing", async () => {
      const mockCardData = {
        id: "swsh3-136",
        localId: "136",
        name: "Furret",
        category: "Pokemon",
        getImageURL: (quality, format) =>
          `https://example.com/${quality}.${format}`,
        images: { small: "small.jpg", large: "large.jpg" },
        getSet: jest.fn().mockResolvedValue({
          id: "swsh3",
          name: "Rebel Clash",
          getSerie: jest.fn().mockResolvedValue({
            id: "swsh",
            name: "Sword & Shield",
            logoUrl: "serie-logo.png",
          }),
          releaseDate: "2020-05-01",
          total: 200,
          logoUrl: "logo.png",
          symbolUrl: "symbol.png",
        }),
      };

      const mockPricing = { avg30: 0.5, trend: 0.55 };

      mockPricingMethods.extractCardmarketPricing.mockReturnValue(mockPricing);
      mockPricingMethods.getCurrentPrice.mockReturnValue(0.5);
      mockPricingMethods.getCurrentHoloPrice.mockReturnValue(null);

      const result = await cardDetails.enrichCardData(mockCardData);

      expect(result.id).toBe("swsh3-136");
      expect(result.name).toBe("Furret");
      expect(result.currentPrice).toBe(0.5);
    });
  });
});
