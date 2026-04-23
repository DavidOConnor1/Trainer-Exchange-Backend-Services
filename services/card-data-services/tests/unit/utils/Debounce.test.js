import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { RequestDebouncer } from "../../../api/utils/Debounce.js";

describe("RequestDebouncer", () => {
  let debouncer;

  beforeEach(() => {
    debouncer = new RequestDebouncer(100);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("debounce", () => {
    it("should only call function once for multiple rapid calls", async () => {
      const fn = jest.fn().mockResolvedValue("result");

      // Make 3 rapid calls
      debouncer.debounce("test", fn);
      debouncer.debounce("test", fn);
      debouncer.debounce("test", fn);

      // Run timers
      jest.runAllTimers();
      await Promise.resolve();

      // Function should be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should wait debounce delay before calling function", async () => {
      const fn = jest.fn().mockResolvedValue("result");

      debouncer.debounce("test", fn);

      // Not called yet
      expect(fn).not.toHaveBeenCalled();

      // Advance time by 50ms (half the delay)
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      // Advance the rest of the delay
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should reset timer on subsequent calls", async () => {
      const fn = jest.fn().mockResolvedValue("result");

      // First call
      debouncer.debounce("test", fn);
      jest.advanceTimersByTime(50);

      // Second call - should reset timer
      debouncer.debounce("test", fn);
      jest.advanceTimersByTime(50);

      // Function should not have been called yet
      expect(fn).not.toHaveBeenCalled();

      // Third call - resets again
      debouncer.debounce("test", fn);
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      // Now advance full delay after last call
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should return same promise for same key", async () => {
      const fn = jest.fn().mockResolvedValue("result");

      const promise1 = debouncer.debounce("test", fn);
      const promise2 = debouncer.debounce("test", fn);
      const promise3 = debouncer.debounce("test", fn);

      // All promises are the same object
      expect(promise1).toStrictEqual(promise2);
      expect(promise2).toStrictEqual(promise3);

      // Fast‑forward timers
      jest.runAllTimers();
      await Promise.resolve();

      const result = await promise1;
      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle different keys separately", async () => {
      const fn1 = jest.fn().mockResolvedValue("result1");
      const fn2 = jest.fn().mockResolvedValue("result2");

      const promise1 = debouncer.debounce("key1", fn1);
      const promise2 = debouncer.debounce("key2", fn2);

      jest.runAllTimers();

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      expect(await promise1).toBe("result1");
      expect(await promise2).toBe("result2");
    });

    it("should reject on error", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Failed"));

      const promise = debouncer.debounce("test", fn);
      jest.runAllTimers();

      await expect(promise).rejects.toThrow("Failed");
    });
  });
});
