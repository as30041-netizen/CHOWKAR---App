
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const envPath = path.join(__dirname, '../.env');
console.log(`Loading env from: ${envPath}`);

let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error('Could not read .env file:', e);
    process.exit(1);
}

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)`, 'm'));
    return match ? match[1].trim() : null;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const BUCKET_NAME = 'downloads';
// NOTE: We built 'debug' APK.
const FILE_PATH = path.join(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');
const DESTINATION_PATH = 'chowkar-new-keys.apk';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadApk() {
    console.log(`Reading APK from: ${FILE_PATH}`);
    if (!fs.existsSync(FILE_PATH)) {
        console.error('APK file not found at path!');
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(FILE_PATH);

    console.log(`Uploading to bucket '${BUCKET_NAME}' as '${DESTINATION_PATH}'...`);

    // 1. Try to upload (upsert: true)
    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(DESTINATION_PATH, fileBuffer, {
            contentType: 'application/vnd.android.package-archive',
            upsert: true
        });

    if (error) {
        console.error('Upload failed:', error);
        process.exit(1);
    }

    console.log('✅ Upload successful!');
    console.log('Path:', data.path);

    // 2. Get Public URL
    const { data: urlData } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(DESTINATION_PATH);

    console.log('Public URL:', urlData.publicUrl);
}

uploadApk();
