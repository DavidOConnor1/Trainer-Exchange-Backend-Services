import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import TCGdex, { Query } from '@tcgdex/sdk';

import apiRoutes from './routes/index.js';
import { ResponseHandler } from './utils/responseHandler.js';
import { ErrorHandler, asyncHandler } from './utils/errorHandler.js';
import { pokemonAPI, apiObserver } from '../api/APIClient.js';
import { LoggingObserver, ErrorTrackingObserver } from '../api/APIClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
let serverStartTime = Date.now();

// Simple request logging middleware
app.use((req, res, next) => {
    console.log('\n=== INCOMING REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Body:', req.body);
    }
    console.log('=== END REQUEST ===');
    
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusIcon = res.statusCode >= 200 && res.statusCode < 400 ? '✅' : '❌';
        console.log(`[${new Date().toISOString()}] ${statusIcon} ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
});

// Security middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'development'
        ? process.env.CORS_ORIGIN || 'http://localhost:3000'
        : ['http://localhost:3000', 'http://127.0.0.1:3000', process.env.FRONTEND_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', globalLimiter);

// Setup observers
const loggingObserver = new LoggingObserver();
const errorTracker = new ErrorTrackingObserver();
apiObserver.subscribe(loggingObserver);
apiObserver.subscribe(errorTracker);

/// Test function to verify TCGdex SDK connection
async function testTCGdexConnection() {
    console.log('\n🔌 Testing TCGdex SDK Connection...');
    try {
        const tcgdex = new TCGdex('en');
        
        // Test: Fetch a known card 
        console.log('  📡 Fetching test card:');
        const testCard = await tcgdex.fetch('sets', 'swsh3', '11');
        
        if (testCard && testCard.id) {
            console.log(`  ✅ TCGdex SDK connected successfully!`);
            console.log(`  📇 Test card found: ${testCard.name} (localId: ${testCard.localId})`);
            console.log(`  🃏 Card set: ${testCard.set?.name}`);
            
            // Check if Cardmarket pricing is available
            if (testCard.pricing?.cardmarket) {
                console.log(`  💰 Cardmarket pricing: AVAILABLE`);
                
                // Access pricing directly as per documentation - only avg30 and trend
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

// Test endpoint to fetch 5 UNIQUE random cards
app.get('/api/test/random', asyncHandler(async (req, res) => {
    const tcgdex = new TCGdex('en');
    
    console.log('\n🎲 Fetching 5 UNIQUE random cards for testing...');
    
    const randomCards = [];
    const usedIds = new Set();
    let attempts = 0;
    const maxAttempts = 20;
    
    while (randomCards.length < 5 && attempts < maxAttempts) {
        attempts++;
        console.log(`  Fetching random card ${randomCards.length + 1}/5 (attempt ${attempts})...`);
        
        const randomCard = await tcgdex.random.card();
        
        if (randomCard && randomCard.id && !usedIds.has(randomCard.id)) {
            usedIds.add(randomCard.id);
            
            
            randomCards.push({
                name: randomCard.name,
                localId: randomCard.localId,
                set: randomCard.set?.name,
                rarity: randomCard.rarity,
                trendPrice: trendPrice ? `€${trendPrice}` : 'N/A',
                avg30Price: avg30Price ? `€${avg30Price}` : 'N/A',
                hasPricing: !!randomCard.pricing?.cardmarket
            });
            
            console.log(`    ✅ Got: ${randomCard.name} (${randomCard.localId}) - Trend: ${trendPrice ? `€${trendPrice}` : 'N/A'}`);
        } else if (randomCard && usedIds.has(randomCard.id)) {
            console.log(`    ⚠️ Duplicate card: ${randomCard.name} (${randomCard.localId}), fetching another...`);
        } else {
            console.log(`    ❌ Failed to fetch random card, retrying...`);
        }
    }
    
    console.log(`\n✅ Successfully fetched ${randomCards.length}/5 unique random cards`);
    
    res.json({
        success: true,
        message: `Successfully fetched ${randomCards.length} unique random cards`,
        count: randomCards.length,
        cards: randomCards
    });
}));

// Helper function to parse card ID
function parseCardId(cardId) {
    // Check if the ID contains a dash (e.g., "smp-SM109")
    if (cardId.includes('-')) {
        const parts = cardId.split('-');
        // First part is set ID, remaining parts joined with dash is localId
        const setId = parts[0];
        const localId = parts.slice(1).join('-');
        return { type: 'full', setId, localId, fullId: cardId };
    }
    // Otherwise treat as SDK ID
    return { type: 'sdk', fullId: cardId };
}

// Debug endpoint to see raw card structure (handles both formats)
app.get('/api/debug/raw-card/:cardId', asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const tcgdex = new TCGdex('en');
    
    try {
        const parsed = parseCardId(cardId);
        let card;
        let fetchMethod = '';
        
        if (parsed.type === 'full') {
            // Method 1: Use set.get() then find card by localId
            console.log(`\n🔍 Parsed ID - Set: ${parsed.setId}, LocalId: ${parsed.localId}`);
            
            try {
                // Get the set first
                const set = await tcgdex.set.get(parsed.setId);
                console.log(`  📦 Found set: ${set.name}`);
                
                // Find the card in the set's cards array
                const cardResume = set.cards?.find(c => c.localId === parsed.localId);
                
                if (cardResume) {
                    // Get full card details using the relationship
                    card = await cardResume.getCard();
                    fetchMethod = `set.get('${parsed.setId}') → find card → getCard()`;
                    console.log(`  ✅ Retrieved card via set relationship`);
                } else {
                    throw new Error(`Card with localId ${parsed.localId} not found in set ${parsed.setId}`);
                }
            } catch (setError) {
                console.log(`  ⚠️ Set method failed: ${setError.message}`);
                
                // Method 2: Try direct card.get with full ID
                try {
                    card = await tcgdex.card.get(cardId);
                    fetchMethod = `card.get('${cardId}')`;
                    console.log(`  ✅ Retrieved card via direct card.get()`);
                } catch (cardError) {
                    // Method 3: Try searching by localId
                    const { Query } = await import('@tcgdex/sdk');
                    const query = Query.create()
                        .equal('set.id', parsed.setId)
                        .equal('localId', parsed.localId)
                        .paginate(1, 1);
                    
                    const cards = await tcgdex.fetch('cards', { query });
                    if (cards && cards.length > 0) {
                        card = cards[0];
                        fetchMethod = `fetch('cards', query)`;
                        console.log(`  ✅ Retrieved card via query search`);
                    } else {
                        throw new Error(`Card not found with any method`);
                    }
                }
            }
        } else {
            // Direct SDK ID lookup
            card = await tcgdex.card.get(parsed.fullId);
            fetchMethod = `card.get('${parsed.fullId}')`;
            console.log(`  ✅ Retrieved card via direct SDK ID`);
        }
        
        // Log the structure to console
        console.log('\n=== RAW CARD STRUCTURE ===');
        console.log('Fetch Method:', fetchMethod);
        console.log('Card ID:', card.id);
        console.log('Card Name:', card.name);
        console.log('Local ID:', card.localId);
        console.log('Set object:', card.set ? {
            id: card.set.id,
            name: card.set.name,
            hasSerie: !!card.set.serie,
            serieName: card.set.serie?.name
        } : 'No set');
        console.log('Pricing object:', card.pricing ? {
            hasCardmarket: !!card.pricing.cardmarket,
            cardmarketKeys: card.pricing.cardmarket ? Object.keys(card.pricing.cardmarket) : []
        } : 'No pricing');
        
        if (card.pricing?.cardmarket) {
            console.log('  - avg30:', card.pricing.cardmarket.avg30);
            console.log('  - trend:', card.pricing.cardmarket.trend);
            console.log('  - avg:', card.pricing.cardmarket.avg);
            console.log('  - low:', card.pricing.cardmarket.low);
        }
        
        console.log('Images:', card.images ? Object.keys(card.images) : 'No images object');
        console.log('Has getImageURL:', typeof card.getImageURL === 'function');
        console.log('========================\n');
        
        // Return detailed info
        res.json({
            success: true,
            fetchMethod,
            parsed: parsed.type === 'full' ? {
                type: 'full',
                setId: parsed.setId,
                localId: parsed.localId
            } : {
                type: 'sdk',
                fullId: parsed.fullId
            },
            card: {
                id: card.id,
                localId: card.localId,
                name: card.name,
                hasSet: !!card.set,
                setInfo: card.set ? {
                    id: card.set.id,
                    name: card.set.name,
                    series: card.set.serie?.name
                } : null,
                hasPricing: !!card.pricing?.cardmarket,
                pricing: card.pricing?.cardmarket ? {
                    avg30: card.pricing.cardmarket.avg30,
                    trend: card.pricing.cardmarket.trend,
                    avg: card.pricing.cardmarket.avg,
                    low: card.pricing.cardmarket.low
                } : null,
                hasImages: !!card.images,
                imageCount: card.images ? Object.keys(card.images).length : 0
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            cardId: cardId,
            parsed: parseCardId(cardId)
        });
    }
}));

// Debug endpoint to see raw card structure
app.get('/api/debug/raw-card/:cardId', asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const tcgdex = new TCGdex('en');
    
    try {
        const card = await tcgdex.card.get(cardId);
        
        // Log the structure to console
        console.log('\n=== RAW CARD STRUCTURE ===');
        console.log('Card ID:', card.id);
        console.log('Card Name:', card.name);
        console.log('Set object:', card.set ? {
            id: card.set.id,
            name: card.set.name,
            hasSerie: !!card.set.serie,
            serieName: card.set.serie?.name
        } : 'No set');
        console.log('Pricing object:', card.pricing ? {
            hasCardmarket: !!card.pricing.cardmarket,
            cardmarketKeys: card.pricing.cardmarket ? Object.keys(card.pricing.cardmarket) : []
        } : 'No pricing');
        console.log('Images:', card.images ? Object.keys(card.images) : 'No images object');
        console.log('Has getImageURL:', typeof card.getImageURL === 'function');
        console.log('========================\n');
        
         

        // Return minimal info
        res.json({
            id: card.id,
            name: card.name,
            hasSet: !!card.set,
            setInfo: card.set ? {
                id: card.set.id,
                name: card.set.name
            } : null,
            hasPricing: !!card.pricing?.cardmarket,
            pricingSample: card.pricing.cardmarket ? {
                avg30: card.pricing.cardmarket.avg30,
                trend: card.pricing.cardmarket.trend
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Original search endpoint
app.get('/api/test/search', asyncHandler(async (req, res) => {
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
}));

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
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
        startTime: new Date(serverStartTime).toISOString()
    });
});

// Status endpoint
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
            cacheSize: cacheStats.size
        }
    });
});

// Handle favicon request to avoid 404 logs
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content
});

// 404 handler
app.use((req, res) => {
    console.log(`[${new Date().toISOString()}] ❌ 404 - Route not found: ${req.url}`);
    ResponseHandler.error(res, `Route not found: ${req.url}`, 404);
});

// Global error handler
app.use(ErrorHandler.handle);

// Start server
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
║  📚 Available Endpoints:                                       ║
║  • GET  /health                    - Health check              ║
║  • GET  /api/status                - API status                ║
║  • GET  /api/cards/:localId        - Get card by localId       ║
║  • GET  /api/cards/:setId/:localId - Get card by set+localId   ║
║  • POST /api/batch/cards           - Batch get cards           ║
║  • POST /api/batch/cards/by-localid - Batch by localId         ║
║  • GET  /api/search                - Search cards              ║
║  • GET  /api/sets                  - Get all sets              ║
║  • GET  /api/sets/:setId/cards     - Get cards by set          ║
║  • GET  /api/test/random           - Test random cards         ║
╚════════════════════════════════════════════════════════════════╝
    `);
    
    // Test TCGdex connection
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