import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Import the actual CacheManager
import { CacheManager } from "../../../api/utils/CacheManager.js";

describe("CacheManager", () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager(300, 500);
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(cacheManager.cache).toBeDefined();
    });
  });

  describe("get and set", () => {
    it("should set and get a value", () => {
      cacheManager.set("test-key", "test-value");
      const result = cacheManager.get("test-key");
      expect(result).toBe("test-value");
    });

    it("should return undefined for missing key", () => {
      const result = cacheManager.get("missing-key");
      expect(result).toBeUndefined();
    });

    it("should set with custom TTL", async () => {
      cacheManager.set("expiring-key", "value", 1);
      expect(cacheManager.get("expiring-key")).toBe("value");

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(cacheManager.get("expiring-key")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for existing key", () => {
      cacheManager.set("test-key", "value");
      expect(cacheManager.has("test-key")).toBe(true);
    });

    it("should return false for missing key", () => {
      expect(cacheManager.has("missing-key")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all cache entries", () => {
      cacheManager.set("key1", "value1");
      cacheManager.set("key2", "value2");

      expect(cacheManager.get("key1")).toBe("value1");
      expect(cacheManager.get("key2")).toBe("value2");

      const clearedCount = cacheManager.clear();
      expect(clearedCount).toBe(2);

      expect(cacheManager.get("key1")).toBeUndefined();
      expect(cacheManager.get("key2")).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", () => {
      cacheManager.set("key1", "value1");
      cacheManager.set("key2", "value2");

      const stats = cacheManager.getStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
      expect(stats.stats).toBeDefined();
    });
  });
});
