import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PUNJAB_LOCATIONS = [
    { name: 'Nakodar, Punjab', lat: 31.1265, lng: 75.4719 },
    { name: 'Raikot, Punjab', lat: 30.6541, lng: 75.6124 },
    { name: 'Mullanpur, Punjab', lat: 30.9328, lng: 75.7176 },
    { name: 'Phillaur, Punjab', lat: 31.0264, lng: 75.7836 },
    { name: 'Bathinda, Punjab', lat: 30.2110, lng: 74.9455 },
    { name: 'Machhiwara, Punjab', lat: 30.9168, lng: 76.1983 },
    { name: 'Ajnala, Punjab', lat: 31.8415, lng: 74.7610 },
    { name: 'Kurali, Punjab', lat: 30.8242, lng: 76.5744 }
];

const HIMACHAL_LOCATIONS = [
    { name: 'Kotkhai, Himachal', lat: 31.1217, lng: 77.5317 },
    { name: 'Manali, Himachal', lat: 32.2432, lng: 77.1892 },
    { name: 'Kasol, Himachal', lat: 32.0099, lng: 77.3111 },
    { name: 'Narkanda, Himachal', lat: 31.2581, lng: 77.4522 },
    { name: 'Barot, Himachal', lat: 32.0336, lng: 76.8456 },
    { name: 'Theog, Himachal', lat: 31.1214, lng: 77.3551 },
    { name: 'Sangla, Himachal', lat: 31.4277, lng: 78.2662 }
];

async function seed() {
    console.log('🚀 Starting Seeding of 100 Regional Jobs...');

    // 1. Get some poster IDs
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id').limit(10);
    if (pError || !profiles || profiles.length === 0) {
        console.error('Could not find profiles to act as posters', pError);
        return;
    }
    const posterIds = profiles.map(p => p.id);

    const jobs = [];
    const now = new Date();

    for (let i = 0; i < 100; i++) {
        const isHimachal = i >= 75;
        const locPool = isHimachal ? HIMACHAL_LOCATIONS : (i < 50 ? PUNJAB_LOCATIONS : PUNJAB_LOCATIONS.slice(0, 3));
        const loc = locPool[i % locPool.length];
        const posterId = posterIds[i % posterIds.length];

        let title, description, category, budget;

        if (i < 50) {
            // Punjab Agriculture
            category = 'Farm Labor';
            const variants = [
                { t: 'Need 5 Wheat Harvesters | 5 गेहूं काटने वालों की जरूरत', d: 'Needed for 10-acre harvesting. नकोदर के पास 10 एकड़ कटाई के लिए चाहिए।' },
                { t: 'Tractor Driver for Paddy Tilling | धान की जुताई के लिए ट्रैक्टर ड्राइवर', d: 'Experience with Massey Ferguson required. मैसी फर्ग्यूसन के साथ अनुभव होना चाहिए।' },
                { t: 'Dairy Farm Assistant | डेरी फार्म सहायक', d: 'Milking and cleaning at local farm. डेरी की सफाई और दूध निकालने का काम।' },
                { t: 'Tube-well Motor Repair | ट्यूबवेल मोटर मरम्मत', d: 'Motor burnt out; need rewiring. मोटर जल गई है; रिवाइरिंग की जरूरत है।' },
                { t: 'Cattle Feed Management | पशु चारा प्रबंधन', d: 'Help with daily fodder for 15 cows. 15 गायों के चारे का प्रबंध करना।' }
            ];
            const v = variants[i % variants.length];
            title = v.t;
            description = v.d;
            budget = 500 + Math.floor(Math.random() * 2000);
        } else if (i < 75) {
            // Punjab Urban/Industrial
            const variants = [
                { t: 'Textile Loom Operator | कपड़े की फैक्ट्री में ऑपरेटर', d: 'Shift work in Focal Point Phase IV. लुधियाना फोकल पॉइंट में शिफ्ट का काम।', c: 'Construction' },
                { t: 'Football Stitching Expert | फुटबॉल सिलाई विशेषज्ञ', d: 'Skilled stitching for export goods. एक्सपोर्ट क्वालिटी फुटबॉल की सिलाई के लिए।', c: 'Other' },
                { t: 'Golden Temple Tour Guide | अमृतसर टूर गाइड', d: 'Fluent in Hindi/English for heritage tour. हेरिटेज टूर के लिए हिंदी/अंग्रेजी बोलने वाला।', c: 'Other' },
                { t: 'Phulkari Embroidery Artisans | फुलकारी कढ़ाई कलाकार', d: 'Home-based work for detailed embroidery. हाथ की कढ़ाई का काम, घर से कर सकते हैं।', c: 'Other' },
                { t: 'Delivery Partner (Cycles) | डिलीवरी पार्टनर', d: 'Bicycle delivery for local groceries. पास के राशन की साइकिल से डिलीवरी।', c: 'Delivery' }
            ];
            const v = variants[i % variants.length];
            title = v.t;
            description = v.d;
            category = v.c;
            budget = 800 + Math.floor(Math.random() * 1000);
        } else {
            // Himachal Horticulture/Tourism
            const variants = [
                { t: 'Apple Grading & Packing | सेब की पेकिंग और छंटाई', d: 'Work in Kotkhai orchards. कोटखाई के बगीचों में सेब पेकिंग का काम।', c: 'Farm Labor' },
                { t: 'Mountain Trekking Guide | पहाड़ों का ट्रैकिंग गाइड', d: 'Guide for Beas Kund trek. ब्यास कुंड ट्रेक के लिए गाइड चाहिए।', c: 'Other' },
                { t: 'Homestay Housekeeping | होमस्टे की सफाई और रख-रखाव', d: 'Looking for help with rooms in Kasol. कसोल में कमरों की सफाई के लिए मदद की जरूरत।', c: 'Cleaning' },
                { t: 'Orchard Spraying Help | सेब के बागानों में छिड़काव', d: 'Steep hillside spraying work. ढलान वाले बागानों में कीटनाशक छिड़काव।', c: 'Farm Labor' },
                { t: 'Fish Farm Assistant | मछली फार्म सहायक', d: 'Daily feed management for trout. ट्राउट मछली के चारे का दैनिक प्रबंधन।', c: 'Farm Labor' }
            ];
            const v = variants[i % variants.length];
            title = v.t;
            description = v.d;
            category = v.c;
            budget = 600 + Math.floor(Math.random() * 2000);
        }

        jobs.push({
            poster_id: posterId,
            title,
            description,
            category,
            location: loc.name,
            latitude: loc.lat + (Math.random() - 0.5) * 0.01,
            longitude: loc.lng + (Math.random() - 0.5) * 0.01,
            job_date: new Date(now.getTime() + (i % 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration: i % 3 === 0 ? 'Short Term' : '1 Week',
            budget,
            status: 'OPEN',
            created_at: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString()
        });
    }

    // 100 rows is fine for a single insert
    const { error: iError } = await supabase.from('jobs').insert(jobs);
    if (iError) {
        console.error('Error inserting jobs', iError);
    } else {
        console.log('✅ Successfully seeded 100 regional jobs!');
    }
}

seed();
