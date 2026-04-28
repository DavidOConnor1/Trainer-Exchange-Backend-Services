import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

describe("Card Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  }, 30000); // Increase timeout for server startup

  afterAll(async () => {
    await stopTestServer();
  });

  // Test the reliable endpoint: set + localId combination
  describe("GET /api/cards/:setId/:localId", () => {
    it("should get card by set and localId", async () => {
      const response = await request(serverUrl)
        .get("/api/cards/swsh3/136")
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Furret");
      expect(response.body.data.localId).toBe("136");
    });
  });

  // Test batch endpoint as an alternative way to get cards
  describe("POST /api/batch/cards", () => {
    it("should batch get cards by SDK IDs", async () => {
      const response = await request(serverUrl)
        .post("/api/batch/cards")
        .send({ cardIds: ["swsh3-136"] })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results[0].success).toBe(true);
    });
  });
});
