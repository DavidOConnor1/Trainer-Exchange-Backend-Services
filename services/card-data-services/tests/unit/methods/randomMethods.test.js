import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { RandomMethods } from '../../../api/methods/randomMethods.js';

describe('RandomMethods', () => {
    let randomMethods;
    let mockTCGdexClient;
    let mockCacheManager;
    let mockRetryHandler;
    let mockLogAPICall;

    beforeEach(() => {
        mockTCGdexClient = {
            random: {
                card: jest.fn(),
                set: jest.fn(),
                serie: jest.fn()
            }
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
        
        randomMethods = new RandomMethods(
            mockCacheManager,
            mockRetryHandler,
            mockLogAPICall
        );
        randomMethods.tcgdex = mockTCGdexClient;
    });

    describe('getRandomCard', () => {
        it('should return a random card', async () => {
            const mockCard = { id: 'swsh3-136', name: 'Furret', localId: '136' };
            mockTCGdexClient.random.card.mockResolvedValue(mockCard);
            
            const result = await randomMethods.getRandomCard();
            
            expect(result.name).toBe('Furret');
        });
    });

    describe('getRandomSet', () => {
        it('should return a random set', async () => {
            const mockSet = { id: 'swsh3', name: 'Rebel Clash', totalCards: 200 };
            mockTCGdexClient.random.set.mockResolvedValue(mockSet);
            
            const result = await randomMethods.getRandomSet();
            
            expect(result.name).toBe('Rebel Clash');
        });
    });

    describe('getRandomSerie', () => {
        it('should return a random serie', async () => {
            const mockSerie = { id: 'swsh', name: 'Sword & Shield' };
            mockTCGdexClient.random.serie.mockResolvedValue(mockSerie);
            
            const result = await randomMethods.getRandomSerie();
            
            expect(result.name).toBe('Sword & Shield');
        });
    });

    describe('getMultipleRandomCards', () => {
        it('should return specified number of random cards', async () => {
            const mockCard1 = { id: 'card1', name: 'Card 1' };
            const mockCard2 = { id: 'card2', name: 'Card 2' };
            
            mockTCGdexClient.random.card
                .mockResolvedValueOnce(mockCard1)
                .mockResolvedValueOnce(mockCard2);
            
            const result = await randomMethods.getMultipleRandomCards(2);
            
            expect(result).toHaveLength(2);
        });
    });
});