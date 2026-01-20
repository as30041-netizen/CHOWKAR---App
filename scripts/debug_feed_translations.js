
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/"/g, ''); // Simple cleanup
        }
    });
} catch (e) {
    console.log('Could not load .env file');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const userId = "e266fa3d-d854-4445-be8b-cd054a2fa859";

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. URL:', !!supabaseUrl, 'Key:', !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFeed() {
    console.log('Fetching Home Feed for', userId);

    const { data, error } = await supabase.rpc('get_home_feed', {
        p_user_id: userId,
        p_limit: 5,
        p_offset: 0
    });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} jobs.`);
    let foundTranslated = false;
    data.forEach((job) => {
        // console.log(`Job: ${job.title} (${job.id}) Translations: ${job.translations ? Object.keys(job.translations).join(',') : 'None'}`);

        if (job.translations && Object.keys(job.translations).length > 0) {
            console.log(`✅ [${job.id}] Has translations for: ${Object.keys(job.translations).join(', ')}`);
            console.log(JSON.stringify(job.translations, null, 2));
            foundTranslated = true;
        }
    });

    if (!foundTranslated) {
        console.log('❌ No jobs with translations found in the top 5.');
    }
}

checkFeed();
