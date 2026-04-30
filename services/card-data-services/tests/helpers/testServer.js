import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

// Set test environment BEFORE importing app
process.env.NODE_ENV = "test";
process.env.PORT = "5001";
process.env.JWT_API_KEY_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost:3000";

// Try to load .env file if exists (optional)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "../../../services/.env");

try {
  dotenv.config({ path: envPath });
} catch (err) {
  // Ignore - .env file is optional in CI
}

// Import app after environment is set
import app from "../../server/server.js";

let server;
let serverUrl;

export const startTestServer = async () => {
  if (!server) {
    server = createServer(app);
    await new Promise((resolve) => {
      // Use port 0 to get an available random port
      server.listen(0, () => {
        const { port } = server.address();
        serverUrl = `http://localhost:${port}`;
        console.log(`🧪 Test server running on port ${port}`);
        resolve();
      });
    });
  }
  return { server, serverUrl };
};

export const stopTestServer = async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log("🧪 Test server closed");
        server = null;
        serverUrl = null;
        resolve();
      });
    });
  }
};
