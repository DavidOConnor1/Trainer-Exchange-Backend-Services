import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchCardById, searchCards } from './card-data-services/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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