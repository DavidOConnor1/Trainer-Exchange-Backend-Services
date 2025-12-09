import { createClient } from "@supabase/supabase-js";

class SupabaseService {
    static instance = null;

    constructor(){
        if(SupabaseService) {
            return SupabaseService.instance
        }//end if

        const supabaseUrl = import.meta.env.PROJECT_URL
        const supabaseKey = import.meta.env.ANONKEY

        if(!supabaseUrl || !supabaseKey){
            throw new Error('Missing Supabase Enviorment variables')
        }//end if

        this.client = createClient(supabaseUrl ,supabaseKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        })

        this.listeners = {}
        SupabaseService.instance = this
    }//constructor

    static getInstance(){
        if(!SupabaseService.instance){
            new SupabaseService()
        }//end if
        return SupabaseService.instance
    }//end instance

    getClient(){
        return this.client
    }//end getclient

    //observer pattern
    subscribe(event, callback){
        if(!this.listeners[event]){
            this.listeners[event] = []
        }//end if
        this.listeners[event].push(callback)

        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
        }
    }//end subscribe
}//end supabase service