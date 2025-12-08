import fetch, { Headers } from "node-fetch";
import { POKEMON_TCG_API_BASE_URL, HEADERS } from "./config.js";

//using class observer
class APIObserver {
    constructor() {
        this.observers = [];
    }

    subscribe(observer){
        this.observers.push(observer);
        return () => this.unsubscribe(observer);
    }

    unsubscribe(observer){
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notify(event, data){
        this.observers.forEach(observer => {
            if(observer[event]) {
                observer[event](data);
            }
        });
    }
}

//singleton 

class PokemonAPI {
    static instance = null;
    static observer = new APIObserver();

    constructor(){
        if(PokemonAPI.instance){
            return PokemonAPI.instance;
        }
    this.apiCallLog = new Map(); //tracks calls by the endpoint
    this.cache = new Map(); //cache responses to prevent duplicate calls
    PokemonAPI.instance = this;
    }

    static getInstance(){
        if(!PokemonAPI.instance){
            PokemonAPI.instance = new PokemonAPI();
        }
        return PokemonAPI.instance;
    }

    async makeRequest(endpoint, params = null){
        const url = params
        ?`${endpoint}?${new URLSearchParams(params).toString()}`
        : endpoint;

        const cacheKey = url;

        //checks cache first
        if(this.cache.has(cacheKey)){
            PokemonAPI.observer.notify('cacheHit', {
                endpoint: url,
                timestamp: new Date().toISOString()
            });
            return this.cache.get(cacheKey);
        }

        //logs api call 
        
    }

   
}

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
