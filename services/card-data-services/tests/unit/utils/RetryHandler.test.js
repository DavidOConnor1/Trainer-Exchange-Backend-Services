import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { RetryHandler } from "../../../api/utils/RetryHandler.js";

describe("RetryHandler", () => {
  let retryHandler;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    retryHandler = new RetryHandler(3, 100);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const fn = jest.fn().mockResolvedValue("success");

      const result = await retryHandler.withRetry(fn, "testOperation", {});

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce("success");

      const result = await retryHandler.withRetry(fn, "testOperation", {});

      expect(result).toBe("success");
      // 3 failures? Let's trace: original call (fail), retry 1 (fail), retry 2 (success) = 3 total
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Persistent error"));

      await expect(
        retryHandler.withRetry(fn, "testOperation", {}),
      ).rejects.toThrow("Persistent error");
      // With maxRetries = 3, the implementation calls: original + 3 retries = 4 total
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it("should not retry on rate limit errors", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Rate limit exceeded"));

      await expect(
        retryHandler.withRetry(fn, "testOperation", {}),
      ).rejects.toThrow("Rate limit exceeded");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should use exponential backoff", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce("success");

      const startTime = Date.now();
      await retryHandler.withRetry(fn, "testOperation", {});
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(250);
    });
  });
});
