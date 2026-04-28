import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { SetMethods } from "../../../api/methods/setMethods.js";

describe("SetMethods", () => {
  let setMethods;
  let mockTCGdexClient;
  let mockCacheManager;
  let mockRetryHandler;
  let mockLogAPICall;

  beforeEach(() => {
    mockTCGdexClient = {
      fetch: jest.fn(),
      set: {
        get: jest.fn(),
      },
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

    setMethods = new SetMethods(
      mockCacheManager,
      mockRetryHandler,
      mockLogAPICall,
    );
    setMethods.tcgdex = mockTCGdexClient;
  });

  describe("getAllSets", () => {
    it("should return all sets with series information", async () => {
      const mockSet = {
        id: "swsh3",
        name: "Rebel Clash",
        serie: { id: "swsh", name: "Sword & Shield", logoUrl: "url" },
        releaseDate: "2020-05-01",
        total: 200,
        cardCount: { total: 200, official: 200 },
        logoUrl: "logo-url",
        symbolUrl: "symbol-url",
        legalities: { standard: "Legal" },
      };

      // Mock the fetch response to return an array of sets
      mockTCGdexClient.fetch.mockResolvedValue([mockSet]);

      const result = await setMethods.getAllSets();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Rebel Clash");
      expect(result[0].series.name).toBe("Sword & Shield");
      expect(mockTCGdexClient.fetch).toHaveBeenCalledWith("sets");
    });

    it("should return cached data when available", async () => {
      const cachedSets = [{ id: "swsh3", name: "Cached Set" }];
      mockCacheManager.get.mockReturnValue(cachedSets);

      const result = await setMethods.getAllSets();

      expect(result[0].name).toBe("Cached Set");
      expect(mockTCGdexClient.fetch).not.toHaveBeenCalled();
    });
  });

  describe("getSetById", () => {
    it("should return a specific set by ID", async () => {
      const mockSet = { id: "swsh3", name: "Rebel Clash", totalCards: 200 };
      mockTCGdexClient.set.get.mockResolvedValue(mockSet);

      const result = await setMethods.getSetById("swsh3");

      expect(result.name).toBe("Rebel Clash");
      expect(mockTCGdexClient.set.get).toHaveBeenCalledWith("swsh3");
    });
  });

  describe("getCardsBySet", () => {
    it("should return paginated cards for a set", async () => {
      const mockCardResume = {
        getCard: jest.fn().mockResolvedValue({
          id: "swsh3-136",
          localId: "136",
          name: "Furret",
          number: "136",
          getImageURL: () => "image-url",
          types: ["Colorless"],
          hp: 90,
          rarity: "Rare",
        }),
      };

      const mockSet = {
        id: "swsh3",
        name: "Rebel Clash",
        total: 200,
        cards: [mockCardResume],
      };

      mockTCGdexClient.set.get.mockResolvedValue(mockSet);

      const result = await setMethods.getCardsBySet("swsh3", 1, 1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Furret");
      expect(result.hasMore).toBe(false);
    });

    it("should handle pagination correctly", async () => {
      const mockCardResumes = Array(25)
        .fill()
        .map((_, i) => ({
          getCard: jest.fn().mockResolvedValue({
            id: `card-${i}`,
            localId: String(i),
            name: `Card ${i}`,
            number: String(i),
            getImageURL: () => "image-url",
            types: [],
            hp: 60,
            rarity: "Common",
          }),
        }));

      const mockSet = {
        id: "swsh3",
        name: "Rebel Clash",
        total: 200,
        cards: mockCardResumes,
      };

      mockTCGdexClient.set.get.mockResolvedValue(mockSet);

      // Page 1 of 20
      const result1 = await setMethods.getCardsBySet("swsh3", 1, 20);
      expect(result1.data).toHaveLength(20);
      expect(result1.hasMore).toBe(true);

      // Page 2 of 20
      const result2 = await setMethods.getCardsBySet("swsh3", 2, 20);
      expect(result2.data).toHaveLength(5);
      expect(result2.hasMore).toBe(false);
    });
  });
});
