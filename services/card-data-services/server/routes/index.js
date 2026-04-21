import express from 'express';
import cardRoutes from './cardRoutes.js';
import searchRoutes from './searchRoutes.js';
import setRoutes from './setRoutes.js';
import healthRoutes from './healthRoutes.js';
import adminRoutes from './adminRoutes.js';
import batchRoutes from './batchRoutes.js';  

const router = express.Router();

router.use('/cards', cardRoutes);
router.use('/search', searchRoutes);
router.use('/sets', setRoutes);
router.use('/health', healthRoutes);
router.use('/admin', adminRoutes);
router.use('/batch', batchRoutes);  

export default router;