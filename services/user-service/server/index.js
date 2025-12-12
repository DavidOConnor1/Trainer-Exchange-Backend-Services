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
const port = process.env.PORT || 4000;
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
    });
} catch(error){

}//end catch