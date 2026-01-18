
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env manually since we are running a standalone script
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listBuckets() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error);
    } else {
        console.log('Buckets:', data.map(b => b.name));
        // Check 'downloads' bucket content if it exists
        if (data.find(b => b.name === 'downloads')) {
            const { data: files, error: fileError } = await supabase.storage.from('downloads').list();
            if (fileError) console.error('Error listing downloads:', fileError);
            else console.log('Files in downloads:', files.map(f => f.name));
        }
    }
}

listBuckets();
