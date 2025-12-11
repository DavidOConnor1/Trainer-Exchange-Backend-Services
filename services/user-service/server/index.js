import express from "express";
import helmet from "helmet";
import cors from 'cors';
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';

//import methods from service classes
import TimingProtectionUtility from '../api/timing-protection.js';
import {supabaseService} from '../api/APIClient.js'

class UserManagerServer {
    constructor(){

    }//end constructor
}//end user manager server