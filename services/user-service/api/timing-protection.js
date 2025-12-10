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
    }//end catch
  }//end hash string

} //end class
