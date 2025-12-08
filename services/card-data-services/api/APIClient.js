import fetch, { Headers } from "node-fetch";
import { POKEMON_TCG_API_BASE_URL, HEADERS } from "./config.js";



//fetch a single card by its id
export async function fetchCardById(cardId) {
    const res = await fetch(`${POKEMON_TCG_API_BASE_URL}/cards/${cardId}`,{
        headers: HEADERS,
    });

    //if the res is not okay throw error
    if(!res.ok){
        throw new Error(` Failed to fetch card: ${res.status}`);
    }
    
    const data = await res.json();
    return data.data; //the data will be wrapped in {data {...}}

}

//fetching multiple cards with query parameters

export async function fetchCards(params = {}){
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${POKEMON_TCG_API_BASE_URL}/cards?${query}`, {
        headers:HEADERS,
    });

    //if res not okay, throw error
    if(!res.ok){
        throw new Error(`Failed to fetch cards: ${res.status}`);
    }

    //returns data if successful
    const data = await res.json();
    return data.data;
}
