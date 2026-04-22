import { pokemonAPI } from '../../api/APIClient.js';
import { asyncHandler } from '../utils/errorHandler.js';
import { ResponseHandler } from '../utils/responseHandler.js';

export const setController = {
    getAllSets: asyncHandler(async (req, res) => {
        try {
            const sets = await pokemonAPI.getAllSets();
            ResponseHandler.success(res, sets, `${sets.length} sets retrieved`);
        } catch (error) {
            console.error('getAllSets error:', error);
            ResponseHandler.error(res, error);
        }
    }),

    getCardsBySet: asyncHandler(async(req, res) => {
        try {
            const { setId } = req.params;
            const { page = 1, pageSize = 20 } = req.query;
            
            const result = await pokemonAPI.getCardsBySet(setId, parseInt(page), parseInt(pageSize));
            
            ResponseHandler.paginated(res, result.data, {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                hasMore: result.hasMore,
                total: result.total
            }, `Cards from set ${setId} retrieved`);
        } catch (error) {
            console.error('getCardsBySet error:', error);
            ResponseHandler.error(res, error);
        }
    }),

    getAllSeries: asyncHandler(async(req, res) => {
        try {
            const series = await pokemonAPI.getAllSeriesWithSets?.() || [];
            ResponseHandler.success(res, series, `${series.length} series retrieved`);
        } catch (error) {
            console.error('getAllSeries error:', error);
            ResponseHandler.error(res, error);
        }
    }),

    getCardsByType: asyncHandler(async(req, res) => {
        try {
            const { type } = req.params;
            const { page = 1, pageSize = 20 } = req.query;
            
            const results = await pokemonAPI.searchCards({
                types: [type],
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            });
            
            ResponseHandler.paginated(res, results.data, {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                hasMore: results.hasMore
            }, `Cards of type ${type} retrieved`);
        } catch (error) {
            console.error('getCardsByType error:', error);
            ResponseHandler.error(res, error);
        }
    })
};