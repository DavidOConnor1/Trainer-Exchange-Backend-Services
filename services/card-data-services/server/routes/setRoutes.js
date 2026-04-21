import express from 'express';
import { setController } from '../controllers/setController.js';

const router = express.Router();

router.get('/', setController.getAllSets);
router.get('/series', setController.getAllSeries);
router.get('/:setId/cards', setController.getCardsBySet);
router.get('/type/:type/cards', setController.getCardsByType);

export default router;