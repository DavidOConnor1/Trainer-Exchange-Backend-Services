import express from "express";
import helmet from "helmet";
import cors from 'cors';
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';

//import methods from service classes
import TimingProtectionUtility from '../api/timing-protection.js';
import {supabaseService} from '../api/APIClient.js'
import { callbackify } from "util";

class UserManagerServer {
    constructor(){
        this.app = express();
        this.logger = this.setupLogger();
        this.supabaseAdmin = this.initSupabaseAdmin();

        this.setupSecurityMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }//end constructor

    setupLogger(){
        return {
            info: (message, meta = {}) => console.log(`[INFO] ${message}`, meta),
            warn: (message, meta = {}) => console.log(`[WARN] ${message}`, meta),
            error: (message, meta = {}) => console.log(`[Error] ${message}`, meta),
        };
    }//end logger

    initSupabaseAdmin(){
        //service role for admins, will come back and use this code later in dev
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if(!supabaseUrl || !serviceRoleKey){
            this.logger.error('Missing Supabase Admin Credentials');
            throw new Error('Server Configuration Error');
        }//end if

        return createClient(supabaseUrl, serviceRoleKey, {
            auth: {autoRefreshToken: false, persistSession: false}
        });
    }//end supaBaseAdmin

    setupSecurityMiddleware(){
        //helmet for minimal config
        this.app.use(helmet ({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", process.env.SUPABASE_URL]
                }
            }
        })); //end helment config

        //CORS config
        const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',') || [];
        this.app.use(cors({
            origin: (origin, callback) => {
                if(!origin || allowedOrigins.includes(origin)){
                    callback(null, true);
                } else {
                    this.logger.warn(`Blocked CORS request from: ${origin}`);
                    callback(new Error('not allowed by CORS'));
                }//end else 
            },
            credentials: true
        })); //end cors config

        //rate limit setup
        const limiter = rateLimit({
            windowMs: 15*60*1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests'
        }); //end limit setup

        this.app.use(limiter);

        //body parse with limits
        this.app.use(express.json({ limit: '10kb'}));
        this.app.use(express.urlencoded({extended: true, limit: '10kb'}));

        //request for id tracing
        this.app.use((req, res, next) => {
            req.id - crypto.randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });
    }//end security middle ware

    //middle ware to validate JWT
    async validateAuth(req, res, next){
         const authHeader = req.header.authorization;

         if(!authHeader || !authHeader.startsWith('Bearer: ')){
            return res.status(401).json({error: 'Authentication required'});
         }//end if 

         const token = authHeader.split(' ')[1];

         try{
            //verifies with existing auth service
            const {data: { user }, error} = await this.supabaseAdmin.auth.getUser(token);

            if(error || !user){
                this.logger.warn(`Invalid token from IP: ${req.ip}`);
                return req.status(401).json({error: 'invalid token'});
            }//end if 

            req.user = user;
            next();
         } catch(error) {
            this.logger.error(`Token Validation Error: ${error.message}`);
            res.status(401).json({error: 'Authentication Failed'});
         }//end catch
    }//validate auth

    
}//end user manager server