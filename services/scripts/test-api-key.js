import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWRtaW4iLCJuYW1lIjoiQWRtaW4gQVBJIEtleSIsInNjb3BlIjpbImFkbWluIiwibW9uaXRvcmluZyIsInJlYWQiLCJ3cml0ZSJdLCJpc3MiOiJwb2tlbW9uLXRjZy1iYWNrZW5kIiwiaWF0IjoxNzc2ODU2MjkyLCJleHAiOjE4MDgzOTIyOTJ9.3l_X51bptF759aHeG-z-CYgNMyG4Q9hXMYDMVoBM_Kw';
const secret = process.env.JWT_API_KEY_SECRET;

console.log('Testing JWT verification...');
console.log('Secret exists:', !!secret);
console.log('Secret length:', secret?.length);

try {
    const decoded = jwt.verify(token, secret);
    console.log('✅ SUCCESS! Token is valid');
    console.log('Decoded:', decoded);
} catch (error) {
    console.log('❌ FAILED:', error.message);
}