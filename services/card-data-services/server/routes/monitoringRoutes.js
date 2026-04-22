import express from 'express';
import os from 'os';
import { pokemonAPI } from '../../api/APIClient.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { getRequestMetrics, resetMetrics } from '../middleware/logging.js';

const router = express.Router();

// ============================================
// SYSTEM HEALTH MONITORING
// ============================================

// Overall system health
router.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const memoryUsage = process.memoryUsage();
    
    res.json({
        success: true,
        data: {
            status: 'healthy',
            service: 'Pokemon TCG API Gateway',
            version: '2.0.0',
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            uptimeSeconds: uptime,
            startTime: new Date(Date.now() - uptime * 1000).toISOString(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                loadAverage: os.loadavg()
            },
            process: {
                nodeVersion: process.version,
                pid: process.pid,
                memoryUsage: {
                    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                    external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
                },
                cpuUsage: process.cpuUsage()
            }
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// API PERFORMANCE METRICS
// ============================================

// Detailed API metrics
router.get('/metrics', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    const cacheStats = pokemonAPI.getCacheStats();
    const requestMetrics = getRequestMetrics();
    
    // Calculate average response times
    const recentCalls = apiCallLog.slice(-100);
    const avgResponseTime = recentCalls.length > 0
        ? (recentCalls.reduce((sum, log) => {
            // You'd need to store response times in your logs
            return sum;
        }, 0) / recentCalls.length).toFixed(2)
        : 0;
    
    // Group by endpoint
    const endpointStats = {};
    apiCallLog.forEach(log => {
        const endpoint = log.endpoint;
        if (!endpointStats[endpoint]) {
            endpointStats[endpoint] = { total: 0, success: 0, error: 0 };
        }
        endpointStats[endpoint].total++;
        if (log.status === 'success') {
            endpointStats[endpoint].success++;
        } else {
            endpointStats[endpoint].error++;
        }
    });
    
    // Calculate success rate
    const totalCalls = apiCallLog.length;
    const successfulCalls = apiCallLog.filter(log => log.status === 'success').length;
    const successRate = totalCalls > 0 
        ? ((successfulCalls / totalCalls) * 100).toFixed(2)
        : 0;
    
    res.json({
        success: true,
        data: {
            summary: {
                totalApiCalls: totalCalls,
                successfulCalls,
                failedCalls: totalCalls - successfulCalls,
                successRate: `${successRate}%`,
                averageResponseTime: `${avgResponseTime}ms`,
                cacheHitRate: cacheStats.hitRate || '0%'
            },
            endpoints: endpointStats,
            cache: cacheStats,
            requests: requestMetrics,
            recentErrors: apiCallLog.filter(log => log.status === 'error').slice(-10)
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// PATTERN STATUS MONITORING
// ============================================

// Get pattern statistics (Circuit Breaker, Bulkhead, etc.)
router.get('/patterns', (req, res) => {
    const patternStats = {
        circuitBreaker: pokemonAPI.circuitBreaker ? {
            state: pokemonAPI.circuitBreaker.getState(),
            failures: pokemonAPI.circuitBreaker.failures,
            failureThreshold: pokemonAPI.circuitBreaker.failureThreshold,
            lastFailure: pokemonAPI.circuitBreaker.lastFailureTime
                ? new Date(pokemonAPI.circuitBreaker.lastFailureTime).toISOString()
                : null
        } : { state: 'NOT_CONFIGURED' },
        
        bulkheads: {
            search: pokemonAPI.searchBulkhead ? pokemonAPI.searchBulkhead.getStats() : { state: 'NOT_CONFIGURED' },
            card: pokemonAPI.cardBulkhead ? pokemonAPI.cardBulkhead.getStats() : { state: 'NOT_CONFIGURED' }
        },
        
        cache: pokemonAPI.optimizedCache ? pokemonAPI.optimizedCache.getStats() : { state: 'NOT_CONFIGURED' },
        
        rateLimiting: {
            tokenBucket: 'ACTIVE',
            globalLimiter: 'ACTIVE',
            searchLimiter: 'ACTIVE'
        }
    };
    
    res.json({
        success: true,
        data: patternStats,
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// SECURITY MONITORING
// ============================================

// Security metrics and alerts
router.get('/security', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    
    // Detect potential abuse patterns
    const ipRequests = new Map();
    const endpointHits = new Map();
    const failedAuthAttempts = [];
    
    apiCallLog.forEach(log => {
        // Track IP requests (if you store IP)
        if (log.params?.ip) {
            ipRequests.set(log.params.ip, (ipRequests.get(log.params.ip) || 0) + 1);
        }
        
        // Track endpoint popularity
        endpointHits.set(log.endpoint, (endpointHits.get(log.endpoint) || 0) + 1);
        
        // Track failed auth attempts
        if (log.status === 'error' && log.error?.includes('Unauthorized')) {
            failedAuthAttempts.push(log);
        }
    });
    
    // Find potential abuse (IPs with >100 requests)
    const potentialAbuse = Array.from(ipRequests.entries())
        .filter(([, count]) => count > 100)
        .map(([ip, count]) => ({ ip, requestCount: count }));
    
    res.json({
        success: true,
        data: {
            rateLimit: {
                currentActive: 'Monitoring active',
                limits: {
                    global: '100 per 15 minutes',
                    search: '30 per minute'
                }
            },
            abuseDetection: {
                potentialAbuse: potentialAbuse.length,
                abusiveIPs: potentialAbuse,
                totalUniqueIPs: ipRequests.size
            },
            endpoints: {
                mostHit: Array.from(endpointHits.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([endpoint, count]) => ({ endpoint, count })),
                totalUnique: endpointHits.size
            },
            securityHeaders: {
                xContentTypeOptions: 'nosniff',
                xFrameOptions: 'DENY',
                xssProtection: '1; mode=block',
                referrerPolicy: 'strict-origin-when-cross-origin'
            },
            recentSecurityEvents: failedAuthAttempts.slice(-20)
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// DATABASE/CACHE MONITORING
// ============================================

// Cache performance metrics
router.get('/cache', (req, res) => {
    const cacheStats = pokemonAPI.getCacheStats();
    const apiCallLog = pokemonAPI.getAPICallLog();
    
    // Calculate cache effectiveness
    const cacheableEndpoints = ['searchCards', 'getCardById', 'getAllSets'];
    const cacheableCalls = apiCallLog.filter(log => cacheableEndpoints.includes(log.endpoint));
    const estimatedCacheHits = cacheableCalls.length * 0.7; // Estimate based on pattern
    
    res.json({
        success: true,
        data: {
            currentCache: {
                size: cacheStats.size,
                keys: cacheStats.keys?.length || 0,
                ttl: '5 minutes default, 1 hour for cards, 24 hours for sets'
            },
            effectiveness: {
                hitRate: cacheStats.hitRate || 'Calculating...',
                estimatedDailyHits: estimatedCacheHits,
                cacheableRequests: cacheableCalls.length,
                reductionRatio: cacheableCalls.length > 0 
                    ? `${(100 - (cacheStats.size / cacheableCalls.length * 100)).toFixed(2)}%`
                    : '0%'
            },
            memoryUsage: {
                cacheMemory: '~' + (cacheStats.size * 2).toFixed(0) + 'KB (estimated)',
                totalHeap: process.memoryUsage().heapUsed / 1024 / 1024 + 'MB'
            }
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// PERFORMANCE PROFILING
// ============================================

// Performance profiling endpoint
router.get('/performance', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    const recentCalls = apiCallLog.slice(-200);
    
    // Group by hour
    const hourlyStats = new Map();
    recentCalls.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        if (!hourlyStats.has(hour)) {
            hourlyStats.set(hour, { total: 0, success: 0, error: 0 });
        }
        const stats = hourlyStats.get(hour);
        stats.total++;
        if (log.status === 'success') {
            stats.success++;
        } else {
            stats.error++;
        }
    });
    
    // Find peak hours
    const peakHour = Array.from(hourlyStats.entries())
        .sort((a, b) => b[1].total - a[1].total)[0];
    
    res.json({
        success: true,
        data: {
            throughput: {
                requestsLastHour: recentCalls.filter(log => {
                    const age = Date.now() - new Date(log.timestamp).getTime();
                    return age < 3600000;
                }).length,
                requestsPerMinute: (recentCalls.length / 200 * 60).toFixed(2),
                peakHour: peakHour ? {
                    hour: peakHour[0],
                    requests: peakHour[1].total
                } : null
            },
            hourlyDistribution: Array.from(hourlyStats.entries())
                .map(([hour, stats]) => ({ hour, ...stats }))
                .sort((a, b) => a.hour - b.hour),
            slowEndpoints: [] // Would need to track response times
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// ADMIN ACTIONS
// ============================================

// Reset monitoring metrics (admin only)
router.post('/reset', (req, res) => {
    // Clear API call logs
    pokemonAPI.clearCallLog();
    
    // Reset request metrics
    resetMetrics();
    
    // Reset pattern states if needed
    if (pokemonAPI.circuitBreaker) {
        pokemonAPI.circuitBreaker.reset();
    }
    
    res.json({
        success: true,
        message: 'Monitoring metrics reset successfully',
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// Clear cache (admin only)
router.post('/clear-cache', (req, res) => {
    const clearedSize = pokemonAPI.clearCache();
    
    res.json({
        success: true,
        message: `Cache cleared successfully`,
        clearedItems: clearedSize,
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

// ============================================
// ALERTS AND NOTIFICATIONS
// ============================================

// Get active alerts
router.get('/alerts', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    const recentErrors = apiCallLog.filter(log => log.status === 'error').slice(-50);
    const errorRate = apiCallLog.length > 0 
        ? (recentErrors.length / apiCallLog.length) * 100
        : 0;
    
    const alerts = [];
    
    // High error rate alert
    if (errorRate > 10) {
        alerts.push({
            severity: 'HIGH',
            type: 'ERROR_RATE',
            message: `Error rate is ${errorRate.toFixed(2)}% (threshold: 10%)`,
            timestamp: new Date().toISOString()
        });
    }
    
    // Circuit breaker open alert
    if (pokemonAPI.circuitBreaker && pokemonAPI.circuitBreaker.getState() === 'OPEN') {
        alerts.push({
            severity: 'CRITICAL',
            type: 'CIRCUIT_BREAKER',
            message: 'Circuit breaker is OPEN - external API may be failing',
            timestamp: new Date().toISOString()
        });
    }
    
    // Cache health alert
    const cacheStats = pokemonAPI.getCacheStats();
    if (cacheStats.size === 0 && apiCallLog.length > 100) {
        alerts.push({
            severity: 'MEDIUM',
            type: 'CACHE_HEALTH',
            message: 'Cache is empty despite significant API usage',
            timestamp: new Date().toISOString()
        });
    }
    
    res.json({
        success: true,
        data: {
            alerts: alerts,
            summary: {
                critical: alerts.filter(a => a.severity === 'CRITICAL').length,
                high: alerts.filter(a => a.severity === 'HIGH').length,
                medium: alerts.filter(a => a.severity === 'MEDIUM').length,
                low: alerts.filter(a => a.severity === 'LOW').length
            }
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

export default router;