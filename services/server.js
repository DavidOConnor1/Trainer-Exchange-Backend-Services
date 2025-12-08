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
    
}

// ROUTES

//fetch card via ID 
app.get("/api/cards/:id", async (req, res) => {
    try{
        const card = await fetchCardById(req.params.id);
        res.json(card);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

//search cards by name
app.get("/api/cards/search", async(req,res) => {
    try{
        const query = req.query.q;
        const results = await searchCards(query);
        res.json(results);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});