import jwt from 'jsonwebtoken';


// Use a fixed secret for testing
const SECRET = 'it-is-a-secret';

console.log('Using secret:', SECRET);
console.log('Save this in your .env file as:');
console.log(`JWT_API_KEY_SECRET=${SECRET}\n`);

const token = jwt.sign(
    { 
        type: 'admin',
        name: 'Admin API Key',
        scope: ['admin', 'monitoring', 'read', 'write'],
        iss: 'pokemon-tcg-backend',
        iat: Math.floor(Date.now() / 1000)
    },
    SECRET,
    { expiresIn: '365d' }
);

console.log('Your API Key:');
console.log(token);
console.log('\nTest with:');
console.log(`curl -H "x-api-key: ${token}" http://localhost:5000/api/admin/status`);