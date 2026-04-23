import { describe, expect, it, beforeEach } from "@jest/globals";
import { ErrorTrackingObserver } from "../../../api/observers/ErrorTrackingObserver.js";

describe("ErrorTrackingObserver", () => {
  let errorTracker;

  beforeEach(() => {
    errorTracker = new ErrorTrackingObserver();
  });

  describe("initialization", () => {
    it("should initialize with empty errors array", () => {
      expect(errorTracker.errors).toEqual([]);
      expect(errorTracker.getErrors()).toEqual([]);
    });
  });

  describe("apiCallError", () => {
    it("should add API error to errors array with correct type", () => {
      const errorData = {
        endpoint: "/api/search",
        timestamp: "2024-01-01T00:00:00.000Z",
        error: "Rate limit exceeded",
        dataSize: 0,
        params: { name: "pikachu" },
      };

      errorTracker.apiCallError(errorData);

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0]).toEqual({
        ...errorData,
        type: "API_ERROR",
      });
    });

    it("should add multiple API errors", () => {
      const errorData1 = { endpoint: "/api/search", error: "Error 1" };
      const errorData2 = { endpoint: "/api/cards", error: "Error 2" };

      errorTracker.apiCallError(errorData1);
      errorTracker.apiCallError(errorData2);

      expect(errorTracker.errors).toHaveLength(2);
      expect(errorTracker.errors[0].error).toBe("Error 1");
      expect(errorTracker.errors[1].error).toBe("Error 2");
    });

    it("should preserve all original error data", () => {
      const errorData = {
        endpoint: "/api/batch",
        timestamp: "2024-01-01T00:00:00.000Z",
        error: "Connection failed",
        dataSize: 0,
        params: { cardIds: ["id1", "id2"] },
        status: "error",
      };

      errorTracker.apiCallError(errorData);

      expect(errorTracker.errors[0]).toMatchObject(errorData);
      expect(errorTracker.errors[0].type).toBe("API_ERROR");
    });
  });

  describe("unhandledError", () => {
    it("should add unhandled error to errors array with correct type", () => {
      const errorData = {
        endpoint: "/api/search",
        timestamp: "2024-01-01T00:00:00.000Z",
        error: "Uncaught exception",
        stack: "Error: Something went wrong\n    at ...",
        url: "/api/search",
        method: "GET",
        ip: "127.0.0.1",
      };

      errorTracker.unhandledError(errorData);

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0]).toEqual({
        ...errorData,
        type: "UNHANDLED_ERROR",
      });
    });

    it("should handle multiple unhandled errors", () => {
      const errorData1 = { endpoint: "/api/search", error: "Error 1" };
      const errorData2 = { endpoint: "/api/cards", error: "Error 2" };

      errorTracker.unhandledError(errorData1);
      errorTracker.unhandledError(errorData2);

      expect(errorTracker.errors).toHaveLength(2);
      expect(errorTracker.errors[0].type).toBe("UNHANDLED_ERROR");
      expect(errorTracker.errors[1].type).toBe("UNHANDLED_ERROR");
    });
  });

  describe("getErrors", () => {
    it("should return all tracked errors", () => {
      const errorData1 = { endpoint: "/api/search", error: "Error 1" };
      const errorData2 = { endpoint: "/api/cards", error: "Error 2" };

      errorTracker.apiCallError(errorData1);
      errorTracker.unhandledError(errorData2);

      const errors = errorTracker.getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].type).toBe("API_ERROR");
      expect(errors[1].type).toBe("UNHANDLED_ERROR");
    });

    it("should return empty array when no errors tracked", () => {
      const errors = errorTracker.getErrors();
      expect(errors).toEqual([]);
    });
  });

  describe("clearErrors", () => {
    it("should clear all tracked errors", () => {
      errorTracker.apiCallError({ endpoint: "/api/search", error: "Error 1" });
      errorTracker.unhandledError({ endpoint: "/api/cards", error: "Error 2" });

      expect(errorTracker.getErrors()).toHaveLength(2);

      errorTracker.clearErrors();

      expect(errorTracker.getErrors()).toEqual([]);
      expect(errorTracker.errors).toEqual([]);
    });

    it("should handle clearing when no errors exist", () => {
      errorTracker.clearErrors();
      expect(errorTracker.getErrors()).toEqual([]);
    });
  });

  describe("mixed error types", () => {
    it("should handle both API and unhandled errors together", () => {
      const apiError = { endpoint: "/api/search", error: "API Error" };
      const unhandledError = {
        endpoint: "/api/cards",
        error: "Unhandled Error",
      };

      errorTracker.apiCallError(apiError);
      errorTracker.unhandledError(unhandledError);
      errorTracker.apiCallError({
        endpoint: "/api/batch",
        error: "Another API Error",
      });

      const errors = errorTracker.getErrors();

      expect(errors).toHaveLength(3);
      expect(errors.filter((e) => e.type === "API_ERROR")).toHaveLength(2);
      expect(errors.filter((e) => e.type === "UNHANDLED_ERROR")).toHaveLength(
        1,
      );
    });
  });
});
