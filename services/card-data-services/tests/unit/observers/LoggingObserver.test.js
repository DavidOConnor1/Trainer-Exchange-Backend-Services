import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { LoggingObserver } from "../../../api/observers/LoggingObserver.js";

describe("LoggingObserver", () => {
  let loggingObserver;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    loggingObserver = new LoggingObserver();
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("apiCallStart", () => {
    it("should log API call start with correct format", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
      };

      loggingObserver.apiCallStart(data);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] API Call Started: ${data.endpoint}`,
      );
    });

    it("should log different endpoints correctly", () => {
      const endpoints = ["/api/search", "/api/cards", "/api/sets"];

      endpoints.forEach((endpoint) => {
        const data = {
          timestamp: "2024-01-01T00:00:00.000Z",
          endpoint: endpoint,
        };
        loggingObserver.apiCallStart(data);
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/cards"),
      );
    });
  });

  describe("apiCallSuccess", () => {
    it("should log successful API call with data size", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
        dataSize: 20,
      };

      loggingObserver.apiCallSuccess(data);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] API Call Successful: ${data.endpoint} (${data.dataSize} items)`,
      );
    });

    it("should handle zero data size", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
        dataSize: 0,
      };

      loggingObserver.apiCallSuccess(data);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] API Call Successful: ${data.endpoint} (0 items)`,
      );
    });

    it("should handle large data sizes", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/batch",
        dataSize: 1000,
      };

      loggingObserver.apiCallSuccess(data);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] API Call Successful: ${data.endpoint} (1000 items)`,
      );
    });
  });

  describe("apiCallError", () => {
    it("should log API call error with error message", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
        error: "Rate limit exceeded",
      };

      loggingObserver.apiCallError(data);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] API Call Failed: ${data.endpoint} - ${data.error}`,
      );
    });

    it("should handle different error types", () => {
      const errors = [
        "Network error",
        "Invalid API key",
        "Card not found",
        "Timeout exceeded",
      ];

      errors.forEach((error) => {
        const data = {
          timestamp: "2024-01-01T00:00:00.000Z",
          endpoint: "/api/search",
          error: error,
        };
        loggingObserver.apiCallError(data);
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
      errors.forEach((error) => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(error),
        );
      });
    });
  });

  describe("cacheHit", () => {
    it("should log cache hit with endpoint", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
      };

      loggingObserver.cacheHit(data);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] Cache Hit: ${data.endpoint}`,
      );
    });

    it("should log cache hit for different endpoints", () => {
      const endpoints = [
        "/api/cards/swsh3-136",
        "/api/sets",
        "/api/search?name=pikachu",
      ];

      endpoints.forEach((endpoint) => {
        const data = {
          timestamp: "2024-01-01T00:00:00.000Z",
          endpoint: endpoint,
        };
        loggingObserver.cacheHit(data);
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      endpoints.forEach((endpoint) => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(endpoint),
        );
      });
    });
  });

  describe("cacheCleared", () => {
    it("should log cache cleared with cache size", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        cacheSize: 150,
      };

      loggingObserver.cacheCleared(data);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] Cache Cleared: ${data.cacheSize} items removed`,
      );
    });

    it("should handle zero cache size", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        cacheSize: 0,
      };

      loggingObserver.cacheCleared(data);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] Cache Cleared: 0 items removed`,
      );
    });

    it("should handle large cache sizes", () => {
      const data = {
        timestamp: "2024-01-01T00:00:00.000Z",
        cacheSize: 5000,
      };

      loggingObserver.cacheCleared(data);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${data.timestamp}] Cache Cleared: 5000 items removed`,
      );
    });
  });

  describe("multiple operations", () => {
    it("should handle sequence of different log operations", () => {
      const startData = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
      };
      const successData = {
        timestamp: "2024-01-01T00:00:01.000Z",
        endpoint: "/api/search",
        dataSize: 10,
      };
      const cacheData = {
        timestamp: "2024-01-01T00:00:02.000Z",
        endpoint: "/api/search",
      };

      loggingObserver.apiCallStart(startData);
      loggingObserver.apiCallSuccess(successData);
      loggingObserver.cacheHit(cacheData);

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("Started"),
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("Successful"),
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("Cache Hit"),
      );
    });

    it("should handle mixed success and error logs", () => {
      const successData = {
        timestamp: "2024-01-01T00:00:00.000Z",
        endpoint: "/api/search",
        dataSize: 5,
      };
      const errorData = {
        timestamp: "2024-01-01T00:00:01.000Z",
        endpoint: "/api/cards",
        error: "Not found",
      };
      const clearedData = {
        timestamp: "2024-01-01T00:00:02.000Z",
        cacheSize: 100,
      };

      loggingObserver.apiCallSuccess(successData);
      loggingObserver.apiCallError(errorData);
      loggingObserver.cacheCleared(clearedData);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // success and cache cleared
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error
    });
  });
});
