import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { pokemonAPI, APIObserver } from './card-data-services/api/APIClient';
import { searchCards } from './card-data-services/search-service/SearchIndex';
import { QuerySanitizer } from './card-data-services/search-service/SearchIndex';

//import logging and observers
import { LoggingObserver, ErrorTrackingObserver } from './card-data-services/api/APIClient';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/*
    Security Middleware
*/

app.use(cors({
    origin: process.env.CORS_ORIGIN || '',
    credentials: true
}));

app.use(express.json());

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

APIObserver.subscribe(loggingObserver);
APIObserver.subscribe(errorTracking);

//middle ware to track all requests
const requestMonitor = (req, res, next) => {
    const startTime = Date.now();

    //log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);

    //monitor response
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);

        //track errors
        if(res.statusCode >= 400){
            APIObserver.notify('apiCallError', {
                endpoint: req.url,
                method: req.method,
                status: res.statusCode,
                duration,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });
        }
    });
    next();
}; //end request monitor

app.use(requestMonitor);

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
        const sanitizedParams = QuerySanitizer.sanitizeQueryObjects(req.query);
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
            cacheHits: apiCallLog.filter(log => log.status === 'sucess').length,
            lastApiCall: apiCallLog[apiCallLog.length -1]
        }
    });
});

//fetches card by id 
app.get("/api/cards/:id", validateCardId, async(req,res) => {
    try{
        const cardId = req.sanitizedId;

        if(!cardId){
            return res.status(400).json({
                success: false,
                error: 'Invalid card id after sanitization'
            });
        }//end if

        const card = await pokemonAPI.fetchCardById(cardId);

        if(!card) {
            return res.status(404).json({
                success: false,
                error: 'Card not found'
            });
        } //end if
        
        res.json({
            success: true,
            data: card,
            timestamp: new Date().toISOString()
        });

    } catch(err) {
        console.error(`error fetching card ${req.params.id}: `,err);

        res.status(500).json({
            success: false,
            error: 'failed to fetch card',
            message: err.message,
            cardId: req.params.id
        });
    }
});

//search cards 
app.get("/api/cards/search", validateSearchQuery, async (req,res) => {
    try{
        let results;

        //determine search type
        if(req.sanitizedQuery !== undefined){
            //simple search
            if(!req.sanitizedQuery){
            return res.json({
                success: true,
                data: [],
                message: 'Empty Search Query',
                count: 0
            });
        }//end if not sanitizedQuery
         results = await searchCards(req.sanitizedQuery);
        } else {
            //advanced search
            results = await searchCards(req.searchParams);
        }//end else

            res.json({
                success: true,
                data: results,
                count: results.length,
                timestamp: new Date().toISOString()
            });

       
    }catch(err) {
        console.error('Search Error: ', err);

        res.status(500).json({
            success: false,
            error: 'Search Failed',
            message: err.message
        });
    } // end catch
}); //end search cards

//search with pagination support

app.get("/api/cards/advanced-search", validateSearchQuery, async (req, res) => {
    try{
        const { page =1, pageSize = 20, ...searchCriteria } = req.searchParams || req.query;

        //apply pagination
        const searchParams = {
            ...searchCriteria,
            page: Math.max(1, parseInt(page)),
            pageSize: Math.min(100, Math.max(1, parseInt(pageSize)))
        };

        const results = await searchCards(searchParams);

        res.json({
            success: true,
            data: results,
            pagination: {
                page: searchParams.page,
                pageSize: searchParams.pageSize,
                totalResults: results.length,
                hasMore: results.length === searchParams.pageSize
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Advanced Search Error: ', err);

        res.status(500).json({
            success: false,
            error: 'Advanced Search Failure',
            message: err.message
        });
    }//end catch
}); //end search with pagination support

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
    APIObserver.notify('unhandled error', {
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

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);