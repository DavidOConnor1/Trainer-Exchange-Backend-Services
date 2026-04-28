import { beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import app from "../../../../server/server.js";
import {
  startTestServer,
  stopTestServer,
} from "../../../helpers/testServer.js";

describe("Batch Routes", () => {
  let serverUrl;

  beforeAll(async () => {
    const { serverUrl: url } = await startTestServer();
    serverUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe("POST /api/batch/cards", () => {
    it("should batch get cards by SDK IDs", async () => {
      const response = await request(app)
        .post("/api/batch/cards")
        .send({ cardIds: ["swsh3-136", "swsh3-137"] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.total).toBe(2);
    });

    it("should return 400 for empty cardIds", async () => {
      const response = await request(app)
        .post("/api/batch/cards")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/batch/cards/by-localid", () => {
    it("should batch get cards by localIds", async () => {
      const response = await request(app)
        .post("/api/batch/cards/by-localid")
        .send({ localIds: ["136", "137"] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
