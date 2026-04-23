import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { Bulkhead } from "../../../api/utils/BulkHead.js";

describe("Bulkhead", () => {
  let bulkhead;

  beforeEach(() => {
    bulkhead = new Bulkhead("test", 2, 3);
  });

  describe("constructor", () => {
    it("should initialize with correct values", () => {
      expect(bulkhead.name).toBe("test");
      expect(bulkhead.maxConcurrent).toBe(2);
      expect(bulkhead.maxQueue).toBe(3);
      expect(bulkhead.active).toBe(0);
      expect(bulkhead.queue).toEqual([]);
    });
  });

  describe("execute", () => {
    it("should execute function when under limit", async () => {
      const fn = jest.fn().mockResolvedValue("result");

      const result = await bulkhead.execute(fn);

      expect(result).toBe("result");
      expect(bulkhead.active).toBe(0);
    });

    it("should queue functions when at capacity", async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const fn1 = jest.fn().mockImplementation(() => delay(100));
      const fn2 = jest.fn().mockImplementation(() => delay(100));
      const fn3 = jest.fn().mockImplementation(() => "immediate");

      // Start two long-running functions
      const promise1 = bulkhead.execute(fn1);
      const promise2 = bulkhead.execute(fn2);

      // This should be queued
      const promise3 = bulkhead.execute(fn3);

      expect(bulkhead.active).toBe(2);
      expect(bulkhead.queue).toHaveLength(1);

      await promise1;
      await promise2;
      await promise3;

      expect(fn3).toHaveBeenCalled();
    });

    it("should throw when queue is full", async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const fn = jest.fn().mockImplementation(() => delay(100));

      // Fill up active slots
      const promise1 = bulkhead.execute(fn);
      const promise2 = bulkhead.execute(fn);

      // Fill up queue
      const promise3 = bulkhead.execute(fn);
      const promise4 = bulkhead.execute(fn);
      const promise5 = bulkhead.execute(fn);

      // This should throw queue full error
      await expect(bulkhead.execute(fn)).rejects.toThrow(
        "Bulkhead test queue full",
      );

      await Promise.all([promise1, promise2, promise3, promise4, promise5]);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const stats = bulkhead.getStats();

      expect(stats).toEqual({
        name: "test",
        active: 0,
        queued: 0,
        maxConcurrent: 2,
      });
    });
  });
});
