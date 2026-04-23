import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { OptimizedCache } from "../../../api/utils/OptimizedCache.js";

describe("OptimizedCache", () => {
  let cache;

  beforeEach(() => {
    cache = new OptimizedCache(1, 3);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getOrSet", () => {
    it("should return cached value on hit", async () => {
      const fetcher = jest.fn().mockResolvedValue("computed");

      const result1 = await cache.getOrSet("key", fetcher);
      const result2 = await cache.getOrSet("key", fetcher);

      expect(result1).toBe("computed");
      expect(result2).toBe("computed");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.hits).toBe(1);
      expect(cache.misses).toBe(1);
    });

    it("should compute and store on miss", async () => {
      const fetcher = jest.fn().mockResolvedValue("computed");

      const result = await cache.getOrSet("key", fetcher);

      expect(result).toBe("computed");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.misses).toBe(1);
    });

    it("should expire values after TTL", async () => {
      const fetcher = jest.fn().mockResolvedValue("computed");

      await cache.getOrSet("key", fetcher);
      jest.advanceTimersByTime(1500);

      const result = await cache.getOrSet("key", fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe("get", () => {
    it("should return undefined for missing key", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("should return undefined for expired entry", () => {
      cache.set("key", "value", 0.5);
      jest.advanceTimersByTime(600);
      expect(cache.get("key")).toBeUndefined();
    });
  });

  describe("set", () => {
    it("should evict oldest when exceeding maxSize", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      cache.set("key4", "value4");

      expect(cache.cache.has("key1")).toBe(false);
      expect(cache.cache.has("key2")).toBe(true);
      expect(cache.cache.has("key3")).toBe(true);
      expect(cache.cache.has("key4")).toBe(true);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      const fetcher = jest.fn().mockResolvedValue("value");
      await cache.getOrSet("key1", fetcher);
      await cache.getOrSet("key1", fetcher);
      await cache.getOrSet("key2", fetcher);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe("33.33%");
      expect(stats.size).toBe(2);
    });
  });
});
