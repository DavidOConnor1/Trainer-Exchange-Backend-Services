import { pokemonAPI } from '../../api/APIClient.js';

// Store request metrics
const requestMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    byEndpoint: new Map(),
    byMethod: new Map(),
    recentRequests: []
};

export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Attach request ID to request object
    req.requestId = requestId;
    
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url} from ${req.ip}`);
    
    // Capture response data
    const originalJson = res.json;
    let responseBody = null;
    
    res.json = function(body) {
        responseBody = body;
        return originalJson.call(this, body);
    };
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        
        // Update metrics
        requestMetrics.total++;
        if (isSuccess) {
            requestMetrics.successful++;
        } else {
            requestMetrics.failed++;
        }
        
        // Track by endpoint
        const endpoint = req.route?.path || req.url.split('?')[0];
        if (!requestMetrics.byEndpoint.has(endpoint)) {
            requestMetrics.byEndpoint.set(endpoint, { total: 0, success: 0, failed: 0 });
        }
        const endpointStats = requestMetrics.byEndpoint.get(endpoint);
        endpointStats.total++;
        if (isSuccess) {
            endpointStats.success++;
        } else {
            endpointStats.failed++;
        }
        
        // Track by method
        if (!requestMetrics.byMethod.has(req.method)) {
            requestMetrics.byMethod.set(req.method, { total: 0, success: 0, failed: 0 });
        }
        const methodStats = requestMetrics.byMethod.get(req.method);
        methodStats.total++;
        if (isSuccess) {
            methodStats.success++;
        } else {
            methodStats.failed++;
        }
        
        // Store recent requests (keep last 100)
        requestMetrics.recentRequests.unshift({
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            success: isSuccess,
            ip: req.ip
        });
        
        if (requestMetrics.recentRequests.length > 100) {
            requestMetrics.recentRequests.pop();
        }
        
        // Log with status
        const statusIcon = isSuccess ? '✅' : '❌';
        console.log(`${statusIcon} [${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
        
        // Log API call to pokemonAPI if it's an API route
        if (req.url.startsWith('/api/')) {
            pokemonAPI.logAPICall(
                `${req.method} ${req.route?.path || req.url}`,
                { query: req.query, body: req.body, params: req.params },
                isSuccess,
                responseBody?.data?.length || 0,
                isSuccess ? null : new Error(`HTTP ${res.statusCode}`)
            );
        }
    });
    
    next();
};

// Detailed request logger for development
export const requestDetailsLogger = (req, res, next) => {
    console.log('=== INCOMING REQUEST DETAILS ===');
    console.log('Request ID:', req.requestId);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('Headers:', {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'origin': req.headers['origin']
    });
    console.log('=== END REQUEST DETAILS ===');
    next();
};

// Get request metrics
export const getRequestMetrics = () => {
    return {
        total: requestMetrics.total,
        successful: requestMetrics.successful,
        failed: requestMetrics.failed,
        successRate: requestMetrics.total > 0 
            ? ((requestMetrics.successful / requestMetrics.total) * 100).toFixed(2) + '%'
            : '0%',
        byEndpoint: Object.fromEntries(requestMetrics.byEndpoint),
        byMethod: Object.fromEntries(requestMetrics.byMethod),
        recentRequests: requestMetrics.recentRequests.slice(0, 20),
        uptime: process.uptime()
    };
};

// Reset metrics (admin function)
export const resetMetrics = () => {
    requestMetrics.total = 0;
    requestMetrics.successful = 0;
    requestMetrics.failed = 0;
    requestMetrics.byEndpoint.clear();
    requestMetrics.byMethod.clear();
    requestMetrics.recentRequests = [];
};