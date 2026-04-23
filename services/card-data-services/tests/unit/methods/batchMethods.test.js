import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BatchMethods } from '../../../api/methods/batchMethods.js';

describe('BatchMethods', () => {
    let batchMethods;
    let mockTCGdexClient;
    let mockCacheManager;
    let mockRetryHandler;
    let mockLogAPICall;

    beforeEach(() => {
        mockTCGdexClient = {
            fetch: jest.fn(),
            card: { get: jest.fn() }
        };
        
        mockCacheManager = {
            get: jest.fn(),
            set: jest.fn()
        };
        
        mockRetryHandler = {
            withRetry: jest.fn()
        };
        
        mockLogAPICall = jest.fn();
        
        mockRetryHandler.withRetry.mockImplementation(async (fn) => fn());
        
        batchMethods = new BatchMethods(
            mockCacheManager,
            mockRetryHandler,
            mockLogAPICall
        );
        batchMethods.tcgdex = mockTCGdexClient;
    });

    describe('getCardsBatch', () => {
        it('should fetch multiple cards by SDK IDs successfully', async () => {
            const mockCard1 = { id: 'swsh3-136', localId: '136', name: 'Furret', set: { name: 'Rebel Clash' }, rarity: 'Rare' };
            const mockCard2 = { id: 'swsh3-137', localId: '137', name: 'Snorlax', set: { name: 'Rebel Clash' }, rarity: 'Rare' };
            
            mockTCGdexClient.fetch
                .mockResolvedValueOnce(mockCard1)
                .mockResolvedValueOnce(mockCard2);
            
            const result = await batchMethods.getCardsBatch(['swsh3-136', 'swsh3-137']);
            
            expect(result.summary.total).toBe(2);
            expect(result.summary.successful).toBe(2);
            expect(result.results[0].data.name).toBe('Furret');
        });

        it('should handle failures when fetching cards', async () => {
            mockTCGdexClient.fetch.mockRejectedValue(new Error('API Error'));
            
            const result = await batchMethods.getCardsBatch(['invalid-id']);
            
            expect(result.summary.failed).toBe(1);
            expect(result.results[0].success).toBe(false);
        });

        it('should use cached cards when available', async () => {
            const cachedCard = { id: 'swsh3-136', localId: '136', name: 'Furret', set: { name: 'Rebel Clash' }, rarity: 'Rare' };
            mockCacheManager.get.mockReturnValue(cachedCard);
            
            const result = await batchMethods.getCardsBatch(['swsh3-136']);
            
            expect(mockTCGdexClient.fetch).not.toHaveBeenCalled();
            expect(result.results[0].success).toBe(true);
        });
    });

    describe('fetchFullCardDetails', () => {
        it('should fetch full card details for multiple cards', async () => {
            const mockFullCard = { id: 'swsh3-136', name: 'Furret', types: ['Colorless'], hp: 90 };
            mockTCGdexClient.card.get.mockResolvedValue(mockFullCard);
            
            const result = await batchMethods.fetchFullCardDetails(['swsh3-136']);
            
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Furret');
        });

        it('should filter out null results on failure', async () => {
            mockTCGdexClient.card.get.mockRejectedValue(new Error('Failed to fetch'));
            
            const result = await batchMethods.fetchFullCardDetails(['invalid-id']);
            
            expect(result).toHaveLength(0);
        });
    });
});