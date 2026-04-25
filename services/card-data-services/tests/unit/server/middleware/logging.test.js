import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import {
  requestLogger,
  requestDetailsLogger,
} from "../../../../server/middleware/logging.js";

describe("Logging Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;
  let consoleLogSpy;

  beforeEach(() => {
    mockReq = {
      id: "test-id",
      method: "GET",
      url: "/api/test",
      query: { name: "pikachu" },
      params: { id: "123" },
      body: { data: "test" },
      ip: "127.0.0.1",
      route: { path: "/api/test" },
      headers: {
        "user-agent": "jest-test",
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
    };
    mockRes = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === "finish") {
          callback();
        }
      }),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("requestLogger", () => {
    it("should log incoming request details", () => {
      requestLogger(mockReq, mockRes, nextFunction);

      // Check that console.log was called
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("requestDetailsLogger", () => {
    it("should log detailed request info", () => {
      requestDetailsLogger(mockReq, mockRes, nextFunction);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
