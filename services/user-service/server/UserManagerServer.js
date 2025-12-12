import express from "express";
import helmet from "helmet";
import cors from 'cors';
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';

//import methods from service classes
import { TimingProtectionUtility } from "../api/timing-protection.js";
import { supabaseService } from "../api/APIClient.js";
import { resolve } from "path";


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
        const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
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
            req.id = crypto.randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });
    }//end security middle ware

    //middle ware to validate JWT
    async validateAuth(req, res, next){
         const authHeader = req.headers.authorization;

         if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({error: 'Authentication required'});
         }//end if 

         const token = authHeader.split(' ')[1];

         try{
            //verifies with existing auth service
            const {data: { user }, error} = await this.supabaseAdmin.auth.getUser(token);

            if(error || !user){
                this.logger.warn(`Invalid token from IP: ${req.ip}`);
                return res.status(401).json({error: 'invalid token'});
            }//end if 

            req.user = user;
            next();
         } catch(error) {
            this.logger.error(`Token Validation Error: ${error.message}`);
            res.status(401).json({error: 'Authentication Failed'});
         }//end catch
    }//validate auth

    setupRoutes(){

        //public endpoints
        this.app.get('/api/public/collections', async (req, res) => {
            try{
                const {data, error} = await supabaseService.getPublicCollections();

                if(error) throw error;
                res.json(data);
            } catch(error) {
                this.logger.error(`Public Collections error: ${error.message}`);
                res.status(500).json({error: 'Failed to fetch collections'});
            }//end catch
        }); //end public collections

        //protected endpoints
        const protectedRouter = express.Router();
        protectedRouter.use(this.validateAuth.bind(this));

        //user collections
        protectedRouter.get('/collections', async(req, res) => {
            try{
                const {data, error} = await supabaseService.getUserCollections(req.user.id);

                if(error) throw error;
                res.json(data);
            } catch(error) {
                this.logger.error(`User Collections Error: ${error.message}`);
                res.status(500).json({error: 'Failed to fetch user collections'})
            }//end catch
        });

        protectedRouter.post('/collections', async (req, res) => {
            try{
                const {name, description, is_public} = req.body;

                const {data, error} = await supabaseService.createCollection(
                    name,
                    description,
                    is_public
                );
                if(error) throw error;

                this.logger.info(`Collection Created: ${data.id} by user ${req.user.id}`);
                res.status(201).json(data);
            } catch (error){
                this.logger.error(`Create Collection failed: ${error.message}`);
                res.status(400).json({ error: 'Failed to create collection'});
            }//end catch
        });

        //cards in collection
        protectedRouter.get('/collections/:collectionId/cards', async (req, res) => {
            try{
                //verify is user owns collection
                const {data: collection} = await this.supabaseAdmin
                .from('collections')
                .select('id')
                .eq('id', req.params.collectionId)
                .eq('user_id', req.user.id)
                .single();

                if(!collection){
                    return res.status(404).json({error: 'Collection not found'});
                }//end if

                const {data, error} = await supabaseService.getCollectionCards(req.params.collectionId);

                if(error) throw error;
                res.json(data);
            } catch(error) {
                this.logger.error(`Get collection cards error: ${error.message}`);
                res.status(500).json({error: 'failed to fetch cards'});
            }//end catch
        });

        //adding cards to collection
        protectedRouter.post('/collections/:collectionId/cards', async(req,res) => {
            try{
                const {card_id, quantity, condition, notes} = req.body;

                //verify ownership
                const {data: collection} = await this.supabaseAdmin
                .from('collections')
                .select('id')
                .eq('id', req.params.collectionId)
                .eq('user_id', req.user.id)
                .single();

                if(!collection){
                    return res.status(404).json({error: 'collection not found'});
                }//end if 

                //timing protection implementation
                const timingProtect = new TimingProtectionUtility();
                const cardData = {card_id, quantity, condition, notes};

                const {data,error} = await timingProtect.withMinimumTime(
                    async() => {
                        return await supabaseService.addCardToCollection(
                            req.params.collectionId,
                            cardData
                        );
                    },
                    300 //minimum 300ms
                );

                if (error) throw error;

                this.logger.info(`Card added to collection ${req.params.collectionId}`);
                res.status(201).json(data);

            } catch(error) {
                this.logger.error(`Add card error: ${error.message}`);
                res.status(400).json({error: 'failed to add card'})
            }//end catch
        });

        //mount protected routes
        this.app.use('/api', protectedRouter);

        //404 handler
        this.app.use('*', (req,res) => {
            res.status(404).json({error: 'endpoint not found'});
        });
    }//end routes

    setupErrorHandling(){
        //global error handling
        this.app.use((error, req, res, next) => {
            this.logger.error(`Unhandled Error: ${error.message}`, {
                reqId: req.id,
                url: req.url,
                method: req.method,
                stack: error.stack
            });

            //avoids exposing internal errors
            const status = error.status || 500;
            const message = status === 500 ? 'Internal Server Error' : error.message;

            res.status(status).json({
                error:message,
                requestId: req.id
            });
        });
    }//end error handling

    //start server code
    start(port = process.env.PORT || 4000){
        return new Promise((resolve) => {
            const server = this.app.listen(port, () => {
                this.logger.info(`Server running on Port: ${port}`);
                resolve(server);
            });
        }); 
    }//end start
}//end user manager server

// Main execution block
if(import.meta.url === `file://${process.argv[1]}`){
    const server = new UserManagerServer();

    server.start().catch((error) => {
        console.error('failed to start server:', error);
        process.exit(1);
    });
}//end main execution block

export default UserManagerServer;