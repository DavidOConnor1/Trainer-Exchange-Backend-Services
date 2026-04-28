import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

process.env.JWT_API_KEY_SECRET = "test-secret-key";

const adminToken = jwt.sign(
  { type: "admin", scope: ["admin", "monitoring"] },
  "test-secret-key",
  { expiresIn: "1h" },
);

describe("Monitoring Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe("GET /api/monitoring/health", () => {
    it("should require API key", async () => {
      const response = await request(serverUrl).get("/api/monitoring/health");

      expect(response.status).toBe(401);
    });

    it("should return health data with valid API key", async () => {
      const response = await request(serverUrl)
        .get("/api/monitoring/health")
        .set("x-api-key", adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
