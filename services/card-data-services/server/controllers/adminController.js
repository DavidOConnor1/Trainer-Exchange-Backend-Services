import { pokemonAPI, apiObserver } from '../../api/APIClient.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { getRequestMetrics, resetMetrics } from '../middleware/logging.js';

export const adminController = {
    // Get comprehensive system status
    async getStatus(req, res) {
        try {
            const apiCallLog = pokemonAPI.getAPICallLog();
            const cacheStats = pokemonAPI.getCacheStats();
            const requestMetrics = getRequestMetrics();
            
            // Calculate success/failure rates for API calls
            const successfulCalls = apiCallLog.filter(log => log.status === 'success').length;
            const failedCalls = apiCallLog.filter(log => log.status === 'error').length;
            
            // Get recent errors
            const recentErrors = apiCallLog
                .filter(log => log.status === 'error')
                .slice(-10)
                .map(log => ({
                    timestamp: log.timestamp,
                    endpoint: log.endpoint,
                    error: log.error,
                    params: log.params
                }));
            
            ResponseHandler.success(res, {
                system: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV || 'development',
                    timestamp: new Date().toISOString()
                },
                api: {
                    totalCalls: apiCallLog.length,
                    successfulCalls,
                    failedCalls,
                    successRate: apiCallLog.length > 0 
                        ? ((successfulCalls / apiCallLog.length) * 100).toFixed(2) + '%'
                        : '0%',
                    lastCall: apiCallLog[apiCallLog.length - 1],
                    recentErrors
                },
                cache: {
                    size: cacheStats.size,
                    keys: cacheStats.keys,
                    hitRate: 'Coming soon' // Would need to track cache hits/misses
                },
                requests: requestMetrics
            }, 'System status retrieved');
        } catch (error) {
            console.error('getStatus error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Get detailed API call log
    async getCallLog(req, res) {
        try {
            const { limit = 100, status, endpoint } = req.query;
            let callLog = pokemonAPI.getAPICallLog();
            
            // Apply filters
            if (status) {
                callLog = callLog.filter(log => log.status === status);
            }
            if (endpoint) {
                callLog = callLog.filter(log => log.endpoint.includes(endpoint));
            }
            
            // Apply limit
            callLog = callLog.slice(-parseInt(limit));
            
            // Calculate summary
            const summary = {
                total: callLog.length,
                successful: callLog.filter(log => log.status === 'success').length,
                failed: callLog.filter(log => log.status === 'error').length,
                uniqueEndpoints: [...new Set(callLog.map(log => log.endpoint))].length
            };
            
            ResponseHandler.success(res, {
                summary,
                logs: callLog.reverse() // Most recent first
            }, `${callLog.length} API calls retrieved`);
        } catch (error) {
            console.error('getCallLog error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Get specific call details
    async getCallDetails(req, res) {
        try {
            const { callId } = req.params;
            const callDetails = pokemonAPI.getCallDetails(parseInt(callId));
            
            if (!callDetails) {
                return ResponseHandler.notFound(res, `API call with ID ${callId}`);
            }
            
            ResponseHandler.success(res, callDetails, 'Call details retrieved');
        } catch (error) {
            console.error('getCallDetails error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Get cache statistics
    async getCacheStats(req, res) {
        try {
            const stats = pokemonAPI.getCacheStats();
            const apiCalls = pokemonAPI.getAPICallLog();
            
            // Calculate cache effectiveness
            const cacheHits = apiCalls.filter(log => 
                log.endpoint?.includes('cache') || log.params?.cache === true
            ).length;
            
            ResponseHandler.success(res, {
                ...stats,
                effectiveness: {
                    hits: cacheHits,
                    totalCalls: apiCalls.length,
                    hitRate: apiCalls.length > 0 
                        ? ((cacheHits / apiCalls.length) * 100).toFixed(2) + '%'
                        : '0%'
                }
            }, 'Cache statistics retrieved');
        } catch (error) {
            console.error('getCacheStats error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Clear cache
    async clearCache(req, res) {
        try {
            const previousSize = pokemonAPI.clearCache();
            ResponseHandler.success(res, { 
                clearedSize: previousSize,
                timestamp: new Date().toISOString()
            }, `Cache cleared (${previousSize} items removed)`);
        } catch (error) {
            console.error('clearCache error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Clear API call logs
    async clearLogs(req, res) {
        try {
            pokemonAPI.clearCallLog();
            ResponseHandler.success(res, {
                timestamp: new Date().toISOString()
            }, 'API call logs cleared successfully');
        } catch (error) {
            console.error('clearLogs error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Reset all metrics
    async resetMetrics(req, res) {
        try {
            resetMetrics();
            ResponseHandler.success(res, {
                timestamp: new Date().toISOString()
            }, 'Request metrics reset successfully');
        } catch (error) {
            console.error('resetMetrics error:', error);
            ResponseHandler.error(res, error);
        }
    },

    // Get error tracking
    async getErrors(req, res) {
        try {
            // Get errors from the error tracking observer
            const errors = [];
            
            // You'll need to expose the error tracker from APIClient
            // For now, get from API call log
            const apiCallLog = pokemonAPI.getAPICallLog();
            const apiErrors = apiCallLog
                .filter(log => log.status === 'error')
                .map(log => ({
                    timestamp: log.timestamp,
                    type: 'API_ERROR',
                    endpoint: log.endpoint,
                    error: log.error,
                    params: log.params
                }));
            
            errors.push(...apiErrors);
            
            ResponseHandler.success(res, {
                total: errors.length,
                errors: errors.slice(-50) // Last 50 errors
            }, `${errors.length} errors retrieved`);
        } catch (error) {
            console.error('getErrors error:', error);
            ResponseHandler.error(res, error);
        }
    }
};