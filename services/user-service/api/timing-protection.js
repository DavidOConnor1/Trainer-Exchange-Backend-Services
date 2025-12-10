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

      let result = 0;
      for (let i = 0; i < maxLength; i++) {
        result |= aPadded[i] ^ bPadded[i];
      } //end for
      return result === 0;
    } catch (err) {} //end catch
  } //end constantTime
} //end class
