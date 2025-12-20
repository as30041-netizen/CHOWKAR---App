import React, { useState, useEffect } from 'react';
import {
    Users, Briefcase, Calculator, Star, Shield,
    ArrowRight, Menu, X, CheckCircle, Smartphone,
    MapPin, Globe, ChevronDown, ChevronUp, PlayCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from './SEO';
import { Footer } from './Footer';
import { SafetyTipsModal, CommunityGuidelinesModal, TermsModal } from './InfoModals';
import { useUser } from '../contexts/UserContextDB';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { language, setLanguage, user } = useUser();
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

            {/* --- Navigation --- */}
            <nav className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 border-b border-gray-100 dark:border-gray-800 transition-colors">
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
                                {language === 'en' ? 'How it Works' : 'यह कैसे काम करता है'}
                            </button>

                            {/* Language Toggle */}
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                                <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{language === 'en' ? 'हिंदी' : 'English'}</span>
                            </button>

                            <Link to="/login" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0">
                                {language === 'en' ? 'Login / Join' : 'लॉगिन / शामिल हों'}
                            </Link>
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
                    <div className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-dark-800 p-4 space-y-4 shadow-xl animate-slide-down z-30">
                        <Link to="/login" className="block w-full text-center py-3 bg-emerald-600 text-white rounded-xl font-bold">
                            {language === 'en' ? 'Login / Join' : 'लॉगिन / शामिल हों'}
                        </Link>
                        <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} className="w-full py-3 flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300">
                            <Globe size={18} /> {language === 'en' ? 'Switch to Hindi' : 'अंग्रेजी में बदलें'}
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
                            {language === 'en' ? (
                                <>Find Work. <span className="text-emerald-600 dark:text-emerald-400">Hire Locally.</span><br />Zero Commission.</>
                            ) : (
                                <>काम खोजें। <span className="text-emerald-600 dark:text-emerald-400">स्थानीय लोगों को रखें।</span><br />शून्य कमीशन।</>
                            )}
                        </h1>

                        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
                            {language === 'en'
                                ? "Connect directly with trusted workers and employers in your village or town. No middlemen, no hidden fees."
                                : "अपने गांव या शहर में भरोसेमंद कामगारों और नियोक्ताओं से सीधे जुड़ें। कोई बिचौलिया नहीं, कोई छिपी हुई फीस नहीं।"}
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                            <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center gap-2">
                                <Briefcase size={24} />
                                {language === 'en' ? 'Post a Job' : 'काम पोस्ट करें'}
                            </Link>
                            <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl font-bold text-lg transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
                                <Users size={24} className="text-emerald-600" />
                                {language === 'en' ? 'Find Work' : 'काम खोजें'}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* --- Persona Split Section (NEW) --- */}
                <section className="py-12 bg-white dark:bg-gray-900 relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Card 1: For Employers */}
                            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border border-blue-100 dark:border-gray-700 p-8 hover:shadow-2xl transition-all duration-300">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all" />
                                <div className="relative z-10">
                                    <div className="w-14 h-14 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-sm mb-6 text-blue-600 dark:text-blue-400">
                                        <Briefcase size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                                        {language === 'en' ? 'For Employers' : 'नियोक्ताओं के लिए'}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 mb-6 h-12">
                                        {language === 'en'
                                            ? 'Hire skilled drivers, farm laborers, maids, and construction workers instantly.'
                                            : 'ड्राइवर, खेत मजदूर, नौकरानी और निर्माण श्रमिकों को तुरंत किराए पर लें।'}
                                    </p>
                                    <ul className="space-y-3 mb-8">
                                        {['Verified Profiles', 'Direct Calling', 'Negotiate Your Price'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                                                <CheckCircle size={18} className="text-blue-500" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Link to="/login" className="inline-flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400 hover:gap-3 transition-all">
                                        {language === 'en' ? 'Post a Job Now' : 'अभी जॉब पोस्ट करें'} <ArrowRight size={20} />
                                    </Link>
                                </div>
                            </div>

                            {/* Card 2: For Workers */}
                            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-gray-800 dark:to-gray-800 border border-emerald-100 dark:border-gray-700 p-8 hover:shadow-2xl transition-all duration-300">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />
                                <div className="relative z-10">
                                    <div className="w-14 h-14 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-sm mb-6 text-emerald-600 dark:text-emerald-400">
                                        <Users size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                                        {language === 'en' ? 'For Workers' : 'कामगारों के लिए'}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 mb-6 h-12">
                                        {language === 'en'
                                            ? 'Find daily wage jobs near you. Get paid directly by the employer. No commission.'
                                            : 'अपने पास रोज़गार खोजें। नियोक्ता द्वारा सीधे भुगतान प्राप्त करें। कोई कमीशन नहीं।'}
                                    </p>
                                    <ul className="space-y-3 mb-8">
                                        {['Jobs Near You', 'Keep 100% Earnings', 'Build Your Reputation'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                                                <CheckCircle size={18} className="text-emerald-500" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Link to="/login" className="inline-flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all">
                                        {language === 'en' ? 'Create Worker Profile' : 'प्रोफाइल बनाएं'} <ArrowRight size={20} />
                                    </Link>
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
                                {language === 'en' ? 'Popular Services' : 'लोकप्रिय सेवाएं'}
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                {language === 'en' ? 'Find help for any task, anytime.' : 'किसी भी कार्य के लिए मदद पाएं, कभी भी।'}
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
                                { title: 'Other', icon: '🔨', color: 'bg-gray-100 text-gray-600' },
                            ].map((cat, i) => (
                                <Link to="/login" key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100 dark:border-gray-700 group">
                                    <div className={`w-12 h-12 ${cat.color} dark:bg-opacity-20 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                                        {cat.icon}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{cat.title}</h3>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- Testimonials Grid (NEW) --- */}
                <section className="py-24 bg-white dark:bg-gray-900 overflow-hidden relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                {language === 'en' ? 'Success Stories' : 'सफलता की कहानियां'}
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400">
                                {language === 'en' ? 'Real people, real earnings.' : 'असली लोग, असली कमाई।'}
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
                                {language === 'en' ? 'How It Works' : 'यह कैसे काम करता है'}
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
                                    <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border-2 border-emerald-50 dark:border-gray-700 text-center relative group">
                                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6 text-2xl font-bold group-hover:scale-110 transition-transform">
                                            {step.icon}
                                        </div>
                                        <div className="absolute top-4 right-4 text-6xl font-black text-gray-100 dark:text-gray-700 opacity-50 z-[-1] select-none">
                                            {i + 1}
                                        </div>
                                        <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                                            {language === 'en' ? step.title.en : step.title.hi}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center mt-12">
                            <button onClick={() => openModal('safety')} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center justify-center gap-2 mx-auto">
                                <PlayCircle size={20} /> Watch Video Guide
                            </button>
                        </div>
                    </div>
                </section>

                {/* --- FAQ Section (NEW) --- */}
                <section className="py-24 bg-white dark:bg-gray-900">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
                                Frequently Asked Questions
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {[
                                { q: "Is Chowkar completely free?", a: "Yes! Joining and creating a profile is 100% free. We do not charge commissions on your daily wages." },
                                { q: "How do I pay the worker?", a: "You pay the worker directly (Cash/UPI) after the work is done. Chowkar does not hold your money." },
                                { q: "Is it safe?", a: "We verify phone numbers and allow rating reviews. However, always follow our Safety Tips when meeting someone new." },
                                { q: "Can I find work in my village?", a: "Yes, Chowkar is designed for local connections. You will see jobs posted within your selected district radius." }
                            ].map((item, i) => (
                                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => toggleFaq(i)}
                                        className="w-full p-6 text-left flex justify-between items-center bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                                    >
                                        <span className="font-bold text-gray-900 dark:text-white">{item.q}</span>
                                        {activeFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                    {activeFaq === i && (
                                        <div className="p-6 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800">
                                            {item.a}
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
