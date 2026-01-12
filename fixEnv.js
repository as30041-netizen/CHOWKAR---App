
import fs from 'fs';

let content = fs.readFileSync('.env', 'utf8');

// 1. Remove all existing newlines and extra spaces to normalize
content = content.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

// 2. Insert newlines before known keys and comments
const keys = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GEMINI_API_KEY',
    'VITE_RAZORPAY_KEY_ID',
    '# Supabase',
    '# Gemini',
    '# Razorpay'
];

let finalContent = content;
keys.forEach(key => {
    const regex = new RegExp(`\\s*${key}`, 'g');
    finalContent = finalContent.replace(regex, `\n${key}`);
});

// Clean up double newlines
finalContent = finalContent.trim();

fs.writeFileSync('.env', finalContent, 'utf8');
console.log('Cleaned .env file structure');
