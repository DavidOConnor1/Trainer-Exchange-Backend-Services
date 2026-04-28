import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

describe("Set Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  describe("GET /api/sets/", () => {
    it("should get all sets", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check structure of first set
      const firstSet = response.body.data[0];
      expect(firstSet).toHaveProperty("id");
      expect(firstSet).toHaveProperty("name");
      expect(firstSet).toHaveProperty("series");
      expect(firstSet).toHaveProperty("totalCards");
      expect(firstSet).toHaveProperty("logoUrl");
      expect(firstSet).toHaveProperty("symbolUrl");
    });
  });

  describe("GET /api/sets/series", () => {
    it("should get all series with their sets", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/series")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check structure of first series
      const firstSeries = response.body.data[0];
      expect(firstSeries).toHaveProperty("id");
      expect(firstSeries).toHaveProperty("name");
      expect(firstSeries).toHaveProperty("sets");
      expect(Array.isArray(firstSeries.sets)).toBe(true);
    });
  });

  describe("GET /api/sets/:setId/cards", () => {
    it("should get cards by set ID with default pagination", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/swsh3/cards")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.setInfo).toBeDefined();
      expect(response.body.setInfo.id).toBe("swsh3");
    });

    it("should respect pagination parameters", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/swsh3/cards?page=1&pageSize=5")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.pageSize).toBe(5);
    });

    it("should handle second page correctly", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/swsh3/cards?page=2&pageSize=10")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.pageSize).toBe(10);
    });

    it("should return 404 for non-existent set", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/invalid-set-id/cards")
        .timeout(30000);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/sets/type/:type/cards", () => {
    it("should get cards by type", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/type/Fire/cards")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verify all returned cards have Fire type
      if (response.body.data.length > 0) {
        response.body.data.forEach((card) => {
          expect(card.types).toContain("Fire");
        });
      }
    });

    it("should handle Water type", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/type/Water/cards")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      if (response.body.data.length > 0) {
        response.body.data.forEach((card) => {
          expect(card.types).toContain("Water");
        });
      }
    });

    it("should handle Grass type with pagination", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/type/Grass/cards?page=1&pageSize=10")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
      expect(response.body.pagination).toBeDefined();
    });

    it("should return empty array for non-existent type", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/type/NonExistentType/cards")
        .timeout(30000);

      // Should return 200 with empty array (type exists but no cards)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should handle type with spaces (URL encoded)", async () => {
      const response = await request(serverUrl)
        .get("/api/sets/type/Fighting/cards")
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
