import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { pokemonAPI, apiObserver } from '../api/APIClient.js';
import { searchCards,
    searchCardsPaginated,
    searchCardsByName,
    searchCardsByType,
    searchCardsBySet,
    searchByMultipleCriteria } from '../search-service/SearchIndex.js';
import { QuerySanitizer } from '../search-service/SearchIndex.js';

//import logging and observers
import { LoggingObserver, ErrorTrackingObserver } from '../api/APIClient.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/*
    Security Middleware
*/

app.use(cors({
    origin: process.env.NODE_ENV === 'development'
    ? process.env.CORS_ORIGIN
    :['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT',  'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json());

//checking requests
app.use((req, res, next) => {
    console.log('=== INCOMING REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    console.log('Body:', req.body);
    console.log('=== END REQUEST ===');
    next();
});



/**
 * 
 *  Rate limiting
 */

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, //15 minutes
    max: 100, //limit to 100 per ip
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP try again later'
});

//rate limit to api routes
app.use('/api/', limiter);

/*
    Observer setup
*/

const loggingObserver = new LoggingObserver();
const errorTracking = new ErrorTrackingObserver();

apiObserver.subscribe(loggingObserver);
apiObserver.subscribe(errorTracking);

//middle ware to track all requests
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
};

app.use(requestLogger);

/*
    Input validation middle ware
*/

//validation for card id
const validateCardId = (req, res, next) => {
    const cardId = req.params.id;

    if(!cardId || typeof cardId !== 'string'){
        return res.status(400).json({
            success: false,
            error: 'Invalid Card ID'
        });
    }//end if 

    //sanitize card id
    const sanitizedId = QuerySanitizer.sanitizeString(cardId);
    if(sanitizedId !== cardId){
        console.warn(`Potentially malicious card ID detected: ${cardId} => ${sanitizedId}`);
    }//end if 

    req.sanitizedId = sanitizedId;
    next();
}; //end validate card ID 

const fetchCardById = async(id) => {
    try{
        const card = await pokemonAPI.fetchCardById(id);
        return {
            success: true,
            data: card
        };
    } catch(error){
        throw new Error(`Failed to fetch card: ${error.message}`) ;
    }//end catch
} //end fetch card by id 


//validate search query 

const validateSearchQuery = (req, res, next) => {
    //handles simple (single param) and complex params (multiple params)
    if(req.query.q && Object.keys(req.query).length === 1){
        //simple search validation
        const sanitizedQuery = QuerySanitizer.validateCardName(req.query.q);

        if(!sanitizedQuery && req.query.q.trim() !== ''){
            console.warn(`Invalid Search Query: ${req.query.q}`);
        }
        req.sanitizedQuery = sanitizedQuery || '';
    } else {
        //advance search - sanitize all parameters
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(req.query);
        req.searchParams = sanitizedParams;
    }
    next();
}; //end validate search query

// ROUTES

//Checking if the API is healthy
app.get('/health', (req,res) => {
   res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Pokemon TCG API GATEWAY'
   })
});

//api status endpoint
app.get('/api/status', (req, res) => {
     const apiCallLog = pokemonAPI.getAPICallLog();
    const errors = errorTracking.getErrors();

    res.json({
        success: true,
        data: {
            uptime: process.uptime(),
            apiCalls: apiCallLog.length,
            recentErrors: errors.slice(-10),
            cacheHits: apiCallLog.filter(log => log.status === 'success').length,
            lastApiCall: apiCallLog[apiCallLog.length -1]
        }
    });
});



