export const validateEnvironment = () => {
    const required = ['PORT'];
    const optional = ['CORS_ORIGIN', 'NODE_ENV', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX'];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
    
    console.log('✅ Environment variables validated');
    
    // Warn about development mode in production
    if (process.env.NODE_ENV === 'production') {
        console.log('🔒 Running in production mode');
    } else {
        console.log('⚠️  Running in development mode');
    }
};