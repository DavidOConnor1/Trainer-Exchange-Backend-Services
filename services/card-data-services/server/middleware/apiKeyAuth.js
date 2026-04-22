import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Store blacklisted tokens (in production, use Redis)
const blacklistedTokens = new Set();

export const verifyAPIKeyJWT = (req, res, next) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${req.id}] 🔐 VERIFYING API KEY`);
    console.log(`[${req.id}] Path: ${req.method} ${req.path}`);
    
    // Check if secret exists
    const secret = process.env.JWT_API_KEY_SECRET;
    console.log(`[${req.id}] JWT_SECRET exists: ${!!secret}`);
    console.log(`[${req.id}] JWT_SECRET length: ${secret ? secret.length : 0}`);
    
    // Get token from headers
    let token = req.headers['x-api-key'] || 
                req.headers['authorization']?.replace('Bearer ', '');
    
    console.log(`[${req.id}] x-api-key header: ${req.headers['x-api-key'] ? 'YES' : 'NO'}`);
    console.log(`[${req.id}] authorization header: ${req.headers.authorization ? 'YES' : 'NO'}`);
    console.log(`[${req.id}] Token found: ${!!token}`);
    
    if (!token) {
        console.log(`[${req.id}] ❌ No token provided`);
        return res.status(401).json({
            success: false,
            error: 'API key required'
        });
    }
    
    console.log(`[${req.id}] Token preview: ${token.substring(0, 50)}...`);
    
    // Check blacklist
    if (blacklistedTokens.has(token)) {
        console.log(`[${req.id}] ❌ Token is blacklisted`);
        return res.status(401).json({
            success: false,
            error: 'API key has been revoked'
        });
    }
    
    try {
        // Try to verify
        console.log(`[${req.id}] Attempting to verify token...`);
        const decoded = jwt.verify(token, secret);
        console.log(`[${req.id}] ✅ Verification successful!`);
        console.log(`[${req.id}] Decoded:`, {
            type: decoded.type,
            name: decoded.name,
            scope: decoded.scope,
            iat: new Date(decoded.iat * 1000).toISOString(),
            exp: new Date(decoded.exp * 1000).toISOString()
        });
        
        req.apiKey = decoded;
        next();
    } catch (error) {
        console.log(`[${req.id}] ❌ Verification failed: ${error.message}`);
        console.log(`[${req.id}] Error name: ${error.name}`);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'API key has expired'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: `Invalid API key: ${error.message}`
            });
        }
        
        return res.status(401).json({
            success: false,
            error: 'Invalid API key'
        });
    }
};

// Scope-based authorization
export const requireScope = (requiredScope) => {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required'
            });
        }
        
        if (!req.apiKey.scope || !req.apiKey.scope.includes(requiredScope)) {
            return res.status(403).json({
                success: false,
                error: `Insufficient permissions. Requires scope: ${requiredScope}`
            });
        }
        
        next();
    };
};

// Revoke an API key
export const revokeAPIKey = (token) => {
    blacklistedTokens.add(token);
    
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const ttl = (decoded.exp * 1000) - Date.now();
            setTimeout(() => {
                blacklistedTokens.delete(token);
            }, Math.max(0, ttl));
        }
    } catch (e) {
        // Ignore decode errors
    }
};