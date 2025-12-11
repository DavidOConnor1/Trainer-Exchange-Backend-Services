import { webcrypto, createHash, randomBytes, timingSafeEqual } from "crypto";
const crypto = webcrypto;
import { createClient } from "@supabase/supabase-js";
import { exists } from "fs";


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
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if

        //return generic error
        return{
            data: null,
            err: new Error('Authenitcation Failed, please try again!')
        }//end return
    }//end catch
  }//end signIn protection

  async signUp(email, password, username, displayName){

    const startTime = Date.now()
    const MIN_EXECUTION_TIME = 1000 // Minimum 1 second execution

    try{
        //input validation with constant time
        if(!email || !password || !username){
            this.constantTimeDelay(150)
            throw new Error('All fields are required')
        }//end if

        //rate limiting check
        const clientIp = await this.getClientIp()
        const rateLimited = await this.checkRateLimit(this.constantTimeHash(clientIp))

        if(rateLimited){
            this.constantTimeDelay(200)
            throw new Error('Too many registration attempts, please try again later')
        }//end if

        //validate email format with constant time
        if(!this.isValidEmailConstantTime(email)){
            this.constantTimeDelay(100)
            throw new Error('invalid email format')
        }//end if

        //check password strength
        const passwordCheck = this.checkPasswordtrengthConstantTime(password)
        if(!passwordCheck.valid){
            this.constantTimeDelay(100)
            throw new Error(passwordCheck.message)
        }//end if

        //normalize inputs
        const normalizedEmail = email.toLowerCase().trim()
        const normalizedUsername = username.toLowerCase().trim()

        //check if user already exists
        const {exists: userMightExist } = await this.checkUserExistSafely(normalizedEmail)

        //attempts reg
        const {data, error} = await this.client.auth.signUp({
            email: normalizedEmail,
            password: password,
            options: {
                data: {
                    username: normalizedUsername,
                    display_name: displayName?.trim() || normalizedUsername
                }
            }
        })

        //Record Attempt
        this.recordAttempt(this.constantTimeHash(clientIp), !error)

        if(error){
            //handle errors with constant timing
            let genericError

            if(error.message.includes('Already Registered')){
                //user exists response with same time as non existant
                genericError = new Error('Registration failed. Please try again')
            } else if(error.message.includes('weak password')){
                genericError = new Error('Password does not match security requirements')
            } else {
                genericError = new Error('Registration failed. Please try again')
            }//end else

                //enforces minimum execution time
                const elapsed = Date.now() - startTime
                const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)

                if(remaining > 0){
                    this.constantTimeDelay(remaining)
                }//end if

                return {data: null, error: genericError}
        }//end if

        //successful registration
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if

        this.notify('auth:signup', data.user)
        return {data, error: null}
    } catch (err){
        //catch all with constant timing
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0,MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if

        return {
            data: null,
            err: new Error('Registration Failed. Try Again')
        }//end return
    }//end catch
  }//end signUp protection

  isValidEmailConstantTime(email){
    //executes same amount of operations 
    const operations = 1000
    let isValid = true

    //email regex
    for(let i=0; i < operations; i++){
        if(i === 500){
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            isValid = emailRegex.test(email || '')
        } else {
            //performs dummy
            Math.sqrt(i) * Math.random()
        }//end else
    }//end for
    return isValid
  }//end valid email

  //password strength check
  checkPasswordtrengthConstantTime(password){
    const checks = [
         { regex: /.{8,}/, message: 'Password must be at least 8 characters' },
      { regex: /[A-Z]/, message: 'Password must contain an uppercase letter' },
      { regex: /[a-z]/, message: 'Password must contain a lowercase letter' },
      { regex: /\d/, message: 'Password must contain a number' },
      { regex: /[@$!%*?&]/, message: 'Password must contain a special character (@$!%*?&)' }
    ]//end checks

    //Execute check regardless of failure
    let allValid = true
    let errorMessage = ''

    for(let i=0; i < checks.length; i++){
        const isValid = checks[i].regex.test(password || '')
        if(!isValid && allValid){
            allValid = false
            errorMessage = checks[i].message
        }//end if

        //dummy check
        for(let j =0; j < 100; j++){
            Math.sqrt(j) * Math.random()
        }//end for
    }//end for
    return{
        valid: allValid,
        message: errorMessage
    }
  }//end password check

  //safe user check, prevents data leakage
  async checkUserExistSafely(email){
    const hash = this.constantTimeHash(email)

    try{

        //rpc function executes constant time
        const {data, error} = await this.client.rpc('check_user_exists_safe', {
            email_hash: hash
        })

        if(error){
            //return ambiguous
            return {exists: false}
        }//end if

        return {exists: data}
    } catch (err){
        //returns same structure
        return {exists: false}
    }//end catch
  }//end checkUser

  //get Client IP 
  async getClientIp(){
    //generatesd a determinstic value
    return 'Client -' + this.constantTimeHash(navigator.userAgent)
  }//end get client ip

  //prevent timing attacks from sign out
  async signOut(){
    const startTime = Date.now()
    const MIN_EXECUTION_TIME = 300

    try{

        const {error} = await this.client.auth.signOut()
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if

        if(!error){
            this.notify('auth:signout', null)
        }//end if
        return {error}
    } catch(err){
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_EXECUTION_TIME - elapsed)
        if(remaining > 0){
            this.constantTimeDelay(remaining)
        }//end if
        return {err: new Error('Sign out Failed')}
    }//end catch
  }//end sign out

  notify(event, data){
    console.log(`Event: ${event}`, data)
  }//end notify


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
