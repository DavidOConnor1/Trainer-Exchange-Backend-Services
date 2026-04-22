import express from 'express';
import jwt from 'jsonwebtoken';
import { revokeAPIKey } from '../middleware/apiKeyAuth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_API_KEY_SECRET;

// Generate a new API key (admin only)
router.post('/keys/generate', verifyAPIKeyJWT, requireScope('admin'), (req, res) => {
    const { type, name, scope, expiresIn } = req.body;
    
    const token = jwt.sign(
        { 
            type: type || 'custom',
            name: name || 'Custom API Key',
            scope: scope || ['read'],
            iss: 'pokemon-tcg-backend',
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: expiresIn || '30d' }
    );
    
    res.json({
        success: true,
        apiKey: token,
        expiresIn: expiresIn || '30d'
    });
});

// Revoke an API key
router.post('/keys/revoke', verifyAPIKeyJWT, requireScope('admin'), (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }
    
    revokeAPIKey(token);
    
    res.json({
        success: true,
        message: 'API key revoked successfully'
    });
});

// List active API keys (decode info, not the actual tokens)
router.get('/keys', verifyAPIKeyJWT, requireScope('admin'), (req, res) => {
    // This would require storing issued keys in a database
    // For now, just return info about the current key
    res.json({
        success: true,
        currentKey: req.apiKey
    });
});