import TimingProtectionUtility from "./timing-protection";

class SecureAuthService {
    constructor(supabaseClient){
        if(!supabaseClient){
            throw new Error('supabase client is required');
        }//end if
        this.supabase = supabaseClient;
        this.timingProtection = new TimingProtectionUtility();

        //bind methods
        this.signIn = this.signIn.bind(this);
        this.signUp = this.signUp.bind(this);
        this.signOut = this.signOut.bind(this);
    }//end constructor

      //timing-attack protected signIn
  async signIn(email, password) {
    const MIN_EXECUTION_TIME = 800;
    
    const signInOperation = async () => {
      // Basic validation
      if (!email || !password) {
        await TimingProtectionUtility.constantTimeDelay(100);
        throw new Error('Invalid credentials');
      } //end if

      // Check rate limiting
      const emailHash = await TimingProtectionUtility.hashString(email);
      const rateLimited = await this.timingProtection.checkRateLimit(emailHash);
      
      if (rateLimited) {
        throw new Error('Too many attempts. Please try again later.');
      }//end if

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Attempt sign in
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });

      // Record attempt
      this.timingProtection.recordAttempt(emailHash, !error);

      if (error) {
        // Generic error
        throw new Error('Invalid email or password');
      }//end if

      return { data, error: null };
    }; //end sign in operation

    try {
      return await TimingProtectionUtility.withMinimumTime(
        signInOperation,
        MIN_EXECUTION_TIME
      );
    } catch (error) {
      // Return consistent error structure
      return {
        data: null,
        error: { message: 'Invalid email or password' }
      }; //end return
    }//end catch
  }//end sign in protection

   async signUp(email, password, username, displayName) {
    const MIN_EXECUTION_TIME = 1000;

    const signUpOperation = async () => {
      // Basic validation
      if (!email || !password || !username) {
        await TimingProtectionUtility.constantTimeDelay(100);
        throw new Error('All fields are required');
      }//end if

      // Rate limiting by client identifier
      const clientId = await TimingProtectionUtility.getClientIdentifier();
      const rateLimited = await this.timingProtection.checkRateLimit(`signup-${clientId}`);
      
      if (rateLimited) {
        throw new Error('Too many registration attempts. Please try again later.');
      } //end if

      // Validate email
      if (!TimingProtectionUtility.isValidEmailConstantTime(email)) {
        throw new Error('Invalid email format');
      } //end if

      // Validate password
      const passwordCheck = TimingProtectionUtility.checkPasswordStrengthConstantTime(password);
      if (!passwordCheck.valid) {
        throw new Error(passwordCheck.message);
      }//end if

      // Normalize inputs
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedUsername = username.toLowerCase().trim();

      // Attempt registration
      const { data, error } = await this.supabase.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            username: normalizedUsername,
            display_name: displayName?.trim() || normalizedUsername
          }
        }
      });

      // Record attempt
      this.timingProtection.recordAttempt(`signup-${clientId}`, !error);

      if (error) {
        // Generic error 
        throw new Error('Registration failed. Please try again.');
      } //end if

      return { data, error: null };
    }; //end signup operation

    try {
      return await TimingProtectionUtility.withMinimumTime(
        signUpOperation,
        MIN_EXECUTION_TIME
      );
    } catch (error) {
      return {
        data: null,
        error: { message: 'Registration failed. Please try again.' }
      }; //end return
    } //end catch
  }//end protected signup

  

}//end service auth service