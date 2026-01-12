
import fs from 'fs';
const content = fs.readFileSync('.env', 'utf8');
const cleanContent = content.replace(/^\uFEFF/, '');
fs.writeFileSync('.env', cleanContent, 'utf8');
console.log('Stripped BOM from .env');
