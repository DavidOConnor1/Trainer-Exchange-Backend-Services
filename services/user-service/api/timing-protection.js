import { webcrypto, createHash, randomBytes, timingSafeEqual } from "crypto";
const crypto = webcrypto;
import { createClient } from "@supabase/supabase-js";
import { compare } from "bcrypt";

class TimingProtectionUtility {

    constructor(){
        this.client = createClient (
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: false
                }
            }
        )

        //constant-time operations map
    this.constantTimeOps = {
        compare: this.constantTimeCompare.bind(this),
        hash: this.constantTimeHash.bind(this)
    }//end constantTimeOps

    //tracks authentication attempts 
    this.authAttempts = new Map()
    this.MAX_ATTEMPTS = 5
    this.LOCKOUT_DURATION = 15*60*1000 //15 mins
    }//end constructor

    

  //constant time string comparison
  static async constantTimeCompare(a, b) {
    try {
      const encoder = new TextEncoder();
      const aBuffer = encoder.encode(a || "");
      const bBuffer = encoder.encode(b || "");

      //same length buffers for comparison
      const maxLength = Math.max(aBuffer.length, bBuffer.length);
      const aPadded = new Uint8Array(maxLength).fill(0);
      const bPadded = new Uint8Array(maxLength).fill(0);

      aPadded.set(aBuffer);
      bPadded.set(bBuffer);

      if (crypto.subtle && crypto.subtle.timingSafeEqual) {
        return crypto.subtle.timingSafeEqual(aPadded, bPadded);
      }//end if

      //fail safe: if the above method fails continue to this method
      let result = 0;
      for (let i = 0; i < maxLength; i++) {
        result |= aPadded[i] ^ bPadded[i];
      } //end for
      return result === 0;
    } catch (err) {
        await this.constantTimeDelay(100)
        return false
    } //end catch
  } //end constantTime

  //constant-time hash for email lookup
  constantTimeHash(input){
    const inputToHash = input || ''
    return createHash('sha256')
    .update
    .digest('hex')
  }//end time hash


  static async constantTimeDelay(ms){
    return new Promise(resolve => {
        const start = Date.now()
        const check = () => {
            const elapsed = Date.now() - start
            if(elapsed >= ms){
                resolve()
            } else {
                requestAnimationFrame(check)
            }//end else
        }//end check
        check()
    })
  }//end time delay

  //checks if the ip or email is rate limited
  async checkRateLimit(identifier){
    const now = Date.now()
    const attmepts = this.authAttempts.get(identifier) || []

    //clears old attempts
    recentAttempts = attmepts.filter(time => now - time < this.LOCKOUT_DURATION)
    this.authAttempts.set(identifier, recentAttempts)

    if(recentAttempts.length >= this.MAX_ATTEMPTS){
        //executes constant time delay before returning
        this.constantTimeDelay(150)
        return true
    }//end if

    return false
  }//end check rate limiter

  //timing-attack protected signIn
  async signIn(email, password){
    const startTime = Date.now()
    const MIN_EXECUTION_TIME = 800 //minimum 800ms

    try{
        //input validation
        if(!email || !password){
            this.constantTimeDelay(150)
            throw new Error('Email or password may be incorrect')
        }//end if

        //rate limit checking
        const rateLimited = await this.checkRateLimit(this.constantTimeHash(email))
        if(rateLimited){
            this.constantTimeDelay(200)
            throw new Error('Too many attempts, please try again later')
        }//end if

        //normalizes inputs
        const normalizedEmail = email.toLowerCase().trim()
        const hashedEmail = this.constantTimeHash(normalizedEmail)

        //attempt authentication with SupaBase
        const {data, error} = await this.client.auth.signInWithPassword({
            email: normalizedEmail,
            password: password
        })

        //records attempt
        this.recordAttempt(hashedEmail, !error)

        if(error){
            //constant time operations run regardless
            this.constantTimeDelay(100)

            //generic error
            const genericError = new Error('invalid email or password')
            genericError.code = 'auth/invalid-credentials'

            //calculates remaining time
            const elapsed = Date.now() - startTime
            const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)

            if(remaining > 0){
                this.constantTimeDelay(remaining)
            }//end if
            return {data: null, error: genericError}
        }//end if

        //successful login
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if

        this.notify('auth:signin', data.user)
        return { data, error: null }
    } catch (err){
        //catches all unexpected errors
        const elapsed

    }//end catch
  }//end signIn protection

  //hash string (consistent timing)
  static async hashString(str){
    const encoder = new TextEncoder()
    const data = encoder.encode(str || '')

    try{
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    } catch(error){
        //fallback: simple hash with consistent timing
        await this.constantTimeDelay(10)
        let hash = 0
        for(let i = 0; i < (str || '').length; i++){
            hash = ((hash << 5) - hash) + str.charCodeAt(i)
            hash |= 0 //converts to 32 bit int
        }//end for
        return Math.abs(hash).toString(16)
    }//end catch
  }//end hash string

  //generates a random secure string
  static generateSecureRandom(length = 32){
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }//end generate randomsecure string

  //enforce minimum execution time for a function
  static async withMinimumTime(fn, minMs = 800){
    const startTime = Date.now()

    try{
        const result = await fn()
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, minMs = elapsed)

        if(remaining > 0){
            await this.constantTimeDelay(remaining)
        }//end if

        return result
    } catch(error){
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, minMs - elapsed)

        if(remaining > 0){
            await this.constantTimeDelay(remaining)
        }//end if

        throw error
    }//end catch
  }//end withMinimumtime
} //end class

export default TimingProtectionUtility
