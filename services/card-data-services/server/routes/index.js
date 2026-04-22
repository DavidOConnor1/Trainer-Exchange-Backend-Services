import express from 'express';
import { verifyAPIKeyJWT, requireScope } from '../middleware/apiKeyAuth.js';
import cardRoutes from './cardRoutes.js';
import searchRoutes from './searchRoutes.js';
import setRoutes from './setRoutes.js';
import healthRoutes from './healthRoutes.js';
import adminRoutes from './adminRoutes.js';
import batchRoutes from './batchRoutes.js';
import monitoringRoutes from './monitoringRoutes.js';


const router = express.Router();

// Public routes (no authentication needed)
router.use('/health', healthRoutes);
router.use('/cards', cardRoutes);      // Card lookups - public
router.use('/search', searchRoutes);   // Card search - public
router.use('/sets', setRoutes);        // Set info - public
router.use('/batch', batchRoutes);     // Batch card fetch - public


// ============================================
// PROTECTED ROUTES (JWT API Key required)
// ============================================

// Admin routes - require admin scope
router.use('/admin', verifyAPIKeyJWT, requireScope('admin'), adminRoutes); //admin functions

// Monitoring routes - require monitoring scope
router.use('/monitoring', verifyAPIKeyJWT, requireScope('monitoring'), monitoringRoutes); //monitoring functions

export default router;  