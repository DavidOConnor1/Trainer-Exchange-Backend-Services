import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { CircuitBreaker } from "../../../api/utils/CircuitBreaker.js";

describe("CircuitBreaker", () => {
  let circuitBreaker;
  let consoleLogSpy;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(2, 1000);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("initial state", () => {
    it("should start in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe("CLOSED");
      expect(circuitBreaker.failures).toBe(0);
    });
  });

  describe("call", () => {
    it("should execute successful function", async () => {
      const fn = jest.fn().mockResolvedValue("success");

      const result = await circuitBreaker.call(fn);

      expect(result).toBe("success");
      expect(circuitBreaker.getState()).toBe("CLOSED");
    });

    it("should open circuit after failure threshold", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Service failed"));

      // First failure
      await expect(circuitBreaker.call(fn)).rejects.toThrow("Service failed");
      expect(circuitBreaker.getState()).toBe("CLOSED");

      // Second failure - should open circuit
      await expect(circuitBreaker.call(fn)).rejects.toThrow("Service failed");
      expect(circuitBreaker.getState()).toBe("OPEN");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("🔴 Circuit breaker: OPEN"),
      );
    });

    it("should reject immediately when circuit is OPEN", async () => {
      // Open the circuit
      const fn = jest.fn().mockRejectedValue(new Error("Service failed"));
      await expect(circuitBreaker.call(fn)).rejects.toThrow();
      await expect(circuitBreaker.call(fn)).rejects.toThrow();

      // Circuit is now OPEN
      const workingFn = jest.fn().mockResolvedValue("success");
      await expect(circuitBreaker.call(workingFn)).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
      expect(workingFn).not.toHaveBeenCalled();
    });

    it("should transition to HALF_OPEN after timeout", async () => {
      // Open the circuit
      const fn = jest.fn().mockRejectedValue(new Error("Service failed"));
      await expect(circuitBreaker.call(fn)).rejects.toThrow();
      await expect(circuitBreaker.call(fn)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe("OPEN");

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next call should be in HALF_OPEN state
      const workingFn = jest.fn().mockResolvedValue("success");
      const result = await circuitBreaker.call(workingFn);

      expect(result).toBe("success");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("🔓 Circuit breaker: HALF_OPEN"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("✅ Circuit breaker: CLOSED"),
      );
      expect(circuitBreaker.getState()).toBe("CLOSED");
    });
  });

  describe("reset", () => {
    it("should reset circuit breaker state", () => {
      circuitBreaker.failures = 5;
      circuitBreaker.state = "OPEN";

      circuitBreaker.reset();

      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.getState()).toBe("CLOSED");
      expect(circuitBreaker.lastFailureTime).toBeNull();
    });
  });
});
