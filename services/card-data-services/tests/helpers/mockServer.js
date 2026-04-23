import express from 'express';

// Create a test app instance
export const createTestApp = () => {
    const app = express();
    
    // Basic middleware for testing
    app.use(express.json());
    app.use((req, res, next) => {
        req.id = 'test-id';
        next();
    });
    
    return app;
};

// Create a test server
export const createTestServer = async (app) => {
    const server = app.listen(0); // Random available port
    await new Promise(resolve => server.once('listening', resolve));
    return server;
};