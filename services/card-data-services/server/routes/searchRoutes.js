import express from 'express';
import { searchController } from '../controllers/searchController.js';
import { validateSearchQuery } from '../middleware/validation.js';
import { searchLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/', validateSearchQuery, searchLimiter, searchController.searchCards);
router.get('/by-ability', searchLimiter, searchController.searchByAbility);
router.get('/by-attack', searchLimiter, searchController.searchByAttack);

export default router;