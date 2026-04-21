import express from 'express';
import { ResponseHandler } from '../utils/responseHandler.js';
import { getRequestMetrics } from '../middleware/logging.js';
import { pokemonAPI } from '../../api/APIClient.js';

const router = express.Router();

router.get('/', (req, res) => {
    ResponseHandler.success(res, {
        status: 'healthy',
        service: 'Pokemon TCG API Gateway (TCGdex)',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    }, 'Service is healthy');
});

router.get('/detailed', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    const requestMetrics = getRequestMetrics();
    
    ResponseHandler.success(res, {
        status: 'healthy',
        service: 'Pokemon TCG API Gateway (TCGdex)',
        version: '2.0.0',
        uptime: process.uptime(),
        metrics: {
            api: {
                totalCalls: apiCallLog.length,
                successful: apiCallLog.filter(log => log.status === 'success').length,
                failed: apiCallLog.filter(log => log.status === 'error').length
            },
            requests: requestMetrics
        },
        timestamp: new Date().toISOString()
    }, 'Detailed health status');
});

router.get('/status', (req, res) => {
    ResponseHandler.success(res, {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString()
    }, 'System status retrieved');
});

export default router;