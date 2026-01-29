import React, { useState, useEffect } from 'react';
import {
    Users, Briefcase, Calculator, Star, Shield,
    ArrowRight, Menu, X, CheckCircle, Smartphone,
    MapPin, Globe, ChevronDown, ChevronUp, PlayCircle, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from './SEO';
import { Footer } from './Footer';
import { SafetyTipsModal, CommunityGuidelinesModal, TermsModal } from './InfoModals';
import { useUser } from '../contexts/UserContextDB';
import { useAdminConfig } from '../contexts/AdminConfigContext';
import { CATEGORY_CONFIG } from '../constants';
import { VideoModal } from './VideoModal';

// --- Localized Content Dictionary ---
const LANDING_CONTENT = {
    en: {
        seoTitle: "Hire Local Workers & Find Jobs",
        navSearch: "Search nearby...",
        heroTitle: "Hire Local Workers",
        heroSubtitle: "Direct Call • No Commission",
        services: {
            driver: "Driver",
            labor: "Labor",
            maid: "Maid",
            farm: "Farm",
            electric: "Electric",
            plumber: "Plumber",
            painter: "Painter",
            more: "More"
        },
        actions: {
            postJob: "Post a Job",
            findWork: "Find Work"
        },
        employers: {
            title: "For Employers",
            desc: "Hire skilled workers directly without paying any commission.",
            list: ["Hassle-free Hiring", "Direct Calling", "Negotiate Your Price"],
            cta: "Post Job Now"
        },
        workers: {
            title: "For Workers",
            desc: "Find daily wage work near you and earn instantly.",
            list: ["Jobs Near You", "Keep 100% Earnings", "Build Your Reputation"],
            cta: "Create Profile"
        },
        trust: {
            privacy: "Privacy First",
            privacySub: "Your number is kept private",
            community: "Community Rated",
            communitySub: "See ratings before calling",
            direct: "Direct Connection",
            directSub: "No middleman fees"
        },
        testimonials: {
            title: "Success Stories",
            desc: "See how Chowkar is changing lives",
            stories: [
                {
                    name: "Rajesh Kumar", role: "Tractor Driver", loc: "Madhya Pradesh",
                    avatar: "/assets/testimonials/rajesh-kumar.jpg",
                    text: "Before Chowkar, I had to sit at the chowk waiting for work. Now I get calls directly on my phone. My monthly income has doubled!"
                },
                {
                    name: "Suresh Patel", role: "Farm Owner", loc: "Gujarat",
                    avatar: "/assets/testimonials/suresh-patel.jpg",
                    text: "During harvest season, finding 10 laborers was a headache. With this app, I posted a job and got 15 calls in 1 hour. Amazing!"
                },
                {
                    name: "Anita Devi", role: "Maid", loc: "Uttar Pradesh",
                    avatar: "/assets/testimonials/anita-devi.jpg",
                    text: "Safe and easy. I found 3 houses to work in near my area. The best part is I can trust the employers because they are verified."
                }
            ]
        },
        appSection: {
            title: "Chowkar on Your Phone",
            subtitle: "Install the app for instant job notifications and direct calling.",
            features: ["Direct Calling", "Instant Alerts", "Zero Fees"],
            cta: "Install Now"
        },
        videoGuides: {
            title: "How Chowkar Works",
            subtitle: "Watch these simple guides to get started immediately.",
            employer: {
                title: "Hire a Worker",
                desc: "Post a job and get bids in 60 seconds."
            },
            worker: {
                title: "Find a Job",
                desc: "Browse local work and call employers directly."
            }
        },
        howItWorks: {
            title: "How It Works",
            steps: ["Create Profile", "Post/Find Job", "Connect", "Get Paid"],
            video: "Watch Video"
        },
        faq: {
            title: "Frequently Asked Questions",
            items: [
                { q: "Is Chowkar completely free?", a: "Yes! Joining and creating a profile is 100% free. We do not charge commissions on your daily wages." },
                { q: "How do I pay the worker?", a: "You pay the worker directly (Cash/UPI) after the work is done. Chowkar does not hold your money." },
                { q: "Is it safe?", a: "We verify phone numbers and allow rating reviews. However, always follow our Safety Tips when meeting someone new." },
                { q: "Can I find work in my area?", a: "Yes, Chowkar is designed for local connections. You will see jobs posted within your selected district radius." }
            ]
        }
    },
    hi: {
        seoTitle: "स्थानीय कामगारों को काम पर रखें",
        navSearch: "आस-पास खोजें...",
        heroTitle: "स्थानीय कामगारों को काम पर रखें",
        heroSubtitle: "सीधा कॉल • कोई कमीशन नहीं",
        services: {
            driver: "ड्राइवर",
            labor: "मज़दूर",
            maid: "बाई",
            farm: "खेती",
            electric: "बिजली",
            plumber: "नलसाज़",
            painter: "पेंटर",
            more: "और देखें"
        },
        actions: {
            postJob: "काम पोस्ट करें",
            findWork: "काम ढूँढें"
        },
        employers: {
            title: "मालिकों के लिए",
            desc: "कुशल कामगारों को सीधे काम पर रखें, बिना किसी कमीशन के।",
            list: ["आसान भर्ती", "सीधा कॉल करें", "दाम तय करें"],
            cta: "अभी पोस्ट करें"
        },
        workers: {
            title: "कामगारों के लिए",
            desc: "अपने पास रोज़गार पाएं और तुरंत पैसे कमाएं।",
            list: ["आपके पास काम", "100% कमाई आपकी", "अपनी पहचान बनाएं"],
            cta: "प्रोफाइल बनाएं"
        },
        trust: {
            privacy: "गोपनीयता पहले",
            privacySub: "आपका नंबर गुप्त रहता है",
            community: "समुदाय द्वारा रेटेड",
            communitySub: "कॉल करने से पहले रेटिंग देखें",
            direct: "सीधा संपर्क",
            directSub: "कोई बिचौलिए की फीस नहीं"
        },
        testimonials: {
            title: "सफलता की कहानियां",
            desc: "देखें कैसे 'चौकर' जीवन बदल रहा है",
            stories: [
                {
                    name: "राजेश कुमार", role: "ट्रैक्टर ड्राइवर", loc: "मध्य प्रदेश",
                    avatar: "/assets/testimonials/rajesh-kumar.jpg",
                    text: "चौकर से पहले, मुझे काम के लिए चौक पर बैठना पड़ता था। अब मुझे सीधे फोन पर कॉल आते हैं। मेरी मासिक आय दोगुनी हो गई है!"
                },
                {
                    name: "सुरेश पटेल", role: "फार्म मालिक", loc: "गुजरात",
                    avatar: "/assets/testimonials/suresh-patel.jpg",
                    text: "कटाई के मौसम में 10 मज़दूर ढूँढना सिरदर्द था। इस ऐप के साथ, मैंने जॉब पोस्ट की और 1 घंटे में 15 कॉल मिले। अद्भुत!"
                },
                {
                    name: "अनीता देवी", role: "बाई", loc: "उत्तर प्रदेश",
                    avatar: "/assets/testimonials/anita-devi.jpg",
                    text: "सुरक्षित और आसान। मुझे अपने इलाके के पास 3 घरों में काम मिल गया। सबसे अच्छी बात यह है कि मैं मालिकों पर भरोसा कर सकती हूँ क्योंकि वे सत्यापित हैं।"
                }
            ]
        },
        appSection: {
            title: "चौकर अब आपके फोन पर",
            subtitle: "सूचनाओं और सीधी कॉलिंग के लिए ऐप इंस्टॉल करें।",
            features: ["सीधी कॉलिंग", "तुरंत अलर्ट", "जीरो फीस"],
            cta: "अभी इंस्टॉल करें"
        },
        videoGuides: {
            title: "चौकर कैसे काम करता है",
            subtitle: "तुरंत शुरू करने के लिए ये सरल गाइड देखें।",
            employer: {
                title: "वर्कर को काम पर रखें",
                desc: "60 सेकंड में काम पोस्ट करें और बोलियां प्राप्त करें।"
            },
            worker: {
                title: "नौकरी खोजें",
                desc: "स्थानीय काम देखें और सीधे नियोक्ताओं को कॉल करें।"
            }
        },
        howItWorks: {
            title: "यह कैसे काम करता है",
            steps: ["प्रोफाइल बनाएं", "जॉब पोस्ट/खोजें", "संपर्क करें", "भुगतान प्राप्त करें"],
            video: "वीडियो देखें"
        },
        faq: {
            title: "अक्सर पूछे जाने वाले प्रश्न",
            items: [
                { q: "क्या 'चौकर' पूरी तरह से मुफ़्त है?", a: "हाँ! जुड़ना और प्रोफ़ाइल बनाना 100% मुफ़्त है। हम आपकी दिहाड़ी पर कोई कमीशन नहीं लेते हैं।" },
                { q: "मैं कामगार को भुगतान कैसे करूँ?", a: "काम पूरा होने के बाद आप कामगार को सीधे (नकद/UPI) भुगतान करते हैं। चौकर आपका पैसा नहीं रखता है।" },
                { q: "क्या यह सुरक्षित है?", a: "हम फोन नंबरों का सत्यापन करते हैं और रेटिंग समीक्षाओं की अनुमति देते हैं। हालाँकि, किसी नए व्यक्ति से मिलते समय हमेशा हमारे सुरक्षा सुझावों का पालन करें।" },
                { q: "क्या मुझे अपने क्षेत्र में काम मिल सकता है?", a: "हाँ, चौकर स्थानीय संपर्कों के लिए डिज़ाइन किया गया है। आपको अपने चुने हुए जिले के दायरे में पोस्ट की गई जॉब्स दिखाई देंगी।" }
            ]
        }
    },
    pa: {
        seoTitle: "ਸਥਾਨਕ ਕਾਮੇ ਹਾਇਰ ਕਰੋ ਅਤੇ ਕੰਮ ਲੱਭੋ",
        navSearch: "ਨੇੜੇ ਖੋਜੋ...",
        heroTitle: "ਸਥਾਨਕ ਕਾਮੇ ਹਾਇਰ ਕਰੋ",
        heroSubtitle: "ਸਿੱਧੀ ਕਾਲ • ਕੋਈ ਕਮਿਸ਼ਨ ਨਹੀਂ",
        services: {
            driver: "ਡਰਾਈਵਰ",
            labor: "ਮਜ਼ਦੂਰ",
            maid: "ਮਾਸੀ",
            farm: "ਖੇਤੀ",
            electric: "ਬਿਜਲੀ",
            plumber: "ਨਲਸਾਜ਼",
            painter: "ਪੇਂਟਰ",
            more: "ਹੋਰ"
        },
        actions: {
            postJob: "ਕੰਮ ਦਿਓ",
            findWork: "ਕੰਮ ਲੱਭੋ"
        },
        employers: {
            title: "ਮਾਲਕਾਂ ਲਈ",
            desc: "ਕੁਸ਼ਲ ਕਾਮਿਆਂ ਨੂੰ ਸਿੱਧਾ ਹਾਇਰ ਕਰੋ, ਬਿਨਾਂ ਕਿਸੇ ਕਮਿਸ਼ਨ ਦੇ।",
            list: ["ਆਸਾਨ ਭਰਤੀ", "ਸਿੱਧੀ ਕਾਲ ਕਰੋ", "ਕੀਮਤ ਤੈਅ ਕਰੋ"],
            cta: "ਹੁਣੇ ਪੋਸਟ ਕਰੋ"
        },
        workers: {
            title: "ਕਾਮਿਆਂ ਲਈ",
            desc: "ਆਪਣੇ ਨੇੜੇ ਰੋਜ਼ਗਾਰ ਲੱਭੋ ਅਤੇ ਤੁਰੰਤ ਕਮਾਓ।",
            list: ["ਤੁਹਾਡੇ ਨੇੜੇ ਕੰਮ", "100% ਕਮਾਈ ਤੁਹਾਡੀ", "ਆਪਣੀ ਸਾਖ ਬਣਾਓ"],
            cta: "ਪ੍ਰੋਫਾਈਲ ਬਣਾਓ"
        },
        trust: {
            privacy: "ਪਰਦੇਦਾਰੀ ਪਹਿਲਾਂ",
            privacySub: "ਤੁਹਾਡਾ ਨੰਬਰ ਗੁਪਤ ਰਹਿੰਦਾ ਹੈ",
            community: "ਭਾਈਚਾਰੇ ਦੁਆਰਾ ਰੇਟ ਕੀਤਾ ਗਿਆ",
            communitySub: "ਕਾਲ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਰੇਟਿੰਗ ਵੇਖੋ",
            direct: "ਸਿੱਧਾ ਸੰਪਰਕ",
            directSub: "ਕੋਈ ਵਿਚੋਲੇ ਦੀ ਫੀਸ ਨਹੀਂ"
        },
        testimonials: {
            title: "ਸਫਲਤਾ ਦੀਆਂ ਕਹਾਣੀਆਂ",
            desc: "ਵੇਖੋ 'ਚੌਂਕੜ' ਕਿਵੇਂ ਜ਼ਿੰਦਗੀ ਬਦਲ ਰਿਹਾ ਹੈ",
            stories: [
                {
                    name: "ਰਾਜੇਸ਼ ਕੁਮਾਰ", role: "ਟਰੈਕਟਰ ਡਰਾਈਵਰ", loc: "ਮੱਧ ਪ੍ਰਦੇਸ਼",
                    avatar: "/assets/testimonials/rajesh-kumar.jpg",
                    text: "'ਚੌਂਕੜ' ਤੋਂ ਪਹਿਲਾਂ, ਮੈਨੂੰ ਕੰਮ ਲਈ ਚੌਕ 'ਤੇ ਬੈਠਣਾ ਪੈਂਦਾ ਸੀ। ਹੁਣ ਮੈਨੂੰ ਸਿੱਧਾ ਫੋਨ 'ਤੇ ਕਾਲ ਆਉਂਦੀ ਹੈ। ਮੇਰੀ ਮਹੀਨਾਵਾਰ ਆਮਦਨ ਦੁੱਗਣੀ ਹੋ ਗਈ ਹੈ!"
                },
                {
                    name: "ਸੁਰੇਸ਼ ਪਟੇਲ", role: "ਫਾਰਮ ਮਾਲਕ", loc: "ਗੁਜਰਾਤ",
                    avatar: "/assets/testimonials/suresh-patel.jpg",
                    text: "ਵਾਢੀ ਦੇ ਮੌਸਮ ਵਿੱਚ 10 ਮਜ਼ਦੂਰ ਲੱਭਣਾ ਸਿਰਦਰਦ ਸੀ। ਇਸ ਐਪ ਨਾਲ, ਮੈਂ ਨੌਕਰੀ ਪੋਸਟ ਕੀਤੀ ਅਤੇ 1 ਘੰਟੇ ਵਿੱਚ 15 ਕਾਲਾਂ ਪ੍ਰਾਪਤ ਕੀਤੀਆਂ। ਕਮਾਲ!"
                },
                {
                    name: "ਅਨੀਤਾ ਦੇਵੀ", role: "ਮਾਸੀ", loc: "ਉੱਤਰ ਪ੍ਰਦੇਸ਼",
                    avatar: "/assets/testimonials/anita-devi.jpg",
                    text: "ਸੁਰੱਖਿਅਤ ਅਤੇ ਆਸਾਨ। ਮੈਨੂੰ ਆਪਣੇ ਇਲਾਕੇ ਦੇ ਨੇੜੇ 3 ਘਰਾਂ ਵਿੱਚ ਕੰਮ ਮਿਲਿਆ। ਸਭ ਤੋਂ ਵਧੀਆ ਗੱਲ ਇਹ ਹੈ ਕਿ ਮੈਂ ਮਾਲਕਾਂ 'ਤੇ ਭਰੋਸਾ ਕਰ ਸਕਦੀ ਹਾਂ ਕਿਉਂਕਿ ਉਹ ਵੈਰੀਫਾਈਡ ਹਨ।"
                }
            ]
        },
        appSection: {
            title: "ਚੌਂਕੜ ਹੁਣ ਤੁਹਾਡੇ ਫੋਨ ਤੇ",
            subtitle: "ਨੋਟੀਫਿਕੇਸ਼ਨਾਂ ਅਤੇ ਸਿੱਧੀ ਕਾਲਿੰਗ ਲਈ ਐਪ ਇੰਸਟਾਲ ਕਰੋ।",
            features: ["ਸਿੱਧੀ ਕਾਲਿੰਗ", "ਤੁਰੰਤ ਅਲਰਟ", "ਜ਼ੀਰੋ ਫੀਸ"],
            cta: "ਹੁਣੇ ਇੰਸਟਾਲ ਕਰੋ"
        },
        videoGuides: {
            title: "ਚੌਂਕੜ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
            subtitle: "ਤੁਰੰਤ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਇਹ ਸਧਾਰਨ ਗਾਈਡਾਂ ਦੇਖੋ।",
            employer: {
                title: "ਵਰਕਰ ਨੂੰ ਕੰਮ 'ਤੇ ਰੱਖੋ",
                desc: "60 ਸਕਿੰਟਾਂ ਵਿੱਚ ਕੰਮ ਪੋਸਟ ਕਰੋ ਅਤੇ ਬੋਲੀਆਂ ਪ੍ਰਾਪਤ ਕਰੋ।"
            },
            worker: {
                title: "ਨੌਕਰੀ ਲੱਭੋ",
                desc: "ਸਥਾਨਕ ਕੰਮ ਦੇਖੋ ਅਤੇ ਮਾਲਕਾਂ ਨੂੰ ਸਿੱਧਾ ਕਾਲ ਕਰੋ।"
            }
        },
        howItWorks: {
            title: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
            steps: ["ਪ੍ਰੋਫਾਈਲ ਬਣਾਓ", "ਕੰਮ/ਨੌਕਰੀ ਲੱਭੋ", "ਸੰਪਰਕ ਕਰੋ", "ਭੁਗਤਾਨ ਪ੍ਰਾਪਤ ਕਰੋ"],
            video: "ਵੀਡੀਓ ਦੇਖੋ"
        },
        faq: {
            title: "ਅਕਸਰ ਪੁੱਛੇ ਜਾਣ ਵਾਲੇ ਸਵਾਲ",
            items: [
                { q: "ਕੀ 'ਚੌਂਕੜ' ਬਿਲਕੁਲ ਮੁਫਤ ਹੈ?", a: "ਹਾਂ! ਸ਼ਾਮਲ ਹੋਣਾ ਅਤੇ ਪ੍ਰੋਫਾਈਲ ਬਣਾਉਣਾ 100% ਮੁਫਤ ਹੈ। ਅਸੀਂ ਤੁਹਾਡੀ ਦਿਹਾੜੀ 'ਤੇ ਕੋਈ ਕਮਿਸ਼ਨ ਨਹੀਂ ਲੈਂਦੇ।" },
                { q: "ਮੈਂ ਕਾਮੇ ਨੂੰ ਭੁਗਤਾਨ ਕਿਵੇਂ ਕਰਾਂ?", a: "ਕੰਮ ਪੂਰਾ ਹੋਣ ਤੋਂ ਬਾਅਦ ਤੁਸੀਂ ਕਾਮੇ ਨੂੰ ਸਿੱਧਾ (ਨਕਦ/UPI) ਭੁਗਤਾਨ ਕਰਦੇ ਹੋ। 'ਚੌਂਕੜ' ਤੁਹਾਡੇ ਪੈਸੇ ਨਹੀਂ ਰੱਖਦਾ।" },
                { q: "ਕੀ ਇਹ ਸੁਰੱਖਿਅਤ ਹੈ?", a: "ਅਸੀਂ ਫੋਨ ਨੰਬਰਾਂ ਦੀ ਜਾਂਚ ਕਰਦੇ ਹਾਂ ਅਤੇ ਰੇਟਿੰਗ ਸਮੀਖਿਆਵਾਂ ਦੀ ਆਗਿਆ ਦਿੰਦੇ ਹਾਂ। ਹਾਲਾਂਕਿ, ਕਿਸੇ ਨਵੇਂ ਵਿਅਕਤੀ ਨੂੰ ਮਿਲਣ ਵੇਲੇ ਹਮੇਸ਼ਾ ਸਾਡੇ ਸੁਰੱਖਿਆ ਸੁਝਾਵਾਂ ਦੀ ਪਾਲਣਾ ਕਰੋ।" },
                { q: "ਕੀ ਮੈਨੂੰ ਆਪਣੇ ਇਲਾਕੇ ਵਿੱਚ ਕੰਮ ਮਿਲ ਸਕਦਾ ਹੈ?", a: "ਹਾਂ, 'ਚੌਂਕੜ' ਸਥਾਨਕ ਸੰਪਰਕਾਂ ਲਈ ਤਿਆਰ ਕੀਤਾ ਗਿਆ ਹੈ। ਤੁਹਾਨੂੰ ਆਪਣੇ ਚੁਣੇ ਹੋਏ ਜ਼ਿਲ੍ਹੇ ਦੇ ਦਾਇਰੇ ਵਿੱਚ ਪੋਸਟ ਕੀਤੀਆਂ ਨੌਕਰੀਆਂ ਦਿਖਾਈ ਦੇਣਗੀਆਂ।" }
            ]
        }
    }
};

interface LandingPageProps {
    onGetStarted: () => void;
    language?: 'en' | 'hi' | 'pa';
    onLanguageToggle?: () => void;
    isSigningIn: boolean;
}



export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, isSigningIn }) => {
    const navigate = useNavigate();
    const { language, setLanguage, user } = useUser();
    const { config } = useAdminConfig();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeFaq, setActiveFaq] = useState<number | null>(0);
    const [isSticky, setIsSticky] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState<{ src: string; title: string } | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setIsSticky(window.scrollY > 400);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const [modalState, setModalState] = useState<{
        safety: boolean;
        guidelines: boolean;
        terms: boolean;
    }>({ safety: false, guidelines: false, terms: false });

    // Derive content from current language
    const content = LANDING_CONTENT[language] || LANDING_CONTENT['hi']; // Default to Hindi if undefined

    const openModal = (type: 'safety' | 'guidelines' | 'terms') =>
        setModalState(prev => ({ ...prev, [type]: true }));

    const closeModal = (type: 'safety' | 'guidelines' | 'terms') =>
        setModalState(prev => ({ ...prev, [type]: false }));

    const toggleFaq = (index: number) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    // URL Referral Handling
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (refCode) {
            console.log('[Referral] Found referral code in URL:', refCode);
            localStorage.setItem('chowkar_referred_by_code', refCode);
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, []);

    // Scroll to top on load
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const languages = [
        { code: 'hi', label: 'हिंदी' },
        { code: 'pa', label: 'ਪੰਜਾਬੀ' },
        { code: 'en', label: 'English' }
    ] as const;

    return (
        <div className="min-h-screen bg-background font-sans text-text-primary transition-colors duration-300">
            <SEO
                title={content.seoTitle}
                description="India's most trusted marketplace for daily wage work. Hire drivers, laborers, maids, and more instantly."
            />

            {/* --- Modals --- */}
            <SafetyTipsModal isOpen={modalState.safety} onClose={() => closeModal('safety')} />
            <CommunityGuidelinesModal isOpen={modalState.guidelines} onClose={() => closeModal('guidelines')} />
            <TermsModal isOpen={modalState.terms} onClose={() => closeModal('terms')} />
            <VideoModal
                isOpen={!!selectedVideo}
                onClose={() => setSelectedVideo(null)}
                src={selectedVideo?.src || null}
                title={selectedVideo?.title || ''}
            />

            {/* --- Super App Header --- */}
            <nav className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur-xl z-40 border-b border-border transition-colors pt-safe">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2 md:gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-1.5 cursor-pointer shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <MapPin size={18} fill="currentColor" strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white leading-none hidden sm:inline">
                            CHOWKAR
                        </span>
                    </div>

                    {/* Integrated Search Bar (Fake) */}
                    <button
                        onClick={onGetStarted}
                        className={`
                            flex-1 max-w-sm h-10 rounded-full flex items-center px-3 md:px-4 gap-2 text-sm font-medium transition-all duration-500 transform
                            ${isSticky
                                ? 'bg-emerald-600 text-white shadow-lg translate-y-0 opacity-100 scale-100'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 md:opacity-100 opacity-60 md:scale-100 scale-95'}
                        `}
                    >
                        <Zap size={16} className={isSticky ? 'text-white fill-white' : 'text-amber-500 fill-current'} />
                        <span className={`truncate ${isSticky ? 'text-white' : ''}`}>{content.navSearch}</span>
                    </button>

                    {/* --- Language Switcher (Redesigned) --- */}
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1 animate-pulse-once shrink-0" aria-label="Select language">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                aria-pressed={language === lang.code}
                                className={`
                                    px-2 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300
                                    ${language === lang.code
                                        ? 'bg-emerald-600 text-white shadow-md transform scale-105'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}
                                `}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <main className="pt-16">
                {/* --- Hero Section --- */}
                <section className="relative pt-32 pb-12 px-4 overflow-hidden">
                    {/* Dynamic Background */}
                    <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-900/20 pointer-events-none" />
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] pointer-events-none animate-pulse" />
                    <div className="absolute top-40 -left-20 w-72 h-72 bg-emerald-400/20 rounded-full blur-[80px] pointer-events-none animate-bounce-slow" />


                    <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-12">
                        {/* 1. Text & Actions Content */}
                        <div className="flex-1 text-center lg:text-left font-sans">
                            {/* 1. Value Prop Header */}
                            <h1 className="text-3xl sm:text-4xl md:text-7xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4 tracking-tight leading-tight drop-shadow-sm">
                                {content.heroTitle}
                            </h1>
                            <p className="text-sm md:text-xl font-bold text-gray-600 dark:text-gray-300 mb-6 md:mb-8 uppercase tracking-wider">
                                {content.heroSubtitle}
                            </p>

                            {/* 2. Super Service Grid */}
                            <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-8 md:mb-10 max-w-md mx-auto lg:mx-0">
                                {(() => {
                                    const activeIds = ['Driver', 'Labor', 'Maid', 'Farm Labor', 'Electrical', 'Plumbing', 'Painting'];
                                    const activeCats = activeIds.map(id => CATEGORY_CONFIG.find(c => c.id === id)).filter(Boolean);

                                    return (
                                        <>
                                            {activeCats.map((cat) => {
                                                const Icon = cat!.icon;
                                                return (
                                                    <button
                                                        key={cat!.id}
                                                        onClick={onGetStarted}
                                                        className="flex flex-col items-center gap-1.5 md:gap-2 group active:scale-95 transition-transform"
                                                    >
                                                        <div className={`w-12 md:w-14 h-12 md:h-14 ${cat!.bg} rounded-2xl md:rounded-[1.2rem] flex items-center justify-center text-xl md:text-2xl shadow-md border-b-4 border-black/5 dark:border-white/5 group-hover:shadow-lg group-hover:-translate-y-1 transition-all ${cat!.textColor || 'text-gray-700'}`}>
                                                            <Icon className="w-5 md:w-6.5 h-5 md:h-6.5" strokeWidth={2.5} />
                                                        </div>
                                                        <span className="text-[10px] md:text-[11px] font-bold text-gray-700 dark:text-gray-300 leading-tight">
                                                            {cat!.label[language] || cat!.label.en}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={onGetStarted}
                                                className="flex flex-col items-center gap-1.5 md:gap-2 group active:scale-95 transition-transform"
                                            >
                                                <div className="w-12 md:w-14 h-12 md:h-14 bg-gray-100 text-gray-600 rounded-2xl md:rounded-[1.2rem] flex items-center justify-center text-xl md:text-2xl shadow-sm border border-black/5 group-hover:shadow-md transition-all">
                                                    <Users className="w-5 md:w-6 h-5 md:h-6" />
                                                </div>
                                                <span className="text-[9px] md:text-[10px] font-bold text-gray-600 dark:text-gray-400 leading-tight">
                                                    {content.services.more}
                                                </span>
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Trust Badges (Relocated) */}
                            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-8 md:mb-10 max-w-sm mx-auto lg:mx-0">
                                {[
                                    { icon: Shield, label: content.trust.privacy, color: 'text-blue-500' },
                                    { icon: Star, label: content.trust.community, color: 'text-amber-500' },
                                    { icon: Zap, label: content.trust.direct, color: 'text-emerald-500' },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex flex-col items-center p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-black/5 backdrop-blur-sm">
                                        <item.icon size={18} className={`${item.color} mb-1 sm:mb-1.5`} />
                                        <span className="text-[8px] md:text-[9px] font-black uppercase text-gray-900 dark:text-white text-center">{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 3. Quick Actions Pill */}
                            <div className="flex flex-col md:flex-row items-center justify-center lg:justify-start gap-4 w-full">
                                <button
                                    onClick={onGetStarted}
                                    disabled={isSigningIn}
                                    className="w-full md:flex-1 bg-emerald-600 text-white rounded-2xl py-4 font-bold text-lg shadow-xl shadow-emerald-600/20 active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                >
                                    <Briefcase size={22} strokeWidth={2.5} />
                                    {content.actions.postJob}
                                </button>
                                <button
                                    onClick={onGetStarted}
                                    disabled={isSigningIn}
                                    className="w-full md:flex-1 bg-transparent text-emerald-700 dark:text-emerald-400 border-2 border-emerald-600/30 rounded-2xl py-4 font-bold text-lg active:scale-95 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Users size={22} strokeWidth={2.5} />
                                    {content.actions.findWork}
                                </button>
                            </div>
                        </div>

                        {/* 4. Hero Visual Illustration */}
                        <div className="flex-1 w-full max-w-xl lg:max-w-none px-4 sm:px-0">
                            <img
                                src="/assets/hero/hero-illustration.png"
                                alt="Chowkar Platform"
                                className="w-full h-auto max-h-[300px] md:max-h-none object-contain drop-shadow-2xl animate-float mx-auto"
                            />
                        </div>
                    </div>
                </section>

                {/* --- Persona Split Section --- */}
                <section className="py-8 md:py-12 bg-surface relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                            {/* Card 1: For Employers */}
                            <div className="group relative overflow-hidden rounded-3xl bg-background border-2 border-transparent hover:border-blue-500/30 p-8 shadow-xl hover:shadow-2xl transition-all duration-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-sm mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-500">
                                        <Briefcase size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-text-primary mb-3">
                                        {content.employers.title}
                                    </h3>
                                    <p className="text-text-secondary mb-6 h-12 font-medium leading-relaxed">
                                        {content.employers.desc}
                                    </p>
                                    <ul className="space-y-4 mb-8">
                                        {content.employers.list.map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold text-sm">
                                                <div className="p-0.5 bg-blue-500 rounded-full">
                                                    <CheckCircle size={14} className="text-white" />
                                                </div>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={onGetStarted} className="btn-ghost !p-0 font-black text-blue-600 dark:text-blue-400 hover:gap-3 transition-all flex items-center gap-2 border-none">
                                        {content.employers.cta} <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Card 2: For Workers */}
                            <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border-2 border-transparent hover:border-emerald-500/30 p-8 shadow-xl hover:shadow-2xl transition-all duration-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center shadow-sm mb-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-500">
                                        <Users size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-text-primary mb-3">
                                        {content.workers.title}
                                    </h3>
                                    <p className="text-text-secondary mb-6 h-12 font-medium leading-relaxed">
                                        {content.workers.desc}
                                    </p>
                                    <ul className="space-y-4 mb-8">
                                        {content.workers.list.map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold text-sm">
                                                <div className="p-0.5 bg-emerald-500 rounded-full">
                                                    <CheckCircle size={14} className="text-white" />
                                                </div>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={onGetStarted} className="btn-ghost !p-0 font-black text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all flex items-center gap-2 border-none">
                                        {content.workers.cta} <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Trust Section Removed (Moved to Hero) */}

                {/* --- Testimonials Grid --- */}
                <section className="py-24 bg-surface overflow-hidden relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-text-primary mb-4">
                                {content.testimonials.title}
                            </h2>
                            <p className="text-xl text-text-secondary">
                                {content.testimonials.desc}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 md:gap-8">
                            {content.testimonials.stories.map((t, i) => (
                                <div key={i} className="p-6 md:p-8 bg-background rounded-3xl border border-border relative group hover:shadow-xl transition-all">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500/20 bg-emerald-50 relative group-hover:scale-105 transition-transform">
                                            <img
                                                src={t.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=10b981&color=fff`}
                                                alt={t.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-text-primary">{t.name}</h4>
                                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{t.role}</p>
                                            <p className="text-xs text-text-muted">{t.loc}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-0.5 mb-4 text-amber-500">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill="currentColor" />)}
                                    </div>
                                    <p className="text-text-secondary italic leading-relaxed">"{t.text}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- App Deep-Link Section --- */}
                <section className="py-20 bg-emerald-950 text-white overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1),transparent)] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            {/* 1. App Mockup */}
                            <div className="flex-1 w-full max-w-sm lg:max-w-none relative">
                                <div className="absolute -inset-10 bg-emerald-500/20 rounded-full blur-[80px] animate-pulse" />
                                <img
                                    src="/assets/app-mockup.png"
                                    alt="Chowkar Mobile App"
                                    className="relative w-full h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] transform -rotate-2 hover:rotate-0 transition-transform duration-700 mx-auto"
                                />
                            </div>

                            {/* 2. Content */}
                            <div className="flex-1 text-center lg:text-left">
                                <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                                    {content.appSection.title}
                                </h2>
                                <p className="text-xl text-emerald-200/80 mb-10 max-w-xl mx-auto lg:mx-0 font-medium">
                                    {content.appSection.subtitle}
                                </p>

                                <div className="grid sm:grid-cols-2 gap-4 mb-12">
                                    {content.appSection.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                                                <CheckCircle size={20} className="text-white" />
                                            </div>
                                            <span className="font-bold text-sm tracking-wide">{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                    <a
                                        href="https://ghtshhafukyirwkfdype.supabase.co/storage/v1/object/public/downloads/chowkar-new-keys.apk"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-white text-emerald-950 px-8 py-4 rounded-2xl font-black text-lg hover:bg-emerald-50 transition-all flex items-center gap-3 shadow-xl active:scale-95"
                                    >
                                        <PlayCircle size={24} />
                                        Download APK
                                    </a>
                                    <button
                                        onClick={() => alert("iOS App coming soon!")}
                                        className="bg-transparent border-2 border-white/20 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95"
                                    >
                                        <Smartphone size={24} />
                                        App Store
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- Video Guides Section --- */}
                <section id="video-guides" className="py-24 bg-white dark:bg-gray-900 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6">
                                {content.videoGuides.title}
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                {content.videoGuides.subtitle}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Employer Guide */}
                            <div
                                onClick={() => setSelectedVideo({
                                    src: `/assets/videos/employer_guide_${language}.webm`,
                                    title: content.videoGuides.employer.title
                                })}
                                className="group relative bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl p-8 border border-emerald-100 dark:border-emerald-800/30 cursor-pointer overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />

                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg group-hover:scale-110 transition-transform">
                                        <PlayCircle size={32} fill="currentColor" className="text-emerald-300" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                                        {content.videoGuides.employer.title}
                                    </h3>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                                        {content.videoGuides.employer.desc}
                                    </p>

                                    <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden relative shadow-inner">
                                        <img
                                            src="/assets/hero/hero-illustration.png"
                                            alt="Employer Guide Preview"
                                            className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                                <PlayCircle size={24} className="text-white fill-white ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Worker Guide */}
                            <div
                                onClick={() => setSelectedVideo({
                                    src: `/assets/videos/worker_guide_${language}.webm`,
                                    title: content.videoGuides.worker.title
                                })}
                                className="group relative bg-teal-50 dark:bg-teal-900/10 rounded-3xl p-8 border border-teal-100 dark:border-teal-800/30 cursor-pointer overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-teal-500/20 transition-colors" />

                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg group-hover:scale-110 transition-transform">
                                        <PlayCircle size={32} fill="currentColor" className="text-teal-300" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                                        {content.videoGuides.worker.title}
                                    </h3>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                                        {content.videoGuides.worker.desc}
                                    </p>

                                    <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden relative shadow-inner">
                                        <img
                                            src="/assets/testimonials/rajesh-kumar.jpg"
                                            alt="Worker Guide Preview"
                                            className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                                <PlayCircle size={24} className="text-white fill-white ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- How It Works --- */}
                <section id="how-it-works" className="py-24 bg-emerald-50 dark:bg-emerald-900/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {content.howItWorks.title}
                            </h2>
                        </div>

                        <div className="relative">
                            {/* Connecting Line (Desktop) */}
                            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-emerald-100 dark:bg-emerald-900/30 -translate-y-1/2 z-0" />

                            <div className="grid md:grid-cols-4 gap-8 relative z-10">
                                {content.howItWorks.steps.map((step, i) => (
                                    <div key={i} className="card p-8 text-center relative group hover:border-emerald-500/50 hover:shadow-2xl transition-all duration-500">
                                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6 text-2xl font-black group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                            {i === 0 ? <Users size={24} /> : i === 1 ? <Briefcase size={24} /> : i === 2 ? <Smartphone size={24} /> : <Calculator size={24} />}
                                        </div>
                                        <div className="absolute top-4 right-4 text-7xl font-black text-gray-100/50 dark:text-gray-800/50 z-[-1] select-none group-hover:text-emerald-500/10 transition-colors">
                                            {i + 1}
                                        </div>
                                        <h3 className="font-black text-xl text-gray-900 dark:text-white tracking-tight">
                                            {step}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center mt-12">
                            <a href="#video-guides" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center justify-center gap-2 mx-auto">
                                <PlayCircle size={20} /> {content.howItWorks.video}
                            </a>
                        </div>
                    </div>
                </section>

                {/* --- FAQ Section --- */}
                <section className="py-24 bg-white dark:bg-gray-900">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {content.faq.title}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {content.faq.items.map((item, i) => (
                                <div key={i} className="card overflow-hidden !rounded-2xl border-gray-100 dark:border-gray-800 mb-4 transition-all hover:shadow-md">
                                    <button
                                        onClick={() => toggleFaq(i)}
                                        className="w-full p-6 text-left flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-all group"
                                    >
                                        <span className="font-black text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{item.q}</span>
                                        {activeFaq === i ? <ChevronUp size={20} className="text-emerald-600" /> : <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600" />}
                                    </button>
                                    {activeFaq === i && (
                                        <div className="p-6 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-t border-gray-50 dark:border-gray-800 animate-slide-down">
                                            <p className="font-medium leading-relaxed">{item.a}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- Footer Component --- */}
                <Footer language={language} onOpenModal={openModal} />

                {/* --- Video Player Modal --- */}
                <VideoModal
                    isOpen={!!selectedVideo}
                    src={selectedVideo?.src || ''}
                    title={selectedVideo?.title}
                    onClose={() => setSelectedVideo(null)}
                />
            </main>
        </div>
    );
};
