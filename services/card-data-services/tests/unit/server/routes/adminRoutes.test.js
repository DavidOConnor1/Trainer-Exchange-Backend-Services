import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

// Set environment for testing
process.env.JWT_API_KEY_SECRET = "test-secret-key";

const adminToken = jwt.sign(
  { type: "admin", scope: ["admin", "monitoring"] },
  "test-secret-key",
  { expiresIn: "1h" },
);

describe("Admin Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe("GET /api/admin/status", () => {
    it("should require API key", async () => {
      const response = await request(serverUrl).get("/api/admin/status");

      expect(response.status).toBe(401);
    });

    it("should return status with valid API key", async () => {
      const response = await request(serverUrl)
        .get("/api/admin/status")
        .set("x-api-key", adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
