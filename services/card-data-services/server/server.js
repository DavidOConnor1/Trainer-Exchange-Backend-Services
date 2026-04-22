import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible .env locations
const possiblePaths = [
    path.join(__dirname, '../../.env'),        // services/.env
    path.join(__dirname, '../.env'),           // card-data-services/.env
    path.join(process.cwd(), '.env'),          // current working directory
];

let envLoaded = false;
let loadedPath = null;

for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        envLoaded = true;
        loadedPath = envPath;
        break;
    }
}

if (!envLoaded) {
    console.error('❌ No .env file found! Looking in:');
    possiblePaths.forEach(p => console.error(`   - ${p}`));
    console.error('\n💡 Please create a .env file at: /home/davey/Documents/Trainer-Exchange-Backend-Services/services/.env');
    process.exit(1);
}

console.log(`✅ JWT_API_KEY_SECRET loaded: ${!!process.env.JWT_API_KEY_SECRET}`);
console.log(`✅ PORT loaded: ${process.env.PORT || '5000 (default)'}`);

import { ErrorHandler, asyncHandler } from './utils/errorHandler.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { 
    requestLogger, 
    requestDetailsLogger,
    globalLimiter, 
    searchLimiter,  
    securityHeaders
} from './middleware/index.js';
import { randomBytes } from 'crypto';
import TCGdex, { Query } from '@tcgdex/sdk';
import { validateEnvironment } from './utils/envValidator.js';
import apiRoutes from './routes/index.js';
import { pokemonAPI, apiObserver } from '../api/APIClient.js';
import { LoggingObserver, ErrorTrackingObserver } from '../api/APIClient.js';



const app = express();
const PORT = process.env.PORT || 5000;
let serverStartTime = Date.now();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Add unique request ID for tracing
app.use((req, res, next) => {
    req.id = randomBytes(16).toString('hex');
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Security headers middleware
app.use(securityHeaders);

// Helmet for additional security headers
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https://assets.tcgdex.net"],
        },
    } : false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
}));

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.CORS_ORIGIN].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    maxAge: 86400
}));

// Request limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request timeout
app.use((req, res, next) => {
    req.setTimeout(10000);
    res.setTimeout(10000);
    next();
});

// Trust proxy for production
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ============================================
// RATE LIMITING
// ============================================

app.use('/api/', globalLimiter);
app.use('/api/search', searchLimiter);

// ============================================
// REQUEST LOGGING
// ============================================

app.use(requestLogger, requestDetailsLogger );

// ============================================
// OBSERVER SETUP
// ============================================

const loggingObserver = new LoggingObserver();
const errorTracker = new ErrorTrackingObserver();
apiObserver.subscribe(loggingObserver);
apiObserver.subscribe(errorTracker);

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

app.use(validateEnvironment);

// ============================================
// TCGdex CONNECTION TEST
// ============================================

async function testTCGdexConnection() {
    console.log('\n🔌 Testing TCGdex SDK Connection...');
    try {
        const tcgdex = new TCGdex('en');
        
        console.log('  📡 Fetching test card');
        const testCard = await tcgdex.fetch('sets', 'swsh3', '11');
        
        if (testCard && testCard.id) {
            console.log(`  ✅ TCGdex SDK connected successfully!`);
            console.log(`  📇 Test card found: ${testCard.name} (localId: ${testCard.localId})`);
            console.log(`  🃏 Card set: ${testCard.set?.name}`);
            
            if (testCard.pricing?.cardmarket) {
                console.log(`  💰 Cardmarket pricing: AVAILABLE`);
                const avg30 = testCard.pricing.cardmarket.avg30;
                const trend = testCard.pricing.cardmarket.trend;
                
                if (avg30) {
                    console.log(`  💶 Price (avg30): €${avg30}`);
                } else {
                    console.log(`  💶 Price (avg30): NOT AVAILABLE`);
                }
                
                if (trend) {
                    console.log(`  📈 Price (trend): €${trend}`);
                } else {
                    console.log(`  📈 Price (trend): NOT AVAILABLE`);
                }
            } else {
                console.log(`  💰 Cardmarket pricing: NOT AVAILABLE`);
            }
            
            return true;
        } else {
            console.log('  ❌ TCGdex SDK connection failed: No card data returned');
            return false;
        }
    } catch (error) {
        console.log(`  ❌ TCGdex SDK connection failed: ${error.message}`);
        return false;
    }
}

// ============================================
// TEST ENDPOINTS
// ============================================

