import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { StaleWhileRevalidateCache } from "../../../api/utils/StaleCache.js";

describe("StaleWhileRevalidateCache", () => {
  let cache;
  let consoleLogSpy;

  beforeEach(() => {
    cache = new StaleWhileRevalidateCache(1, 3);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  describe("getOrSet", () => {
    it("should return fresh cached value", async () => {
      const fetcher = jest.fn().mockResolvedValue("computed");

      await cache.getOrSet("key", fetcher);
      jest.advanceTimersByTime(500);

      const result = await cache.getOrSet("key", fetcher);

      expect(result).toBe("computed");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should return stale value and revalidate in background", async () => {
      const fetcher = jest.fn().mockResolvedValue("new value");

      // Initial set
      await cache.getOrSet("key", fetcher);
      jest.advanceTimersByTime(1500);

      // This should return stale value and trigger background revalidation
      const result = await cache.getOrSet("key", fetcher);

      expect(result).toBe("new value");
      // Background revalidation should have been triggered
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("🔄 Revalidated cache for: key"),
      );
    });

    it("should fetch fresh when expired beyond stale TTL", async () => {
      const fetcher = jest.fn().mockResolvedValue("fresh value");

      await cache.getOrSet("key", fetcher);
      jest.advanceTimersByTime(3500);

      const result = await cache.getOrSet("key", fetcher);

      expect(result).toBe("fresh value");
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("should handle revalidation failures gracefully", async () => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce("initial")
        .mockRejectedValueOnce(new Error("Revalidation failed"))
        .mockResolvedValueOnce("recovered");

      await cache.getOrSet("key", fetcher);
      jest.advanceTimersByTime(1500);

      // Should return stale value even though revalidation fails
      const result = await cache.getOrSet("key", fetcher);
      expect(result).toBe("initial");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ Failed to revalidate cache for: key"),
      );
    });
  });

  describe("set", () => {
    it("should store value with timestamp", () => {
      cache.set("key", "value");
      const cached = cache.cache.get("key");
      expect(cached.value).toBe("value");
      expect(cached.timestamp).toBeDefined();
    });
  });
});
