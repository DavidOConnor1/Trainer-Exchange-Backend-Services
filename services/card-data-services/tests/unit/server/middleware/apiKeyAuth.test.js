import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  verifyAPIKeyJWT,
  requireScope,
} from "../../../../server/middleware/apiKeyAuth.js";

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
  decode: jest.fn(),
}));

describe("API Key Auth Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      id: "test-request-id",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();

    // Set environment variable for testing
    process.env.JWT_API_KEY_SECRET = "test-secret";
  });

  describe("verifyAPIKeyJWT", () => {
    it("should return 401 if no API key provided", () => {
      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "API key required",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should accept API key from x-api-key header", () => {
      const mockToken = "valid-token";
      const mockDecoded = {
        type: "admin",
        name: "Admin Key",
        scope: ["admin"],
      };

      mockReq.headers["x-api-key"] = mockToken;
      jwt.verify.mockReturnValue(mockDecoded);

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, "test-secret");
      expect(mockReq.apiKey).toEqual({
        type: "admin",
        name: "Admin Key",
        scope: ["admin"],
        issuedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      });
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should accept API key from Authorization header", () => {
      const mockToken = "valid-token";
      const mockDecoded = {
        type: "admin",
        name: "Admin Key",
        scope: ["admin"],
      };

      mockReq.headers.authorization = `Bearer ${mockToken}`;
      jwt.verify.mockReturnValue(mockDecoded);

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, "test-secret");
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return 401 for invalid token", () => {
      mockReq.headers["x-api-key"] = "invalid-token";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid API key",
      });
    });

    it("should return 401 for expired token", () => {
      mockReq.headers["x-api-key"] = "expired-token";
      const expiredError = new Error("jwt expired");
      expiredError.name = "TokenExpiredError";
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      verifyAPIKeyJWT(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "API key has expired",
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

    it("should return 403 if scope not present", () => {
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