app.get('/api/test/random', asyncHandler(async (req, res) => {
    try {
        const tcgdex = new TCGdex('en');
        
        console.log(`\n[${req.id}] 🎲 Fetching 5 UNIQUE random cards for testing...`);
        
        const randomCards = [];
        const usedIds = new Set();
        let attempts = 0;
        const maxAttempts = 20;
        
        while (randomCards.length < 5 && attempts < maxAttempts) {
            attempts++;
            console.log(`[${req.id}]   Fetching random card ${randomCards.length + 1}/5 (attempt ${attempts})...`);
            
            const randomCard = await tcgdex.random.card();
            
            if (randomCard && randomCard.id && !usedIds.has(randomCard.id)) {
                usedIds.add(randomCard.id);
                
                const trendPrice = randomCard.pricing?.cardmarket?.trend;
                const avg30Price = randomCard.pricing?.cardmarket?.avg30;
                
                randomCards.push({
                    name: randomCard.name,
                    localId: randomCard.localId,
                    set: randomCard.set?.name,
                    rarity: randomCard.rarity,
                    trendPrice: trendPrice ? `€${trendPrice}` : 'N/A',
                    avg30Price: avg30Price ? `€${avg30Price}` : 'N/A',
                    hasPricing: !!randomCard.pricing?.cardmarket
                });
                
                console.log(`[${req.id}]     ✅ Got: ${randomCard.name} (${randomCard.localId}) - Trend: ${trendPrice ? `€${trendPrice}` : 'N/A'}`);
            } else if (randomCard && usedIds.has(randomCard.id)) {
                console.log(`[${req.id}]     ⚠️ Duplicate card: ${randomCard.name} (${randomCard.localId}), fetching another...`);
            }
        }
        
        console.log(`[${req.id}] ✅ Successfully fetched ${randomCards.length}/5 unique random cards`);
        
        res.json({
            success: true,
            message: `Successfully fetched ${randomCards.length} unique random cards`,
            count: randomCards.length,
            cards: randomCards
        });
    } catch (error) {
        console.error(`[${req.id}] Random card fetch error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}));

app.get('/api/test/random/:count', asyncHandler(async (req, res) => {
    try {
        const tcgdex = new TCGdex('en');
        let count = parseInt(req.params.count);
        
        if (isNaN(count) || count < 1) count = 1;
        if (count > 20) count = 20;
        
        console.log(`\n[${req.id}] 🎲 Fetching ${count} UNIQUE random cards for testing...`);
        
        const randomCards = [];
        const usedIds = new Set();
        let attempts = 0;
        const maxAttempts = count * 4;
        
        while (randomCards.length < count && attempts < maxAttempts) {
            attempts++;
            console.log(`[${req.id}]   Fetching random card ${randomCards.length + 1}/${count} (attempt ${attempts})...`);
            
            const randomCard = await tcgdex.random.card();
            
            if (randomCard && randomCard.id && !usedIds.has(randomCard.id)) {
                usedIds.add(randomCard.id);
                
                const trendPrice = randomCard.pricing?.cardmarket?.trend;
                const avg30Price = randomCard.pricing?.cardmarket?.avg30;
                
                randomCards.push({
                    name: randomCard.name,
                    localId: randomCard.localId,
                    setId: randomCard.set?.id,
                    set: randomCard.set?.name,
                    types: randomCard.types || [],
                    hp: randomCard.hp,
                    rarity: randomCard.rarity,
                    trendPrice: trendPrice ? `€${trendPrice}` : 'N/A',
                    avg30Price: avg30Price ? `€${avg30Price}` : 'N/A',
                    hasPricing: !!randomCard.pricing?.cardmarket
                });
                
                console.log(`[${req.id}]     ✅ Got: ${randomCard.name} (${randomCard.localId}) - ${randomCard.set?.name} - Trend: ${trendPrice ? `€${trendPrice}` : 'N/A'}`);
            } else if (randomCard && usedIds.has(randomCard.id)) {
                console.log(`[${req.id}]     ⚠️ Duplicate card: ${randomCard.name} (${randomCard.localId}), fetching another...`);
            }
        }
        
        console.log(`[${req.id}] ✅ Successfully fetched ${randomCards.length}/${count} unique random cards`);
        
        res.json({
            success: true,
            message: `Successfully fetched ${randomCards.length} unique random cards`,
            requestedCount: count,
            count: randomCards.length,
            cards: randomCards
        });
    } catch (error) {
        console.error(`[${req.id}] Random card fetch error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}));

app.get('/api/test/search', asyncHandler(async (req, res) => {
    try {
        const tcgdex = new TCGdex('en');
        const query = Query.create()
            .contains('name', 'Pikachu')
            .paginate(1, 5);
        
        const cards = await tcgdex.fetch('cards', { query });
        
        res.json({
            success: true,
            message: 'Test search successful',
            count: cards.length,
            cards: cards.map(c => ({ 
                id: c.id, 
                name: c.name, 
                localId: c.localId,
                set: c.set?.name
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));

// ============================================
// MAIN API ROUTES
// ============================================

app.use('/api', apiRoutes);

// ============================================
// HEALTH AND STATUS ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        success: true,
        status: 'healthy',
        service: 'Pokemon TCG API Gateway (TCGdex)',
        version: '2.0.0',
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        startTime: new Date(serverStartTime).toISOString(),
        requestId: req.id
    });
});

app.get('/api/status', (req, res) => {
    const apiCallLog = pokemonAPI.getAPICallLog();
    const errors = errorTracker.getErrors();
    const cacheStats = pokemonAPI.getCacheStats();

    res.json({
        success: true,
        data: {
            uptime: process.uptime(),
            startTime: new Date(serverStartTime).toISOString(),
            apiCalls: apiCallLog.length,
            successfulCalls: apiCallLog.filter(log => log.status === 'success').length,
            failedCalls: apiCallLog.filter(log => log.status === 'error').length,
            recentErrors: errors.slice(-10),
            lastApiCall: apiCallLog[apiCallLog.length - 1],
            cacheSize: cacheStats.size,
            environment: process.env.NODE_ENV || 'development'
        },
        requestId: req.id
    });
});

// ============================================
// MONITORING ROUTES 
// ============================================

import monitoringRoutes from './routes/monitoringRoutes.js';
app.use('/api/monitoring', monitoringRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    console.log(`[${req.id}] ❌ 404 - Route not found: ${req.url}`);
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.url}`,
        requestId: req.id
    });
});

// Global error handler
app.use(ErrorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, async () => {
    const loadTime = Date.now() - serverStartTime;
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    🎴 POKEMON TCG BACKEND SERVER              ║
╠════════════════════════════════════════════════════════════════╣
║  Server Status:     ✅ RUNNING                                 ║
║  Port:              ${String(PORT).padEnd(38)}║
║  Environment:       ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║  URL:               http://localhost:${PORT}${' '.repeat(38 - String(PORT).length - 19)}║
║  Load Time:         ${loadTime}ms${' '.repeat(38 - String(loadTime).length)}║
╠════════════════════════════════════════════════════════════════╣
║  🔒 Security Features:                                         ║
║  • Request ID Tracing     • Rate Limiting                      ║
║  • CORS Restrictions      • Request Timeout (10s)              ║
║  • Helmet Headers         • Size Limits (1mb)                  ║
║  • Security Headers       • Trust Proxy (prod)                 ║
╠════════════════════════════════════════════════════════════════╣
║  📚 Available Endpoints:                                       ║
║  • GET  /health                    - Health check              ║
║  • GET  /api/status                - API status                ║
║  • GET  /api/monitoring/health     - System health             ║
║  • GET  /api/monitoring/metrics    - API metrics               ║
║  • GET  /api/monitoring/security   - Security status           ║
║  • GET  /api/monitoring/dashboard  - Monitoring dashboard      ║
║  • GET  /api/cards/:localId        - Get card by localId       ║
║  • GET  /api/cards/:setId/:localId - Get card by set+localId   ║
║  • POST /api/batch/cards           - Batch get cards           ║
║  • GET  /api/search                - Search cards              ║
║  • GET  /api/sets                  - Get all sets              ║
║  • GET  /api/sets/:setId/cards     - Get cards by set          ║
║  • GET  /api/test/random           - Test random cards         ║
╚════════════════════════════════════════════════════════════════╝
    `);
    
    const isConnected = await testTCGdexConnection();
    
    if (isConnected) {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚀 TCGdex SDK:                    ✅ CONNECTED                ║
║  📡 API Status:                    READY                       ║
║  💰 Cardmarket Pricing:            ENABLED                     ║
╚════════════════════════════════════════════════════════════════╝
        `);
    } else {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ⚠️  TCGdex SDK:                    ❌ FAILED                  ║
║  Please check your network connection and try again.          ║
╚════════════════════════════════════════════════════════════════╝
        `);
    }
    
    console.log(`✅ Server started successfully in ${loadTime}ms\n`);
});

// Graceful shutdown
const shutdown = () => {
    console.log('\n🛑 Server shutting down...');

    const apiCallLog = pokemonAPI.getAPICallLog();
    const errors = errorTracker.getErrors();
    const cacheStats = pokemonAPI.getCacheStats();
    const totalRequests = apiCallLog.length;
    const successfulRequests = apiCallLog.filter(log => log.status === 'success').length;
    const failedRequests = apiCallLog.filter(log => log.status === 'error').length;

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    📊 FINAL STATISTICS                        ║
╠════════════════════════════════════════════════════════════════╣
║  Total API Calls:   ${String(totalRequests).padEnd(38)}║
║  Successful:        ${String(successfulRequests).padEnd(38)}║
║  Failed:            ${String(failedRequests).padEnd(38)}║
║  Success Rate:      ${totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) + '%' : 'N/A'.padEnd(38)}║
║  Total Errors:      ${String(errors.length).padEnd(38)}║
║  Cache Size:        ${String(cacheStats.size).padEnd(38)}║
║  Uptime:            ${String(Math.floor(process.uptime()) + 's').padEnd(38)}║
╚════════════════════════════════════════════════════════════════╝
    `);

    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('⚠️ Force shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;