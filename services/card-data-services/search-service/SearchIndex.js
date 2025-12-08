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

    static validateCardName(name) {
        if(!name || typeof name !== 'string') return false;

        //simple validation for card names
        const sanitizeName = this.sanitizeString(name);

        //ensure name does not return blank
        if(!sanitizeName.trim()) return false;

        //check the length
        if(sanitizeName.length > 30) return false;

        return sanitizeName;
    }//end validateCardName
}//end query sanitizer

export async function searchCards(query){
    //param is string, perform simple search
    if(typeof params === 'string') {
        const sanitized = QuerySanitizer.validateCardName(params);
    
    if(!sanitized) {
        console.warn(`Invalid Search Query: ${params}`);
        return [];
    }//end if

    try{

    const result = await pokemonAPI.fetchCards({
        q: `name:${sanitized}*`,  //wildcard 
        pageSize:20
    });
    return Array.isArray(result) ? result: [];
} catch(error) {
    console.error(`Error for search for: "${sanitizedName}":`, error);
    return [];
}
}

//if param is an object, perform advanced search
if(typeof params === 'object' && params !== null){
    const searchParams = {
        page: 1,
        pageSize: 20,
        orderBy: 'name',
        ...QuerySanitizer.sanitizeQueryObjects(searchParams.q)
    }; //end search params

    //if q exist, ensure format
    if(searchParams.q && typeof searchParams.q === 'string'){
        //removes malicious content
        searchParams.q = QuerySanitizer.sanitizeString(searchParams.q);
    }//end if 

    try{
        const result = await pokemonAPI.fetchCards(searchParams);
        Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('Error with the advanced search: ',error, {params: searchParams});
        return [];
    }//end catch
}//end if

//invalid input, return nothing
console.warn('invalid search params: ',params);
return[];
    
}