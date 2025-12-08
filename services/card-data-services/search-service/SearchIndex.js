import { fetchCards } from "../api/APIClient.js";


export async function searchCards(query) {
    if(!query) return [];
    const cards = await fetchCards({q: `name:${query}`});
    return cards;
}