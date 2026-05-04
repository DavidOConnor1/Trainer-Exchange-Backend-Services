import express from "express";
import { cardController } from "../controllers/cardController.js";
import { validateLocalId, validateCardId } from "../middleware/validation.js";

const router = express.Router();

// Full‑ID pricing (e.g., /api/cards/id/swsh3-136/pricing)
router.get("/id/:fullId/pricing", cardController.getCardPricingByFullId);

// User‑facing routes (using localId)
router.get("/:localId", validateLocalId, cardController.getCardByLocalId);
//router.get("/:localId/pricing", validateLocalId, cardController.getCardPricing);

// Set‑specific card lookup
router.get("/:setId/:localId", cardController.getCardBySetAndLocalId);

// Internal SDK ID routes (debug only)
router.get("/internal/:sdkId", validateCardId, cardController.getCardBySdkId);

// Batch operations
router.post("/batch", cardController.batchGetCards);

export default router;
