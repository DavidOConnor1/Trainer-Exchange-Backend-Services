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

    notify(event, data) {
        if(this.listeners[event]){
            this.listeners[event].forEach(callback => {
                try{
                    callback(data)
                } catch(error){
                    console.error(`Error in ${event} observer:`, error)
                }//end catch
            })
        }//end if
    }//end notify

    //authentication method
    async signUp(email, password, username, displayName){
        const {data, error} = await this.client.auth.signUp({
            email,
            password,
            options:{
                data: {
                    username,
                    display_name: displayName
                }
            }//end options
        }) //end const

        if(!error){
            this.notify('auth:signup', data.user)
        }//end if
        return {data, error}
    }//end sign up
}//end supabase service