/*
    built this class in the event external servers crash and we need the application to keep running
*/

class CircuitBreaker {
    constructor(name, options = {}){
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000; //30 seconds
        this.timeout = options.timeout || 10000; //10 seconds

        this.state = 'CLOSED';
        this.failureCount =0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
    }//end constructor

    async execute(fn){
        //checks if circuit is open
        if(this.state === 'OPEN'){
            if(Date.now() < this.nextAttempt){
                throw new Error(`Circuit breaker is OPEN for ${this.name}`);
            }//end if 2
            this.state = 'HALFF_OPEN';
        }//end if 1
        try{
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), this.timeout);
            });

            const result = await Promise.race([fn(), timeoutPromise]);

            //success will reset the failure count
            if(this.state === 'HALF_OPEN'){
                this.state = 'CLOSED'
            }//end if
            this.failureCount = 0;

            return result;
        } catch(error){
            this.failureCount ++;
            this.lastFailureTime = Date.now();

            if(this.failureCount >= this.failureThreshold){
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.resetTimeout;
                console.warn(`Circuit Breaker OPEN for ${this.name}`);
            }//end if
            throw error;
        }//end catch
    }//end execute

    getStatus(){
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            nextAttempt: this.nextAttempt
        };
    }//end get status

    reset(){
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
    }//end reset
}//end circuit breaker

//singleton implementation for shared circuit breakers
class CircuitBreakerManager {
    constructor(){
        this.breakers = new Map();
    }//end constructor

    getBreaker(name, options){
        if(!this.breakers.has(name)){
            this.breakers.set(name, new CircuitBreaker(name, options));
        }//end if 
        return this.breakers.get(name);
    }//end get breaker

    getStatus(){
        const status = {};
        for(const [name, breaker] of this.breakers){
            status[name] = breaker.getStatus();
        }//end for
        return status;
    }//end get status

    resetAll(){
        for(const breaker of this.breakers.values()){
            breaker.reset();
        }//end for
    }//end restAll
}//end circuit breaker manager

//export singleton
export const circuitManager = new CircuitBreakerManager();
export  {circuitManager};