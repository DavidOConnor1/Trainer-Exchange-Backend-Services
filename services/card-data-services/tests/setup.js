import { jest } from "@jest/globals";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_API_KEY_SECRET = "test-secret-key-for-jwt";
process.env.ADMIN_API_KEY = "test-admin-key-123";
process.env.INTERNAL_API_KEY = "test-internal-key-456";
process.env.PORT = "5001";

console.log = jest.fn();
