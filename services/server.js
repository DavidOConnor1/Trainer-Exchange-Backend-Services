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