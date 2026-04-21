import { QuerySanitizer } from '../../api/APIClient.js';

export const validateCardId = (req, res, next) => {
    const cardId = req.params.id || req.params.sdkId;

    if (!cardId || typeof cardId !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Invalid Card ID'
        });
    }

    const sanitizedId = QuerySanitizer.sanitizeString(cardId);
    if (sanitizedId !== cardId) {
        console.warn(`Potentially malicious card ID detected: ${cardId} => ${sanitizedId}`);
    }

    req.sanitizedId = sanitizedId;
    next();
};

export const validateLocalId = (req, res, next) => {
    const { localId } = req.params;
    
    if (!localId || typeof localId !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Invalid Local ID'
        });
    }

    const sanitizedLocalId = QuerySanitizer.sanitizeString(localId);
    req.sanitizedLocalId = sanitizedLocalId;
    next();
};

export const validateSearchQuery = (req, res, next) => {
    if (req.query.q && Object.keys(req.query).length === 1) {
        const sanitizedQuery = QuerySanitizer.validateCardName(req.query.q);
        if (!sanitizedQuery && req.query.q.trim() !== '') {
            console.warn(`Invalid Search Query: ${req.query.q}`);
        }
        req.sanitizedQuery = sanitizedQuery || '';
    } else {
        const sanitizedParams = QuerySanitizer.sanitizeQueryObject(req.query);
        req.searchParams = sanitizedParams;
    }
    next();
};