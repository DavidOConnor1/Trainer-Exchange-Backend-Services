import { createServer } from "http";
import app from "../../server/server.js";

let server;
let serverUrl;

export const startTestServer = async () => {
  if (!server) {
    server = createServer(app);
    await new Promise((resolve) => {
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
