import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  ErrorHandler,
  APIError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "../../../../server/utils/errorHandler.js";

describe("ErrorHandler", () => {
  let mockRes;
  let consoleErrorSpy;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("handle", () => {
    it("should handle ECONNREFUSED error", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" };

      ErrorHandler.handle(error, {}, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Service unavailable. Please try again later.",
        code: "SERVICE_UNAVAILABLE",
        timestamp: expect.any(String),
      });
    });

    it("should handle rate limit error", () => {
      const error = { message: "Rate limit exceeded" };

      ErrorHandler.handle(error, {}, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Too many requests. Please slow down.",
        code: "RATE_LIMIT_EXCEEDED",
        timestamp: expect.any(String),
      });
    });

    it("should handle not found error", () => {
      const error = { message: "Card not found" };

      ErrorHandler.handle(error, {}, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Card not found",
        code: "NOT_FOUND",
        timestamp: expect.any(String),
      });
    });

    it("should handle validation error", () => {
      const error = { message: "Invalid input" };

      ErrorHandler.handle(error, {}, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid input",
        code: "INVALID_REQUEST",
        timestamp: expect.any(String),
      });
    });
  });

  describe("Custom Error Classes", () => {
    it("should create APIError", () => {
      const error = new APIError("Test error", 403, "FORBIDDEN");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });

    it("should create NotFoundError", () => {
      const error = new NotFoundError("Card");
      expect(error.message).toBe("Card not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });

    it("should create ValidationError", () => {
      const error = new ValidationError("Invalid email");
      expect(error.message).toBe("Invalid email");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    it("should create RateLimitError", () => {
      const error = new RateLimitError();
      expect(error.message).toBe("Too many requests. Please try again later.");
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
