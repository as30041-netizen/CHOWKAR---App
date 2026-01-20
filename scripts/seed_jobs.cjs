const { createClient } = require('@supabase/supabase-js');

// Hardcoded for the one-time seed as per log values
const supabaseUrl = "https://ghtshhafukyirwkfdype.supabase.co";
const supabaseKey = "sb_publishable_TES0Vyz0LIYnQ04wHGBzQQ_3GaCei6Z";

const supabase = createClient(supabaseUrl, supabaseKey);

const PUNJAB_LOCS = [
    { name: "Nakodar, Punjab", lat: 31.1265, lng: 75.4719 },
    { name: "Raikot, Punjab", lat: 30.6541, lng: 75.6124 },
    { name: "Mullanpur, Punjab", lat: 30.9328, lng: 75.7176 }
];

const HIMACHAL_LOCS = [
    { name: "Kotkhai, Himachal", lat: 31.1217, lng: 77.5317 },
    { name: "Manali, Himachal", lat: 32.2432, lng: 77.1892 },
    { name: "Kasol, Himachal", lat: 32.0099, lng: 77.3111 }
];

async function runSeed() {
    console.log("🚀 Starting CJS Seed...");

    const { data: profiles } = await supabase.from('profiles').select('id').limit(10);
    if (!profiles || profiles.length === 0) {
        console.error("No profiles found");
        return;
    }
    const posterIds = profiles.map(p => p.id);

    const jobs = [];
    const now = new Date();

    for (let i = 0; i < 100; i++) {
        const isHimachal = i >= 75;
        const locPool = isHimachal ? HIMACHAL_LOCS : PUNJAB_LOCS;
        const loc = locPool[i % locPool.length];
        const posterId = posterIds[i % posterIds.length];

        let title, desc, cat, budget;
        budget = 500 + Math.floor(Math.random() * 2000);

        if (i < 50) {
            cat = "Farm Labor";
            const v = i % 3;
            if (v === 0) { title = "Grain Mandi Helper | अनाज मंडी सहायक"; desc = "Lifting bags. बोरियों की लोडिंग।"; }
            else if (v === 1) { title = "Tractor Mechanic | ट्रैक्टर मैकेनिक"; desc = "Engine repair. इंजन की मरम्मत।"; }
            else { title = "Wheat Harvester | गेहूं काटने वाला"; desc = "2 days work. 2 दिन का काम।"; }
        } else if (i < 75) {
            cat = "Other";
            const v = i % 3;
            if (v === 0) { title = "Factory Labor | फैक्ट्री लेबर"; desc = "Focal point work. फोकल पॉइंट में काम।"; cat = "Construction"; }
            else if (v === 1) { title = "Sports Goods Helper | स्पोर्ट्स सामान सहायक"; desc = "Packing bats. बैट की पैकिंग।"; }
            else { title = "Local Delivery | लोकल डिलीवरी"; desc = "Grocery delivery. राशन डिलीवरी।"; cat = "Delivery"; }
        } else {
            cat = "Farm Labor";
            const v = i % 3;
            if (v === 0) { title = "Apple Harvester | सेब तोड़ने वाला"; desc = "Shimla orchards. शिमला के बागान।"; }
            else if (v === 1) { title = "Hotel Cleaner | होटल की सफाई"; desc = "Manali resort sweep. मनाली रिजॉर्ट।"; cat = "Cleaning"; }
            else { title = "Mule Driver | खच्चर चलाने वाला"; desc = "Mountain transport. पहाड़ों में सामान।"; cat = "Other"; }
        }

        jobs.push({
            poster_id: posterId,
            title,
            description: desc,
            category: cat,
            location: loc.name,
            latitude: loc.lat + (Math.random() - 0.5) * 0.01,
            longitude: loc.lng + (Math.random() - 0.5) * 0.01,
            job_date: new Date(now.getTime() + (i % 7) * 86400000).toISOString().split('T')[0],
            duration: i % 3 === 0 ? "Short Term" : "1 Week",
            budget,
            status: "OPEN",
            created_at: new Date(now.getTime() - i * 3600000).toISOString()
        });
    }

    const { error } = await supabase.from('jobs').insert(jobs);
    if (error) {
        console.error("Seed failed:", error);
    } else {
        console.log("✅ Seed complete! 100 jobs added.");
    }
}

runSeed();
