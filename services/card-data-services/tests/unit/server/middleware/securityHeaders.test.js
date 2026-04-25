import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { securityHeaders } from "../../../../server/middleware/securityHeaders.js";

describe("Security Headers Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe("securityHeaders", () => {
    it("should set X-Content-Type-Options header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff",
      );
    });

    it("should set X-Frame-Options header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    });

    it("should set X-XSS-Protection header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-XSS-Protection",
        "1; mode=block",
      );
    });

    it("should set Referrer-Policy header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin",
      );
    });

    it("should set Permissions-Policy header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=()",
      );
    });

    it("should set Cache-Control header", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
    });

    it("should call next function", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should set all headers at once", () => {
      securityHeaders(mockReq, mockRes, nextFunction);

      expect(mockRes.setHeader).toHaveBeenCalledTimes(6);
    });
  });
});
