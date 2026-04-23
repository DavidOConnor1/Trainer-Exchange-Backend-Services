import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { CardPricingMethods } from '../../../api/methods/cardPricing.js';

describe('CardPricingMethods', () => {
    let cardPricing;
    let mockTCGdexClient;
    let mockCacheManager;
    let mockRetryHandler;
    let mockLogAPICall;

    beforeEach(() => {
        mockTCGdexClient = {
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
        
        cardPricing = new CardPricingMethods(
            mockCacheManager,
            mockRetryHandler,
            mockLogAPICall
        );
        cardPricing.tcgdex = mockTCGdexClient;
    });

    describe('extractCardmarketPricing', () => {
        it('should extract pricing data correctly from card data', () => {
            const mockCardData = {
                pricing: {
                    cardmarket: {
                        updated: 123456789,
                        unit: 1,
                        avg: 0.50,
                        low: 0.25,
                        trend: 0.55,
                        avg1: 0.48,
                        avg7: 0.52,
                        avg30: 0.50,
                        'avg-holo': 0.75,
                        'low-holo': 0.50,
                        'trend-holo': 0.80,
                        'avg1-holo': 0.70,
                        'avg7-holo': 0.73,
                        'avg30-holo': 0.75
                    }
                }
            };
            
            const result = cardPricing.extractCardmarketPricing(mockCardData);
            
            expect(result.avg).toBe(0.50);
            expect(result.trend).toBe(0.55);
            expect(result.avg30).toBe(0.50);
            expect(result.avgHolo).toBe(0.75);
        });

        it('should return null when no pricing data exists', () => {
            const mockCardData = { pricing: {} };
            const result = cardPricing.extractCardmarketPricing(mockCardData);
            expect(result).toBeNull();
        });
    });

    describe('fetchCardWithPricing', () => {
        it('should fetch card with pricing successfully', async () => {
            const mockCard = {
                id: 'swsh3-136',
                name: 'Furret',
                pricing: {
                    cardmarket: {
                        avg30: 0.50,
                        trend: 0.55,
                        avg: 0.48,
                        low: 0.25,
                        avg1: 0.47,
                        avg7: 0.49
                    }
                }
            };
            mockTCGdexClient.card.get.mockResolvedValue(mockCard);
            
            const result = await cardPricing.fetchCardWithPricing('swsh3-136');
            
            // Check that pricing data exists (truthy)
            expect(result.pricing).toBeTruthy();
            expect(result.pricing.avg30).toBe(0.50);
            expect(result.pricing.trend).toBe(0.55);
        });

        it('should return null pricing when no pricing available', async () => {
            const mockCard = { id: 'P-A', name: 'Promo Card', pricing: {} };
            mockTCGdexClient.card.get.mockResolvedValue(mockCard);
            
            const result = await cardPricing.fetchCardWithPricing('P-A');
            
            expect(result.pricing).toBeNull();
            expect(result.card.name).toBe('Promo Card');
        });
    });
});