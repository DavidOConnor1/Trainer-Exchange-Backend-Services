import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import {
  validateCardId,
  validateLocalId,
  validateSearchQuery,
} from "../../../../server/middleware/validation.js";

describe("Validation Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      sanitizedId: null,
      sanitizedLocalId: null,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("validateCardId", () => {
    it("should return 400 if no card ID provided", () => {
      mockReq.params = {};
      validateCardId(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid Card ID",
      });
    });

    it("should sanitize valid card ID", () => {
      mockReq.params = { id: "swsh3-136" };
      validateCardId(mockReq, mockRes, nextFunction);

      expect(mockReq.sanitizedId).toBeDefined();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("validateLocalId", () => {
    it("should return 400 if no localId provided", () => {
      mockReq.params = {};
      validateLocalId(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid Local ID",
      });
    });

    it("should sanitize valid localId", () => {
      mockReq.params = { localId: "136" };
      validateLocalId(mockReq, mockRes, nextFunction);

      expect(mockReq.sanitizedLocalId).toBeDefined();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("validateSearchQuery", () => {
    it("should handle simple search query", () => {
      mockReq.query = { q: "pikachu" };
      validateSearchQuery(mockReq, mockRes, nextFunction);

      expect(mockReq.sanitizedQuery).toBeDefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should handle empty search query", () => {
      mockReq.query = {};
      validateSearchQuery(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
