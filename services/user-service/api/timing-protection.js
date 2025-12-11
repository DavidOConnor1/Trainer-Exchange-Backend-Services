import { webcrypto, createHash, randomBytes, timingSafeEqual } from "crypto";
const crypto = webcrypto;




class TimingProtectionUtility {

    constructor(){
       

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

      if (crypto.subtle?.timingSafeEqual) {
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

  //record auth attempt
  recordAttempt(identifier, success)
  {
    const now = Date.now()
    const attempts = this.authAttempts.get(identifier) || []

    if(!success){
        attempts.push(now)
        this.authAttempts.set(identifier, attempts)
    } else {
        //clears attempts
        this.authAttempts.delete(identifier)
    }//end else
  }//end record

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
    //generates a determinstic value
    return 'Client -' + this.constantTimeHash(navigator.userAgent)
  }//end get client ip

  clearRateLimiting(){
    this.authAttempts.clear()
  }//end clear rate

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
