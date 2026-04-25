import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  verifyAPIKeyJWT,
  requireScope,
} from "../../../../server/middleware/apiKeyAuth.js";

describe("API Key Auth Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;
  let validToken;

  beforeEach(() => {
    // Set environment variable
    process.env.JWT_API_KEY_SECRET = "test-secret-key";

    // Create a real valid token
    validToken = jwt.sign(
      { type: "admin", name: "Admin Key", scope: ["admin", "monitoring"] },
      "test-secret-key",
      { expiresIn: "1h" },
    );

    mockReq = {
      headers: {},
      id: "test-request-id",
      method: "GET",
      path: "/api/admin/status",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("verifyAPIKeyJWT", () => {
    it("should return 401 if no API key provided", () => {
      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "API key required",
      });
    });

    it("should accept valid API key from x-api-key header", () => {
      mockReq.headers["x-api-key"] = validToken;

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.apiKey).toBeDefined();
      expect(mockReq.apiKey.type).toBe("admin");
    });

    it("should accept valid API key from Authorization header", () => {
      mockReq.headers.authorization = `Bearer ${validToken}`;

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should reject invalid API key", () => {
      mockReq.headers["x-api-key"] = "invalid-token";

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid API key",
      });
    });
  });

  describe("requireScope", () => {
    it("should return 401 if no API key in request", () => {
      const middleware = requireScope("admin");
      mockReq.apiKey = undefined;

      middleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "API key required",
      });
    });

    it("should return 403 if required scope not present", () => {
      const middleware = requireScope("admin");
      mockReq.apiKey = { scope: ["read", "write"] };

      middleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Insufficient permissions. Requires scope: admin",
      });
    });

    it("should call next if scope is present", () => {
      const middleware = requireScope("admin");
      mockReq.apiKey = { scope: ["admin", "read"] };

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
