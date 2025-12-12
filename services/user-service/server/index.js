import dotenv from 'dotenv';
import UserManagerServer from './UserManagerServer';
import { circuitManager } from '../utils/circuit-breaker';

//load enviroment variables
dotenv.config();

//validates requirement variables
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if(missingVars.length > 0){
    console.error('Missing required enviorment variables:');
    missingVars.forEach(varName => {
        console.error(` -${varName}`);
    });
    console.error(`\n Check your .env or set these variables`);
    process.exit(1);
}//end if

//env var with defaults
const port = process.env.POORT || 4000;
const nodeEnv = process.env.NODE_ENV || 'development';

//Log message 
console.log(`
    Starting User Service
    Enviornment: ${nodeEnv}
    Port: ${port}
    Date: ${new Date().toISOString()}
        `);

//create and start new server
try{
    const server = new UserManagerServer();

    server.start(port).then((httpServer) => {
        console.log('Server Successfully Ran');

        //circuit breaker for status endpoints
        server.app.get('/api/health/circuit-breakers', (req,res) => {
            res.json({
                circuitBreakers: circuitManager.getStatus(),
                timestamp: new Date().toISOString()
            });
        });

        //reset circuit breaker only as admin
        server.app.post('/api/admin/reset-circuit-breakers', (req, res) => {
            //will add authentication later 
            circuitManager.resetAll();
            res.json({
                message: 'Circuit breakers reset',
                timestamp: new Date().toISOString()
            });
        });

        //display all the available routes 
        console.log('Available Routes');
        console.log('Get /health');
        console.log('GET /api/health/circuit-breaker (status)');
        console.log('POST /api/admin/reset-circuit-breakers');
        console.log('GET /api/public/collections (PUBLIC)');
        console.log('PROTECTED ROUTES');
        console.log('GET /api/collections');
        console.log('POST /api/collections');
        console.log('GET /api/collections/:id/cards');
        console.log('POST /api/collections/:id/cards');

        //logs circuit breaker
        if(nodeEnv === 'development'){
            setInterval(() => {
                const status = circuitManager.getStatus();
                const openBreakers = Object.values(status).filter(b => b.state === 'OPEN');
                if(openBreakers.length > 0){
                    console.warn('Open Circuit Breakers: ',openBreakers);
                }//end if 
            }, 30000);
        }//end if 

        const gracefulShutdown = () => {
            console.log('Beginning to shutdown, closing server...');

            httpServer.close(() => {
                console.log('Server closed gracefully');

                //logs final circuit breaker status 
                console.log('Final Circuit breaker status: ');
                console.log(JSON.stringify(circuitManager.getStatus(), null, 2));

                process.exit(0);
            });

            //force shutdown if graceful was not successful
            setTimeout(() => {
                console.error('Could not close connections in time, force shutdown');
                process.exit(1);
            }, 10000);

            //handle various shutdown signals
            process.on('SIGTERM', gracefulShutdown);
            process.on('SIGINT', gracefulShutdown);
            process.on('SIGUSR2', gracefulShutdown);
        }//end graceful shut down
    }).catch((error) => {
        console.error('Failed to start server: ',error);
        process.exit(1);
    });
} catch(error){
    console.error('Failure to intialize server: ',error);
    process.exit(1);
}//end catch