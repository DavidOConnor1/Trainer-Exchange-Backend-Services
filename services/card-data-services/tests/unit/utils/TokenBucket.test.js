import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { TokenBucket } from "../../../api/utils/TokenBucket.js";

describe("TokenBucket", () => {
  let tokenBucket;

  beforeEach(() => {
    tokenBucket = new TokenBucket(10, 5, 100);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct values", () => {
      expect(tokenBucket.capacity).toBe(10);
      expect(tokenBucket.tokens).toBe(10);
      expect(tokenBucket.refillRate).toBe(5);
      expect(tokenBucket.refillInterval).toBe(100);
    });
  });

  describe("consume", () => {
    it("should consume tokens when available", async () => {
      const result = await tokenBucket.consume(3);
      expect(result).toBe(true);
      expect(tokenBucket.tokens).toBe(7);
    });

    it("should wait for tokens when not enough available", async () => {
      tokenBucket.tokens = 2;

      const promise = tokenBucket.consume(5);

      jest.advanceTimersByTime(100);

      await promise;
      expect(tokenBucket.tokens).toBe(2);
    });

    it("should handle consuming all tokens", async () => {
      const result = await tokenBucket.consume(10);
      expect(result).toBe(true);
      expect(tokenBucket.tokens).toBe(0);
    });
  });

  describe("refill", () => {
    it("should refill tokens based on time passed", () => {
      tokenBucket.tokens = 0;
      tokenBucket.lastRefill = Date.now() - 200;

      tokenBucket.refill();

      expect(tokenBucket.tokens).toBe(10);
    });

    it("should not exceed capacity", () => {
      tokenBucket.tokens = 8;
      tokenBucket.lastRefill = Date.now() - 200;

      tokenBucket.refill();

      expect(tokenBucket.tokens).toBe(10);
    });
  });

  describe("getTokens", () => {
    it("should return current token count", () => {
      expect(tokenBucket.getTokens()).toBe(10);
    });

    it("should refill before returning", () => {
      tokenBucket.tokens = 5;
      tokenBucket.lastRefill = Date.now() - 150;

      const tokens = tokenBucket.getTokens();
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe("reset", () => {
    it("should reset tokens to capacity", () => {
      tokenBucket.tokens = 3;
      tokenBucket.reset();
      expect(tokenBucket.tokens).toBe(10);
    });

    it("should update lastRefill time", () => {
      // Store the original time
      const originalTime = tokenBucket.lastRefill;

      // Mock Date.now to return a different value
      const originalDateNow = Date.now;
      const newTime = originalTime + 1000;
      global.Date.now = jest.fn(() => newTime);

      tokenBucket.reset();

      expect(tokenBucket.lastRefill).toBe(newTime);

      // Restore original Date.now
      global.Date.now = originalDateNow;
    });
  });
});
