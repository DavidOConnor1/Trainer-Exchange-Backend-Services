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
        const callId = Date.now();
        this.apiCallLog.set(callId, {
            endpoint: url,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });

        PokemonAPI.observer.notify('apiCallStart', {
            callId,
            endpoint: url,
            timestamp: new Date().toISOString()
        });

        try{ //open try
            const res = await fetch(url, {
                headers: HEADERS,
            });

            if(!res.ok){
                const errorData = {
                    callId,
                    endpoint: url,
                    status: res.status,
                    timestamp: new Date().toISOString()
                };
                this.apiCallLog.set(callId, {
                    ...this.apiCallLog.get(callId),
                    status: 'error',
                    error: `HTTP ${res.status}`,
                    response: null
                });

                PokemonAPI.observer.notify('apiCallError', errorData);
                throw new Error(`Failed to fetch: ${res.status}`);
            }

            const data = await res.json();
            const responseData = data.data || data;

            //update log with success
            this.apiCallLog.set(callId, {
                ...this.apiCallLog.get(callId),
                status: 'success',
                response: responseData,
                completedAt: new Date().toISOString()
            });

            //cache response
            this.cache.set(cacheKey, responseData);

            PokemonAPI.observer.notify('apiCallSuccess', {
                callId,
                endpoint: url,
                timestamp: new Date.toISOString(),
                dataLength: Array.isArray(responseData) ? responseData.length : 1
            });

            return responseData;

        }//end try
        catch(error){
            const errorData = {
                callId,
                endpoint: url,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.apiCallLog.set(callId, {
                ...this.apiCallLog.get(callId),
                status: 'error',
                error: error.message
            });

            PokemonAPI.observer.notify('apiCallError: ', errorData);
            throw error;
        }
    }//end make request

//fetch a single card by its id
 async fetchCardById(cardId) {
    const endpoint = `${POKEMON_TCG_API_BASE_URL}/cards/${cardId}`;
    return this.makeRequest(endpoint);      
 };

 //fetching multiple cards with query parameters
async  fetchCards(params = {}){
    const endpoint = `${POKEMON_TCG_API_BASE_URL}/cards`;
    return this.makeRequest(endpoint, params); 
    };

    //retrive api call history
    getAPICallLog() {
    return Array.from(this.apiCallLog.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  //get specific call details
  getCallDetails(callId){
    return this.apiCallLog.get(callId);
  }

  //clear cache
  clearCache() {
    this.cache.clear();
    PokemonAPI.observer.notify('cacheCleared', {
        timestamp: new Date().toISOString(),
        cacheSize: 0
    });
  }

  //clears api call log
  clearCallLog(){
    this.apiCallLog.clear();
  }
} //end pokemonAPI

//observers for monitoring
class LoggingObserver {
    apiCallStart(data) {
        console.log(`[${data.timestamp}] API call started: ${data.endpoint}`);
    }

    apiCallSuccess(data){
        console.log(`[${data.timestamp}] API call successful: ${data.endpoint} (${data.dataLength} items)`);
    }
    apiCallError(data){
        console.error(`[${data.timestamp}] API call failed: ${data.endpoint} - ${data.error}`);
    }

    cacheHit(data){
        console.log(`[${data.timestamp}] Cache Hit: ${data.endpoint}`);
    }
}//emd logging observer

//error tracker for the observer

class ErrorTrackingObserver{
    constructor(){
        this.errors = [];
    }

    apiCallError(data){
        this.errors.push({
            ...data,
            type: 'API_ERROR'
        });
    }

    getErrors(){
        return this.errors;
    }

    clearErrors(){
        this.errors = [];
    }
}//end error tracking observer






