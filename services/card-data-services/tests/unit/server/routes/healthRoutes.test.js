import { describe, expect, it, beforeAll } from "@jest/globals";
import request from "supertest";
import app from "../../../../server/server.js";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

describe("Health Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe("healthy");
    });
  });
});
