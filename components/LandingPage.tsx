import React, { useState, useEffect } from 'react';
import {
    Users, Briefcase, Calculator, Star, Shield,
    ArrowRight, Menu, X, CheckCircle, Smartphone,
    MapPin, Globe, ChevronDown, ChevronUp, PlayCircle
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from './SEO';
import { Footer } from './Footer';
import { SafetyTipsModal, CommunityGuidelinesModal, TermsModal } from './InfoModals';
import { useUser } from '../contexts/UserContextDB';

interface LandingPageProps {
    onGetStarted: () => void;
    language: 'en' | 'hi';
    onLanguageToggle: () => void;
    isSigningIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, isSigningIn }) => {
    const navigate = useNavigate();
    const { language, setLanguage, user, t } = useUser();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    // Modal States
    const [modalState, setModalState] = useState<{
        safety: boolean;
        guidelines: boolean;
        terms: boolean;
    }>({ safety: false, guidelines: false, terms: false });

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

            // Optional: Clean up URL without reload
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, []);

    // Auto-redirect if logged in (optional UX choice)
    useEffect(() => {
        if (user) {
            // console.log("User logged in, could redirect to home...");
        }
    }, [user]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-white transition-colors duration-300">
            <SEO
                title={language === 'en' ? "Hire Local Workers & Find Jobs" : "स्थानीय कामगारों को काम पर रखें"}
                description="India's most trusted marketplace for daily wage work. Hire drivers, laborers, maids, and more instantly."
            />

            {/* --- Modals --- */}
            <SafetyTipsModal isOpen={modalState.safety} onClose={() => closeModal('safety')} />
            <CommunityGuidelinesModal isOpen={modalState.guidelines} onClose={() => closeModal('guidelines')} />
            <TermsModal isOpen={modalState.terms} onClose={() => closeModal('terms')} />

            {/* --- Promo Top Banner --- */}


            {/* --- Navigation --- */}
            <nav className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 border-b border-gray-100 dark:border-gray-800 transition-colors pt-safe">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <MapPin size={24} fill="currentColor" />
                            </div>
                            <span className="text-2xl font-bold font-serif-logo bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
                                CHOWKAR
                            </span>
                        </div>

                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-gray-600 dark:text-gray-300 hover:text-emerald-600 font-medium transition-colors">
                                {language === 'en' ? 'Features' : 'सुविधाएँ'}
                            </button>
                            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-gray-600 dark:text-gray-300 hover:text-emerald-600 font-medium transition-colors">
                                {t.howItWorks}
                            </button>

                            {/* Language Toggle */}
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                                <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{language === 'en' ? 'हिंदी' : 'English'}</span>
                            </button>

                            <button onClick={onGetStarted} disabled={isSigningIn} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed">
                                {isSigningIn ? t.loading : t.heroBtnPoster}
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-gray-600 dark:text-gray-300"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 p-4 pt-safe space-y-4 shadow-2xl animate-slide-down z-30">
                        <button onClick={onGetStarted} disabled={isSigningIn} className="btn btn-primary w-full py-4 text-lg">
                            {isSigningIn ? t.loading : t.heroBtnPoster}
                        </button>
                        <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} className="btn btn-secondary w-full py-4 text-lg">
                            <Globe size={18} /> {language === 'en' ? 'Switch to Hindi' : 'हिंदी में बदलें'}
                        </button>
                    </div>
                )}
            </nav>

            <main className="pt-16">
                {/* --- Hero Section --- */}
                <section className="relative overflow-hidden pt-20 pb-32">
                    {/* Background Blobs */}
                    <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-8 animate-fade-in-up">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            {language === 'en' ? '#1 App for Local Work' : 'स्थानीय काम के लिए #1 ऐप'}
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tight mb-6 leading-tight animate-fade-in-up delay-100">
                            {t.heroTitle}
                        </h1>

                        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
                            {t.heroSubtitle}
                        </p>



                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-fade-in-up delay-300">
                            <button onClick={onGetStarted} disabled={isSigningIn} className="btn btn-primary w-full sm:w-auto px-10 py-5 text-xl shadow-2xl shadow-emerald-600/30 hover:shadow-emerald-600/40 transform hover:-translate-y-1.5 transition-all duration-300">
                                <Briefcase size={28} className="mr-2" />
                                {isSigningIn ? t.loading : t.heroBtnPoster}
                            </button>
                            <button onClick={onGetStarted} disabled={isSigningIn} className="btn btn-secondary w-full sm:w-auto px-10 py-5 text-xl shadow-xl hover:shadow-2xl border-2 border-gray-100 dark:border-gray-800 transform hover:-translate-y-1.5 transition-all duration-300">
                                <Users size={28} className="text-emerald-500 mr-2" />
                                {isSigningIn ? t.loading : t.heroBtnWorker}
                            </button>
                        </div>

                        {!Capacitor.isNativePlatform() && (
                            <div className="mt-8 animate-fade-in-up delay-500">
                                <a
                                    href="https://eeinickxxgiegwxabzhv.supabase.co/storage/v1/object/public/downloads/chowkar-new-keys.apk"
                                    download
                                    className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold hover:underline bg-emerald-50 dark:bg-emerald-900/30 px-6 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50"
                                >
                                    <Smartphone size={20} />
                                    {t.downloadApp}
                                </a>
                                <p className="text-xs text-gray-500 mt-2">v1.0.0 • 100% Free</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* --- Persona Split Section (NEW) --- */}
                <section className="py-12 bg-white dark:bg-gray-900 relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Card 1: For Employers */}
                            <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border-2 border-transparent hover:border-blue-500/30 p-8 shadow-xl hover:shadow-2xl transition-all duration-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-sm mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-500">
                                        <Briefcase size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                                        {t.forEmployers}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6 h-12 font-medium leading-relaxed">
                                        {t.employerDesc}
                                    </p>
                                    <ul className="space-y-4 mb-8">
                                        {['Verified Profiles', 'Direct Calling', 'Negotiate Your Price'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold text-sm">
                                                <div className="p-0.5 bg-blue-500 rounded-full">
                                                    <CheckCircle size={14} className="text-white" />
                                                </div>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={onGetStarted} className="btn-ghost !p-0 font-black text-blue-600 dark:text-blue-400 hover:gap-3 transition-all flex items-center gap-2 border-none">
                                        {t.postJobNow} <ArrowRight size={20} />
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
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                                        {t.forWorkers}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6 h-12 font-medium leading-relaxed">
                                        {t.workerDesc}
                                    </p>
                                    <ul className="space-y-4 mb-8">
                                        {['Jobs Near You', 'Keep 100% Earnings', 'Build Your Reputation'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold text-sm">
                                                <div className="p-0.5 bg-emerald-500 rounded-full">
                                                    <CheckCircle size={14} className="text-white" />
                                                </div>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={onGetStarted} className="btn-ghost !p-0 font-black text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all flex items-center gap-2 border-none">
                                        {t.createProfile} <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- Trust Banner (NEW) --- */}
                <section className="bg-emerald-900 py-6 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-emerald-100">
                        <div className="flex items-center gap-4">
                            <Shield className="text-emerald-400" size={32} />
                            <div>
                                <h4 className="font-bold text-white text-lg">100% Verified Users</h4>
                                <p className="text-sm text-emerald-300">Safe & Secure Platform</p>
                            </div>
                        </div>
                        <div className="hidden md:block w-px h-12 bg-emerald-800"></div>
                        <div className="flex items-center gap-4">
                            <Star className="text-emerald-400" size={32} />
                            <div>
                                <h4 className="font-bold text-white text-lg">4.8/5 Rating</h4>
                                <p className="text-sm text-emerald-300">Trusted by 10,000+ Villagers</p>
                            </div>
                        </div>
                        <div className="hidden md:block w-px h-12 bg-emerald-800"></div>
                        <div className="flex items-center gap-4">
                            <Smartphone className="text-emerald-400" size={32} />
                            <div>
                                <h4 className="font-bold text-white text-lg">Easy to Use</h4>
                                <p className="text-sm text-emerald-300">Made for Rural India</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- Categories / Services Grid --- */}
                <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {t.popularServices}
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                {t.popularServicesDesc}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { title: 'Driver', icon: '🚗', color: 'bg-blue-100 text-blue-600' },
                                { title: 'Farm Labor', icon: '🌾', color: 'bg-green-100 text-green-600' },
                                { title: 'Construction', icon: '🏗️', color: 'bg-orange-100 text-orange-600' },
                                { title: 'Maid/Cook', icon: '🧹', color: 'bg-purple-100 text-purple-600' },
                                { title: 'Electrician', icon: '⚡', color: 'bg-yellow-100 text-yellow-600' },
                                { title: 'Plumber', icon: '🔧', color: 'bg-cyan-100 text-cyan-600' },
                                { title: 'Painter', icon: '🎨', color: 'bg-pink-100 text-pink-600' },
                            ].map((cat, i) => (
                                <button onClick={onGetStarted} key={i} className="card card-interactive p-6 text-left group">
                                    <div className={`w-14 h-14 ${cat.color} dark:bg-opacity-20 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                                        {cat.icon}
                                    </div>
                                    <h3 className="font-black text-gray-900 dark:text-white text-lg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{cat.title}</h3>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- Testimonials Grid (NEW) --- */}
                <section className="py-24 bg-white dark:bg-gray-900 overflow-hidden relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {t.successStories}
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400">
                                {t.successStoriesDesc}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                {
                                    name: "Rajesh Kumar", role: "Tractor Driver", loc: "Madhya Pradesh",
                                    text: "Before Chowkar, I had to sit at the chowk waiting for work. Now I get calls directly on my phone. My monthly income has doubled!",
                                    img: "https://images.unsplash.com/photo-1595168270381-e737c688de51?auto=format&fit=crop&q=80&w=200"
                                },
                                {
                                    name: "Suresh Patel", role: "Farm Owner", loc: "Gujarat",
                                    text: "During harvest season, finding 10 laborers was a headache. With this app, I posted a job and got 15 calls in 1 hour. Amazing!",
                                    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200"
                                },
                                {
                                    name: "Anita Devi", role: "Maid", loc: "Uttar Pradesh",
                                    text: "Safe and easy. I found 3 houses to work in near my village. The best part is I can trust the employers because they are verified.",
                                    img: "https://images.unsplash.com/photo-1629859265738-4e141a27e742?auto=format&fit=crop&q=80&w=200"
                                }
                            ].map((t, i) => (
                                <div key={i} className="p-8 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 relative">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-500">
                                            <img src={t.img} alt={t.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{t.name}</h4>
                                            <p className="text-xs text-emerale-600 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t.role}</p>
                                            <p className="text-xs text-gray-500">{t.loc}</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 italic">"{t.text}"</p>
                                    <div className="flex gap-1 mt-4 text-amber-500">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill="currentColor" />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- How It Works --- */}
                <section id="how-it-works" className="py-24 bg-emerald-50 dark:bg-emerald-900/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {t.howItWorks}
                            </h2>
                        </div>

                        <div className="relative">
                            {/* Connecting Line (Desktop) */}
                            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-emerald-100 dark:bg-emerald-900/30 -translate-y-1/2 z-0" />

                            <div className="grid md:grid-cols-4 gap-8 relative z-10">
                                {[
                                    { title: { en: 'Create Profile', hi: 'प्रोफाइल बनाएं' }, icon: <Users size={24} /> },
                                    { title: { en: 'Post/Find Job', hi: 'जॉब पोस्ट/खोजें' }, icon: <Briefcase size={24} /> },
                                    { title: { en: 'Connect', hi: 'संपर्क करें' }, icon: <Smartphone size={24} /> },
                                    { title: { en: 'Get Paid', hi: 'भुगतान प्राप्त करें' }, icon: <Calculator size={24} /> },
                                ].map((step, i) => (
                                    <div key={i} className="card p-8 text-center relative group hover:border-emerald-500/50 hover:shadow-2xl transition-all duration-500">
                                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6 text-2xl font-black group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                            {step.icon}
                                        </div>
                                        <div className="absolute top-4 right-4 text-7xl font-black text-gray-100/50 dark:text-gray-800/50 z-[-1] select-none group-hover:text-emerald-500/10 transition-colors">
                                            {i + 1}
                                        </div>
                                        <h3 className="font-black text-xl text-gray-900 dark:text-white tracking-tight">
                                            {language === 'en' ? step.title.en : step.title.hi}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center mt-12">
                            <button onClick={() => openModal('safety')} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center justify-center gap-2 mx-auto">
                                <PlayCircle size={20} /> {t.watchVideo}
                            </button>
                        </div>
                    </div>
                </section>

                {/* --- FAQ Section (NEW) --- */}
                <section className="py-24 bg-white dark:bg-gray-900">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {t.faqTitle}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {[
                                { q: "Is Chowkar completely free?", a: "Yes! Joining and creating a profile is 100% free. We do not charge commissions on your daily wages." },
                                { q: "How do I pay the worker?", a: "You pay the worker directly (Cash/UPI) after the work is done. Chowkar does not hold your money." },
                                { q: "Is it safe?", a: "We verify phone numbers and allow rating reviews. However, always follow our Safety Tips when meeting someone new." },
                                { q: "Can I find work in my village?", a: "Yes, Chowkar is designed for local connections. You will see jobs posted within your selected district radius." }
                            ].map((item, i) => (
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
            </main>
        </div>
    );
};
