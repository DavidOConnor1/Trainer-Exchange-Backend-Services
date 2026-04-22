import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use a strong secret (store in environment variable)
const JWT_SECRET = process.env.JWT_API_KEY_SECRET || 'your-strong-secret-here-min-32-chars';

// Generate different API keys for different purposes
const apiKeys = {
    admin: {
        name: 'Admin API Key',
        scope: ['admin', 'monitoring', 'read', 'write'],
        expiresIn: '365d'  // Long-lived for admin
    },
    frontend: {
        name: 'Frontend Service Key',
        scope: ['read'],
        expiresIn: '90d'  // Frontend service
    },
    internal: {
        name: 'Internal Service Key',
        scope: ['read', 'write'],
        expiresIn: '180d'  // Internal services
    },
    temp: {
        name: 'Temporary Key',
        scope: ['read'],
        expiresIn: '7d'  // Short-lived for testing
    }
};

Object.entries(apiKeys).forEach(([type, config]) => {
    const token = jwt.sign(
        { 
            type,
            name: config.name,
            scope: config.scope,
            iss: 'pokemon-tcg-backend',
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: config.expiresIn }
    );
    
    console.log(`\n${config.name}:`);
    console.log(`Bearer ${token}`);
    console.log(`\nOr use as API Key: ${token}`);
});