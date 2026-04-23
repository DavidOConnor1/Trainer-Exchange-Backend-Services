import assert from 'node:assert/strict';
import { once } from 'node:events';

// Helper to create a test request
export const createTestRequest = (options = {}) => {
    return {
        id: 'test-request-id',
        method: options.method || 'GET',
        url: options.url || '/',
        query: options.query || {},
        params: options.params || {},
        body: options.body || {},
        headers: options.headers || {},
        ip: '127.0.0.1',
        get: function(header) { return this.headers[header]; }
    };
};

// Helper to create a test response
export const createTestResponse = () => {
    const res = {
        statusCode: 200,
        headers: {},
        data: null,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.data = data;
            return this;
        },
        setHeader: function(key, value) {
            this.headers[key] = value;
            return this;
        }
    };
    return res;
};

// Helper to assert response
export const assertResponse = (res, expectedStatus, expectedData) => {
    assert.strictEqual(res.statusCode, expectedStatus);
    if (expectedData) {
        assert.deepStrictEqual(res.data, expectedData);
    }
};

// Helper to wait for async operations
export const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create a mock API key header
export const mockApiKeyHeader = (key = process.env.ADMIN_API_KEY) => ({
    'x-api-key': key
});

// Helper to create a mock JWT header
export const mockAuthHeader = (token = 'test-jwt-token') => ({
    'Authorization': `Bearer ${token}`
});