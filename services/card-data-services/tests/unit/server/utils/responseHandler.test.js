import { describe, expect, it, jest } from "@jest/globals";
import { ResponseHandler } from "../../../../server/utils/responseHandler.js";

describe("ResponseHandler", () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("success", () => {
    it("should send success response with default message", () => {
      const data = { id: 1, name: "Test" };

      ResponseHandler.success(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data,
        timestamp: expect.any(String),
      });
    });

    it("should send success response with custom message and status", () => {
      const data = { id: 1 };
      const message = "Custom success";
      const statusCode = 201;

      ResponseHandler.success(mockRes, data, message, statusCode);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message,
        data,
        timestamp: expect.any(String),
      });
    });
  });

  describe("error", () => {
    it("should send error response with string error", () => {
      const errorMessage = "Something went wrong";

      ResponseHandler.error(mockRes, errorMessage);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: errorMessage,
        timestamp: expect.any(String),
      });
    });

    it("should send error response with Error object", () => {
      const error = new Error("Database error");

      ResponseHandler.error(mockRes, error, 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Database error",
        timestamp: expect.any(String),
      });
    });
  });

  describe("paginated", () => {
    it("should send paginated response", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, pageSize: 10, hasMore: false, total: 2 };

      ResponseHandler.paginated(mockRes, data, pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data,
        pagination,
        timestamp: expect.any(String),
      });
    });
  });

  describe("notFound", () => {
    it("should send 404 response", () => {
      ResponseHandler.notFound(mockRes, "Card");

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Card not found",
        timestamp: expect.any(String),
      });
    });
  });
});
