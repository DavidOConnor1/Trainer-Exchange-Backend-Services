import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { adminLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Status and metrics
router.get('/status', adminLimiter, adminController.getStatus);
router.get('/metrics', adminLimiter, adminController.getStatus); 
router.get('/errors', adminLimiter, adminController.getErrors);

// Call logs
router.get('/call-log', adminLimiter, adminController.getCallLog);
router.get('/call-log/:callId', adminLimiter, adminController.getCallDetails);

// Cache management
router.get('/cache-stats', adminLimiter, adminController.getCacheStats);
router.post('/clear-cache', adminLimiter, adminController.clearCache);

// Log management
router.post('/clear-logs', adminLimiter, adminController.clearLogs);
router.post('/reset-metrics', adminLimiter, adminController.resetMetrics);

export default router;