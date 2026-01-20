-- ============================================================================
-- SQL SEED: 100 REALISTIC REGIONAL JOBS (PUNJAB & HIMACHAL)
-- Includes dual-language descriptions and diverse locations
-- ============================================================================

DO $$
DECLARE
    v_posters UUID[];
    v_poster_count INTEGER;
    v_poster_id UUID;
    v_poster_name TEXT;
    v_poster_phone TEXT;
    v_poster_photo TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Gather existing posters
    SELECT array_agg(id) INTO v_posters FROM profiles LIMIT 10;
    v_poster_count := array_length(v_posters, 1);

    IF v_poster_count IS NULL OR v_poster_count = 0 THEN
        RAISE NOTICE 'No profiles found to act as posters. Aborting seed.';
        RETURN;
    END IF;

    -- 2. Seed Jobs (PUNJAB - Agriculture & Rural)
    FOR i IN 1..50 LOOP
        v_poster_id := v_posters[1 + (i % v_poster_count)];
        
        -- Fetch poster details
        SELECT name, phone, profile_photo 
        INTO v_poster_name, v_poster_phone, v_poster_photo
        FROM profiles 
        WHERE id = v_poster_id;

        INSERT INTO jobs (
            poster_id, poster_name, poster_phone, poster_photo,
            title, description, category, location, 
            latitude, longitude, job_date, duration, 
            budget, status, created_at
        )
        VALUES (
            v_poster_id, 
            COALESCE(v_poster_name, 'Chowkar Poster'), 
            COALESCE(v_poster_phone, '+910000000000'), 
            v_poster_photo,
            CASE (i % 5)
                WHEN 0 THEN 'Need 5 Wheat Harvesters | 5 गेहूं काटने वालों की जरूरत'
                WHEN 1 THEN 'Tractor Driver for Paddy Tilling | धान की जुताई के लिए ट्रैक्टर ड्राइवर'
                WHEN 2 THEN 'Dairy Farm Assistant | डेरी फार्म सहायक'
                WHEN 3 THEN 'Tube-well Motor Repair | ट्यूबवेल मोटर मरम्मत'
                WHEN 4 THEN 'Cattle Feed Management | पशु चारा प्रबंधन'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Needed for 10-acre harvesting near Nakodar. (हिंदी: नकोदर के पास 10 एकड़ कटाई के लिए चाहिए।)'
                WHEN 1 THEN 'Experience with Massey Ferguson required. (हिंदी: मैसी फर्ग्यूसन के साथ अनुभव होना चाहिए।)'
                WHEN 2 THEN ' milkin and cleaning at local farm. (हिंदी: डेरी की सफाई और दूध निकालने का काम।)'
                WHEN 3 THEN 'Motor burnt out; need rewiring. (हिंदी: मोटर जल गई है; रिवाइरिंग की जरूरत है।)'
                WHEN 4 THEN 'Help with daily fodder for 15 cows. (हिंदी: 15 गायों के चारे का प्रबंध करना।)'
            END,
            'Farm Labor',
            CASE (i % 8)
                WHEN 0 THEN 'Nakodar, Punjab'
                WHEN 1 THEN 'Raikot, Punjab'
                WHEN 2 THEN 'Mullanpur, Punjab'
                WHEN 3 THEN 'Phillaur, Punjab'
                WHEN 4 THEN 'Bathinda, Punjab'
                WHEN 5 THEN 'Machhiwara, Punjab'
                WHEN 6 THEN 'Ajnala, Punjab'
                WHEN 7 THEN 'Kurali, Punjab'
            END,
            31.125 + (random() * 0.1),
            75.478 + (random() * 0.1),
            v_now::DATE + (i % 5),
            '1-5 days',
            500 + (random() * 2000)::INTEGER,
            'OPEN',
            v_now - (i || ' hours')::INTERVAL
        );
    END LOOP;

    -- 3. Seed Jobs (PUNJAB - Industrial & Urban)
    FOR i IN 51..75 LOOP
        v_poster_id := v_posters[1 + (i % v_poster_count)];
        
        -- Fetch poster details
        SELECT name, phone, profile_photo 
        INTO v_poster_name, v_poster_phone, v_poster_photo
        FROM profiles 
        WHERE id = v_poster_id;

        INSERT INTO jobs (
            poster_id, poster_name, poster_phone, poster_photo,
            title, description, category, location, 
            latitude, longitude, job_date, duration, 
            budget, status, created_at
        )
        VALUES (
            v_poster_id, 
            COALESCE(v_poster_name, 'Chowkar Poster'), 
            COALESCE(v_poster_phone, '+910000000000'), 
            v_poster_photo,
            CASE (i % 5)
                WHEN 0 THEN 'Textile Loom Operator | कपड़े की फैक्ट्री में ऑपरेटर'
                WHEN 1 THEN 'Football Stitching Expert | फुटबॉल सिलाई विशेषज्ञ'
                WHEN 2 THEN 'Golden Temple Tour Guide | अमृतसर टूर गाइड'
                WHEN 3 THEN 'Phulkari Embroidery Artisans | फुलकारी कढ़ाई कलाकार'
                WHEN 4 THEN 'Delivery Partner (Cycles) | डिलीवरी पार्टनर'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Shift work in Focal Point Phase IV. (हिंदी: लुधियाना फोकल पॉइंट में शिफ्ट का काम।)'
                WHEN 1 THEN 'Skilled stitching for export goods. (हिंदी: एक्सपोर्ट क्वालिटी फुटबॉल की सिलाई के लिए।)'
                WHEN 2 THEN 'Fluent in Hindi/English for heritage tour. (हिंदी: हेरिटेज टूर के लिए हिंदी/अंग्रेजी बोलने वाला।)'
                WHEN 3 THEN 'Home-based work for detailed embroidery. (हिंदी: हाथ की कढ़ाई का काम, घर से कर सकते हैं।)'
                WHEN 4 THEN 'Bicycle delivery for local groceries. (हिंदी: पास के राशन की साइकिल से डिलीवरी।)'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Construction'
                WHEN 1 THEN 'Other'
                WHEN 2 THEN 'Other'
                WHEN 3 THEN 'Other'
                WHEN 4 THEN 'Delivery'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Ludhiana, Punjab'
                WHEN 1 THEN 'Jalandhar, Punjab'
                WHEN 2 THEN 'Amritsar, Punjab'
                WHEN 3 THEN 'Patiala, Punjab'
                WHEN 4 THEN 'Mohali, Punjab'
            END,
            30.901 + (random() * 0.5),
            75.857 + (random() * 0.5),
            v_now::DATE + (i % 3),
            'Full-time',
            800 + (random() * 1000)::INTEGER,
            'OPEN',
            v_now - (i || ' hours')::INTERVAL
        );
    END LOOP;

    -- 4. Seed Jobs (HIMACHAL - Horticulture & Tourism)
    FOR i IN 76..100 LOOP
        v_poster_id := v_posters[1 + (i % v_poster_count)];
        
        -- Fetch poster details
        SELECT name, phone, profile_photo 
        INTO v_poster_name, v_poster_phone, v_poster_photo
        FROM profiles 
        WHERE id = v_poster_id;

        INSERT INTO jobs (
            poster_id, poster_name, poster_phone, poster_photo,
            title, description, category, location, 
            latitude, longitude, job_date, duration, 
            budget, status, created_at
        )
        VALUES (
            v_poster_id, 
            COALESCE(v_poster_name, 'Chowkar Poster'), 
            COALESCE(v_poster_phone, '+910000000000'), 
            v_poster_photo,
            CASE (i % 5)
                WHEN 0 THEN 'Apple Grading & Packing | सेब की पेकिंग और छंटाई'
                WHEN 1 THEN 'Mountain Trekking Guide | पहाड़ों का ट्रैकिंग गाइड'
                WHEN 2 THEN 'Homestay Housekeeping | होमस्टे की सफाई और रख-रखाव'
                WHEN 3 THEN 'Orchard Spraying Help | सेब के बागानों में छिड़काव'
                WHEN 4 THEN 'Fish Farm Assistant | मछली फार्म सहायक'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Work in Kotkhai orchards. (हिंदी: कोटखाई के बगीचों में सेब पेकिंग का काम।)'
                WHEN 1 THEN 'Guide for Beas Kund trek. (हिंदी: ब्यास कुंड ट्रेक के लिए गाइड चाहिए।)'
                WHEN 2 THEN 'Looking for help with rooms in Kasol. (हिंदी: कसोल में कमरों की सफाई के लिए मदद की जरूरत।)'
                WHEN 3 THEN 'Steep hillside spraying work. (हिंदी: ढलान वाले बागानों में कीटनाशक छिड़काव।)'
                WHEN 4 THEN 'Daily feed management for trout. (हिंदी: ट्राउट मछली के चारे का दैनिक प्रबंधन।)'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Farm Labor'
                WHEN 1 THEN 'Other'
                WHEN 2 THEN 'Cleaning'
                WHEN 3 THEN 'Farm Labor'
                WHEN 4 THEN 'Farm Labor'
            END,
            CASE (i % 5)
                WHEN 0 THEN 'Kotkhai, Himachal'
                WHEN 1 THEN 'Manali, Himachal'
                WHEN 2 THEN 'Kasol, Himachal'
                WHEN 3 THEN 'Narkanda, Himachal'
                WHEN 4 THEN 'Barot, Himachal'
            END,
            31.104 + (random() * 1.5),
            77.173 + (random() * 1.5),
            v_now::DATE + (i % 7),
            '1-10 days',
            600 + (random() * 2000)::INTEGER,
            'OPEN',
            v_now - (i || ' hours')::INTERVAL
        );
    END LOOP;

    RAISE NOTICE 'Successfully seeded 100 regional jobs across Punjab and Himachal Pradesh.';
END $$;
