import { webcrypto } from "crypto";
const crypto = webcrypto;

class TimingProtectionUtility {
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
