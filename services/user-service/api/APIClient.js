import { createClient } from "@supabase/supabase-js";
import SecureAuthService from "./SecureAuthService";
import TimingProtectionUtility from "./timing-protection";

class SupabaseService {
  static instance = null;

  constructor() {
    if (SupabaseService) {
      return SupabaseService.instance;
    } //end if

    //iniatilize supabase client
    const supabaseUrl = import.meta.env.PROJECT_URL;
    const supabaseKey = import.meta.env.ANONKEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase Enviorment variables");
    } //end if

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: "pokemon_auth_token",
        storage: this.getSecureStorage(),
      },
      global: {
        headers: {
          "X-Client-ID": this.getClientId(),
        },
      },
    }); //end create client

    //intialize secure auth service
    this.authService = new SecureAuthService(this.client);

    //observer pattern setup
    this.listeners = {};

    //generate a client id
    this.clientId = this.getClientId();

    SupabaseService.instance = this;
  } //constructor

  static getInstance() {
    if (!SupabaseService.instance) {
      new SupabaseService();
    } //end if
    return SupabaseService.instance;
  } //end instance

  //gets or creates client id
  getClientId() {
    if (typeof window === "undefined") {
      return "server-" + TimingProtectionUtility.generateSecureRandom(8);
    } //end if

    let clientId = localStorage.getItem("pokemon_client_id");

    if (!clientId) {
      clientId = TimingProtectionUtility.generateSecureRandom(16);
      localStorage.setItem("pokemon_client_id", clientId);
    } //end if
    return clientId;
  } //end get client id

  //secure storage for auth tokens
  getSecureStorage() {
    if (typeof window === "undefined") {
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }; //end return
    } //end if

    return {
      getItem: (key) => {
        try {
          const item = localStorage.getItem(key);
          if (!item) return null;

          //obfuscation
          return this.deobfuscate(item);
        } catch {
          return null;
        } //end catch
      }, //end get item
      setItem: (key, value) => {
        try {
          //simple obfuscation
          const obfuscation = this.obfuscate(value);
          localStorage.setItem(key, obfuscated);
        } catch (error) {
          console.error("Failed to store auth token: ", error);
        }
      }, //end set item
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error("Failed to remove auth token: ", error);
        } //end catch
      }, //end removeItem
    }; //end return
  } //end secure storage

  //obfuscate
  obfuscate(str) {
    if (typeof window === "undefined") return str;
    return btoa(unescape(encodeURIComponent(str)));
  } //obfuscate

  deobfuscate(str) {
    if (typeof window === "undefined") return str;
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return null;
    } //end catch
  } //deobfuscate

  //observer pattern
  subscribe(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    } //end if
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    };
  } //end subscribe

  notify(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} observer:`, error);
        } //end catch
      });
    } //end if
  } //end notify

  //authentication method
  async signUp(email, password, username, displayName) {
    const { data, error } = await this.authService.signUp(
      email,
      password,
      username,
      displayName
    );

    if (!error && data?.user) {
      this.notify("auth:signup", { user: data.user, timestamp: new Date() });
    } else if (error) {
      this.notify("auth:error", {
        type: "signup",
        error: error.message,
        timestamp: new Date(),
      });
    } //end else if
    return { data, error };
  } //end sign up

  async signIn(email, password) {
    const { data, error } = await this.authService.signIn(email, password);

    if (!error && data?.user) {
      this.notify("auth:signin", { user: data.user, timestamp: new Date() });
    } else if (error) {
      this.notify("auth:error", {
        type: "signin",
        error: error.message,
        timestamp: new Date(),
      });
    } //end else if
    return { data, error };
  } //end signIn

  async getCurrentUser() {
    return await this.authService.getCurrentUser();
  } //end getCurrentUser

  onAuthStateChange(callback) {
    return this.client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
      this.notify("auth:change", { event, session });
    });
  } //end auth state change

  //user profile methods
  async updateProfile(userId, updates) {
    const validatedUpdates = this.validateProfileUpdates(updates);

    const { data, error } = await this.client
      .from("users")
      .update({
        ...validatedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (!error) {
      this.notify("profile:update", data);
    } //end

    return { data, error };
  } //end updateProfile

  async getUserProfile(userId) {
    return await this.client
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
  } //end getUserProfile

  //collection methods
  async createCollection(name, description, isPublic = false) {
    const MIN_TIME = 300;

    const createOperation = async () => {
      const { data: user } = await this.getCurrentUser();

      if (!user?.user) {
        throw new Error("User not authenticated");
      } //end if

      const { data, error } = await this.client
        .from("collections")
        .insert({
          user_id: user.user.id,
          name: name.substring(0, 100),
          description: description?.substring(0, 1000),
          is_public: isPublic,
        })
        .select()
        .single();

      if (!error) {
        this.notify("collection:created ", data);
      } //end if

      return { data, error };
    }; //end create operation
    return await TimingProtectionUtility.withMinimumTime(
      createOperation,
      MIN_TIME
    );
  } //end createCollection

  async getUserCollections(userId = null) {
    const MIN_TIME = 300;
    const queryOperation = async () => {
      const { data: user } = await this.getCurrentUser();
      const targetedUserId = userId || user?.user?.id;

      if (!targetedUserId) throw new Error("User ID required");

      return await this.client
        .from("collections")
        .select(
          `
                *,
                user:users(username, display_name)
                `
        )
        .eq("user_id", targetedUserId)
        .order("created_at", { ascending: false });
    }; //end query operation
    return await TimingProtectionUtility.withMinimumTime(
      queryOperation,
      MIN_TIME
    );
  } //end getUserCollections

  async getPublicCollections() {
    return await this.client
      .from("collections")
      .select(
        `
            *,
            user:users(username, display_name)
            `
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false });
  } //end getPubicCollections

  async updateCollection(collectionId, updates) {
    const { data, error } = await this.client
      .from("collections")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", collectionId)
      .select()
      .single();

    if (!error) {
      this.notify("collection:updated", data);
    } //end

    return { data, error };
  } // end update collection

  async deleteCollection(collectionId) {
    const { error } = await this.client
      .from("collections")
      .delete()
      .eq("id", collectionId);

    if (!error) {
      this.notify("collection:deleted ", { id: collectionId });
    } //end if

    return { error };
  } //end delete collection

  //card management methods
  async addCardToCollection(collectionId, cardData) {
    const { data, error } = await this.client
      .from("collection_cards")
      .insert({
        collection_id: collectionId,
        card_id: cardData.id,
        quantity: cardData.quantity || 1,
        condition: cardData.condition || "Mint",
        notes: cardData.notes,
        acquired_at: cardData.acquired_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (!error) {
      this.notify("card:added", data);
    } //end if

    return { data, error };
  } //end addCardToCollection

  async getCollectionCards(collectionId) {
    return await this.client
      .from("collection_cards")
      .select("*")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false });
  } //end get collection cards

  async updateCard(cardId, updates) {
    const { data, error } = await this.client
      .from("collection_cards")
      .update(updates)
      .eq("id", cardId)
      .select()
      .single();

    if (!error) {
      this.notify("card:updated", data);
    } //end error
  } //end update card

  async removeCardFromCollection(cardId) {
    const { error } = await this.client
      .from("collection_cards")
      .delete()
      .eq("id", cardId);

    if (!error) {
      this.notify("card:removed", { id: cardId });
    } //end if

    return { error };
  } //end remove card

  async searchCardsInCollection(collectionId, query) {
    const response = await fetch(
      `/api/cards/search?q=${encodeURIComponent(query)}`
    );
    const cards = await response.json();

    //clarifies what cards are already in the collection
    const { data: existingCards } = await this.getCollectionCards(collectionId);
    const existingCardIds = new Set(existingCards.map((card) => card.card_id));

    return cards.map((card) => ({
      ...card,
      inCollection: existingCardIds.has(card.id),
      collectionData: existingCards.find((ec) => ec.card_id === card.id),
    }));
  } //end search card in collection

  //validation methods
  validateProfileUpdates(updates){
    const allowedFields = ['username', 'displayname', 'avatar_url']
    const validated = {}

    for(const field of allowedFields){
        if(updates[field] === undefined){
            if(typeof updates[field] === 'string'){
                validated[field] = updates[field].trim().substring(0, 100)
            } else {
                validated[field] = updates[field];
            }//end else
        }//end if 1
    }//end for
    return validated;
  }//end  validate profile update

  //additional security methods
  clearSensitiveData(){
    //clear rate limit
    this.authService.clearRateLimting();

    //clear local storage
    if(typeof window !=='undefined'){
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('pokemon_auth_token');
    }//end if

    this.notify('security: data_cleared', {timestamp: new Date()});
  }//end clear sensitive data

  getClientInfo(){
    return {
        clientId: this.clientId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent: 'server',
        timestamp: new Date().toISOString()
    }; //end return
  } //end client info
} //end supabase service

export const supabaseService = SupabaseService.getInstance();
export default supabaseService;
