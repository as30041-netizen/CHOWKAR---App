
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = '81a44fed-41f1-42b8-a246-c721d3844e1b';

async function checkUser() {
    console.log(`Checking user: ${userId}`);

    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('subscription_plan, is_premium, subscription_expiry')
        .eq('id', userId)
        .single();

    if (pError) console.error('Profile Error:', pError);
    else console.log('Current Profile:', profile);

    const { data: history, error: hError } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (hError) console.error('History Error:', hError);
    else console.log('Subscription History:', history);
}

checkUser();
