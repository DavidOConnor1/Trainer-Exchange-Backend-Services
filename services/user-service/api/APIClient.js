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

    async signIn(email, password){
        const { error } = await this.client.auth.signOut()

        if(!error){
            this.notify('auth:signout', null)
        }//end if
        return { error }
    }//end signIn

    getCurrentUser(){
        return this.client.auth.getUser()
    }//end getCurrentUser

    onAuthStateChange(callback){
        return this.client.auth.onAuthStateChange((event, session) => {
            callback(event, session)
            this.notify('auth:change', {event, session})
        })
    }//end auth state change

    //user profile methods
    async updateProfile(userId, updates){
        const { data, error } = await this.client
        .from('users')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

        if(!error){
            this.notify('profile:update', data)
        }//end 

        return{ data, error }
    }//end updateProfile

    async getUserProfile(userId){
        return await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
    }//end getUserProfile

    //collection methods
    async createCollection(name, description, isPublic = false){
        const { data: user } = await this.getCurrentUser()

        if(!user) throw new Error('User not autheticated')

            const {data, error} = await this.client
            .from('collections')
            .insert({
                user_id: user.user_id,
                name,
                description,
                is_public: isPublic
            })
            .select()
            .single()

            if(!error){
                this.notify('collection:created', data)
            }//end if

            return { data, error }

    }//end createCollection

    async getUserCollections(userId = null){
        const { data: user } = await this.getCurrentUser()
        const targetedUserId = userId || user?.user?.id

        if(!targetedUserId) throw new Error('User ID required')

            return await this.client
            .from('collections')
            .select(`
                *,
                user:users(username, display_name)
                `)
                .eq('user_id', targetedUserId)
                .order('created_at', {ascending: false})
    }//end getUserCollections

    async getPublicCollections(){
        return await this.client
        .from('collections')
        .select(`
            *,
            user:users(username, display_name)
            `)
            .eq('is_public', true)
            .order('created_at', {ascending: false})
    }//end getPubicCollections

    
}//end supabase service