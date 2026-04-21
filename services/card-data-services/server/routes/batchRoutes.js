import express from 'express';
import { pokemonAPI } from '../../api/APIClient.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { asyncHandler } from '../utils/errorHandler.js';

const router = express.Router();

// Batch get cards by SDK IDs
router.post('/cards', asyncHandler(async (req, res) => {
    const { cardIds } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
        return ResponseHandler.error(res, 'Invalid request. Please provide an array of card IDs', 400);
    }
    
    if (cardIds.length > 50) {
        return ResponseHandler.error(res, 'Maximum 50 cards per batch request', 400);
    }
    
    const result = await pokemonAPI.getCardsBatch(cardIds);
    
    ResponseHandler.success(res, result, `Batch request completed`);
}));

// Batch get cards by localIds
router.post('/cards/by-localid', asyncHandler(async (req, res) => {
    const { localIds } = req.body;
    
    if (!localIds || !Array.isArray(localIds) || localIds.length === 0) {
        return ResponseHandler.error(res, 'Invalid request. Please provide an array of localIds', 400);
    }
    
    if (localIds.length > 50) {
        return ResponseHandler.error(res, 'Maximum 50 cards per batch request', 400);
    }
    
    const result = await pokemonAPI.getCardsByLocalIdsBatch(localIds);
    
    ResponseHandler.success(res, result, `Batch request completed`);
}));

export default router;