import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

describe("Search Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe("GET /api/search", () => {
    it("should search cards by name", async () => {
      const response = await request(serverUrl)
        .get("/api/search?name=pikachu&pageSize=5")
        .timeout(10000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 15000);
  });
});
