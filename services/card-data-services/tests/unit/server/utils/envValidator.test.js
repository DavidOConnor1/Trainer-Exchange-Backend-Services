import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { validateEnvironment } from "../../../../server/utils/envValidator.js";

describe("validateEnvironment", () => {
  let consoleErrorSpy;
  let consoleLogSpy;
  let processExitSpy;
  let originalEnv;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});

    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    // Restore original env
    process.env = originalEnv;
  });

  it("should log success when all required env vars exist", () => {
    process.env = { PORT: "5000", NODE_ENV: "development" };

    validateEnvironment();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "✅ Environment variables validated",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "⚠️  Running in development mode",
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should exit when PORT is missing in production", () => {
    process.env = { NODE_ENV: "production" };
    delete process.env.PORT;

    validateEnvironment();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Missing required environment variables: PORT",
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should exit when PORT is missing in development (since implementation exits)", () => {
    process.env = { NODE_ENV: "development" };
    delete process.env.PORT;

    validateEnvironment();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Missing required environment variables: PORT",
    );
    // Your implementation exits in both production AND development
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