//  search endpoint
app.get("/api/cards/search", validateSearchQuery, async (req, res) => {
    try {
        // Extract parameters
        const { 
            q, 
            name, 
            type, 
            set, 
            rarity, 
            hp,
            page = 1, 
            pageSize = 20,
            orderBy = 'name',
            ...otherParams 
        } = req.query;
        
        // Build search parameters object
        const searchParams = {};
        
        // Priority: Use direct q parameter if provided
        if (q) {
            searchParams.q = q;
        } //end if
        // Otherwise use specific fields
        else {
            if (name) searchParams.name = name;
            if (type) searchParams.type = type;
            if (set) searchParams.set = set;
            if (rarity) searchParams.rarity = rarity;
            if (hp) searchParams.hp = hp;
            
            // Add any other parameters that might be query fields
            Object.entries(otherParams).forEach(([key, value]) => {
                if (key.startsWith('q_')) {
                    // Support q_name, q_type, etc.
                    const field = key.substring(2);
                    searchParams[field] = value;
                }
            });
        }//end else
        
        //debugger logs
        console.log('Processing search:');
        console.log('Query params:', req.query);
        console.log('Search params:', searchParams);
        
        const results = await searchCards(searchParams, {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            orderBy: orderBy
        });
        
        res.json({
            success: true,
            data: results,
            count: results.length,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total: results.length
            },
            query: {
                original: req.query,
                processed: searchParams
            }
        });
        
    } catch (err) {
        console.error('Search endpoint error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }//catch
}); //end search



//admin endpoint
app.get("/api/admin/call-log", (req,res) => {
    //will add authentication later 
    const apiCallLog = pokemonAPI.getAPICallLog();

    res.json({
        success: true,
        data: apiCallLog,
        count: apiCallLog.length
    });
}); //end

// Add to server.js
app.get('/api/debug/query-test', async (req, res) => {
    try {
        const testQueries = [
            'name:pikachu*',      // Wildcard after name
            'name:"pikachu"',     // Exact match with quotes
            'name:pikachu',       // Simple name
            'name:"pikachu"*',    // Your current format
            'pikachu',            // Simple search
        ];
        
        const results = [];
        
        for (const query of testQueries) {
            try {
                console.log(`🔍 Testing query: ${query}`);
                const startTime = Date.now();
                
                const data = await pokemonAPI.fetchCards({
                    page: 1,
                    pageSize: 2,
                    q: query
                });
                
                const duration = Date.now() - startTime;
                
                results.push({
                    query,
                    success: true,
                    duration: `${duration}ms`,
                    cardsFound: Array.isArray(data) ? data.length : 'unknown',
                    firstCard: Array.isArray(data) && data.length > 0 ? data[0].name : 'none'
                });
                
                console.log(`✅ ${query}: ${duration}ms, ${Array.isArray(data) ? data.length : 'error'} cards`);
                
            } catch (error) {
                results.push({
                    query,
                    success: false,
                    error: error.message,
                    duration: 'failed'
                });
                console.log(`❌ ${query}: ${error.message}`);
            }
            
            // Wait a bit between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        res.json({
            success: true,
            tests: results,
            recommendation: results.find(r => r.success)?.query || 'none worked'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

//clear cache
app.post("/api/admin/clear-cache", (req,res) => {
    //will authentication later
    try{
        const previousSize = pokemonAPI.cache?.size || 0;
        pokemonAPI.clearCache();

        res.json({
            success: true,
            message: 'Cache cleared successfully',
            cacheCleared: previousSize
        });
    } catch(err) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache',
            message: err.message
        });
    }
}); //end cache

/*
    Error Handling
*/

//404 handling
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not Found',
        path: req.url
    });
}); //end 

//global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error: ',err);

    //notify observers
    apiObserver.notify('unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'something went wrong'
    });
}); //end global handler

const server = app.listen(PORT, () => {
    console.log(`
        Server is running!
        Port: ${PORT}
        URL: http://localhost:${PORT}
        Health: http://localhost:${PORT}/health
        API status: http://localhost:${PORT}/api/status
        `);
});

//shut down function

const shutdown = () => {
    console.log('\nServer Shutting Down..');

    //log final stats
    const apiCallLog = pokemonAPI.getAPICallLog();
    const errors = pokemonAPI.getErrors();

    console.log(`
        Final Stats:
        Total API Calls: ${apiCallLog.length}
        Successful: ${apiCallLog.filter(log => log.status === 'success').length}
        Failed: ${apiCallLog.filter(log => log.status === 'error').length}
        Total Errors: ${errors.length}
            `);

            server.close(() => {
                console.log('Server Closed');
                process.exit(0);
            });

            //force closes the server after 10 seconds
            setTimeout(() => {
                console.error('Force Shutdown');
                process.exit(1);
            }, 10000);
}//end shutdown

