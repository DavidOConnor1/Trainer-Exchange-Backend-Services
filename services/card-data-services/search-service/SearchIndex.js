import { pokemonAPI } from "../api/APIClient";

//Query Sanitization to prevent any sort of attacks on the system

class QuerySanitizer{
    static sanitizeString(input){
        if(typeof input !== 'string'){
            return '';
        }

        //Removing potentially damaging characters
    const sanitized = input.replace(/[^a-azA-Z0-9\s\-']/g, '');

    //trim and limit length
    return sanitized.trim().slice(0,100);
    }//end sanitizeString

    //sanitize objects
    static sanitizeQueryObjects(params){
        const sanitized = {};
        for(const [key, value] of Object.entries(params)){
            if(typeof value == 'string'){
                sanitized[key] = this.sanitizeString(value);
            } else if(typeof value == 'number'){
                sanitized[key] = value;
            } else if(Array.isArray(value)){
                sanitized[key] = value.map(item => 
                    typeof item == 'string' ? this.sanitizeString(item) : item
                );
            } else if(typeof value === 'object' && value !== null){
                //Recursively sanitize nested objects
                sanitized[key] = this.sanitizeQueryObjects(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }//end sanitizeQueryObjects
}