const fs = require('fs');
const path = 'c:\\Users\\Welcome\\.gemini\\antigravity\\scratch\\services\\jobService.ts';
const content = fs.readFileSync(path, 'utf8');
const exists = content.includes('saveJobTranslation');
console.log('Exists:', exists);
if (exists) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('saveJobTranslation')) {
            console.log(`Line ${i + 1}: ${line}`);
        }
    });
}
