// Mock card data for testing
export const mockCard = {
    id: 'swsh3-136',
    localId: '136',
    name: 'Furret',
    category: 'Pokemon',
    rarity: 'Rare',
    hp: 90,
    types: ['Colorless'],
    set: {
        id: 'swsh3',
        name: 'Rebel Clash',
        series: 'Sword & Shield'
    },
    pricing: {
        cardmarket: {
            avg30: 0.05,
            trend: 0.07
        }
    },
    images: {
        small: 'https://assets.tcgdex.net/en/swsh/swsh3/136-small.jpg',
        large: 'https://assets.tcgdex.net/en/swsh/swsh3/136.jpg'
    }
};

export const mockSearchResults = {
    data: [mockCard],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false
};

export const mockCardList = [
    { id: 'swsh3-136', name: 'Furret', localId: '136' },
    { id: 'swsh3-137', name: 'Snorlax', localId: '137' },
    { id: 'swsh3-138', name: 'Pikachu', localId: '138' }
];