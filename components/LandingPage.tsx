import React, { useState, useEffect } from 'react';
import {
    MapPin, Users, Briefcase, Star, TrendingUp, Shield,
    Languages, Loader2, ArrowRight, CheckCircle, Sparkles, Zap, Clock, MessageCircle
} from 'lucide-react';

interface LandingPageProps {
    onGetStarted: () => void;
    language: 'en' | 'hi';
    onLanguageToggle: () => void;
    isSigningIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
    onGetStarted,
    language,
    onLanguageToggle,
    isSigningIn
}) => {
    const [activeFeature, setActiveFeature] = useState(0);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-rotate features
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature(prev => (prev + 1) % 4);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const content = {
        en: {
            hero: {
                title: "Find Work.",
                subtitle: "Post Jobs.",
                tagline: "Connect Locally.",
                description: "CHOWKAR connects job seekers and employers in rural India. Find work or hire workers in your area - fast, simple, and secure.",
                cta: "Get Started Free",
                secondary: "See How It Works"
            },
            features: [
                {
                    icon: MapPin,
                    title: "Local Jobs",
                    description: "Find work opportunities near you with GPS-based matching",
                    color: "from-blue-500 to-cyan-400"
                },
                {
                    icon: Zap,
                    title: "Instant Hiring",
                    description: "Post jobs and receive bids from skilled workers in minutes",
                    color: "from-amber-500 to-orange-400"
                },
                {
                    icon: Star,
                    title: "Trusted Ratings",
                    description: "Make informed decisions with verified reviews and ratings",
                    color: "from-purple-500 to-pink-400"
                },
                {
                    icon: Shield,
                    title: "Secure Payments",
                    description: "Safe wallet system for seamless transactions",
                    color: "from-emerald-500 to-green-400"
                }
            ],
            stats: [
                { value: "10K+", label: "Active Workers", icon: Users },
                { value: "5K+", label: "Jobs Posted", icon: Briefcase },
                { value: "4.8", label: "Avg Rating", icon: Star },
                { value: "99%", label: "Success Rate", icon: TrendingUp }
            ],
            categories: [
                "Farm Labor", "Construction", "Plumbing",
                "Electrical", "Driver", "Cleaning"
            ],
            howItWorks: {
                title: "How It Works",
                subtitle: "Get started in 4 simple steps",
                steps: [
                    { title: "Sign Up", desc: "Create account with Google", icon: Users },
                    { title: "Find or Post", desc: "Browse jobs or post your requirement", icon: Briefcase },
                    { title: "Connect", desc: "Chat and negotiate with workers", icon: MessageCircle },
                    { title: "Get It Done", desc: "Complete work and leave reviews", icon: CheckCircle }
                ]
            },
            testimonial: {
                quote: "CHOWKAR helped me find consistent work in my village. The platform is easy to use and payments are secure.",
                author: "Rajesh Kumar",
                role: "Tractor Driver"
            }
        },
        hi: {
            hero: {
                title: "काम खोजें।",
                subtitle: "काम दें।",
                tagline: "जुड़ें स्थानीय रूप से।",
                description: "CHOWKAR ग्रामीण भारत में काम खोजने वालों और मालिकों को जोड़ता है। अपने क्षेत्र में काम खोजें या मजदूर रखें - तेज, आसान और सुरक्षित।",
                cta: "मुफ्त शुरू करें",
                secondary: "देखें कैसे काम करता है"
            },
            features: [
                {
                    icon: MapPin,
                    title: "स्थानीय काम",
                    description: "GPS के साथ अपने पास के काम खोजें",
                    color: "from-blue-500 to-cyan-400"
                },
                {
                    icon: Zap,
                    title: "तुरंत भर्ती",
                    description: "काम पोस्ट करें और मिनटों में बोलियाँ पाएं",
                    color: "from-amber-500 to-orange-400"
                },
                {
                    icon: Star,
                    title: "भरोसेमंद रेटिंग",
                    description: "सत्यापित रिव्यु और रेटिंग देखें",
                    color: "from-purple-500 to-pink-400"
                },
                {
                    icon: Shield,
                    title: "सुरक्षित भुगतान",
                    description: "सुरक्षित वॉलेट सिस्टम",
                    color: "from-emerald-500 to-green-400"
                }
            ],
            stats: [
                { value: "10K+", label: "काम करने वाले", icon: Users },
                { value: "5K+", label: "काम पोस्ट", icon: Briefcase },
                { value: "4.8", label: "औसत रेटिंग", icon: Star },
                { value: "99%", label: "सफलता दर", icon: TrendingUp }
            ],
            categories: [
                "खेत मजदूरी", "निर्माण", "नल फिटिंग",
                "बिजली", "ड्राइवर", "सफाई"
            ],
            howItWorks: {
                title: "कैसे काम करता है",
                subtitle: "4 आसान चरणों में शुरू करें",
                steps: [
                    { title: "साइन अप करें", desc: "Google से खाता बनाएं", icon: Users },
                    { title: "खोजें या पोस्ट करें", desc: "काम खोजें या अपनी ज़रूरत पोस्ट करें", icon: Briefcase },
                    { title: "जुड़ें", desc: "चैट करें और बात करें", icon: MessageCircle },
                    { title: "पूरा करें", desc: "काम खत्म करें और रिव्यु दें", icon: CheckCircle }
                ]
            },
            testimonial: {
                quote: "CHOWKAR ने मुझे अपने गाँव में लगातार काम ढूंढने में मदद की। प्लेटफ़ॉर्म उपयोग में आसान है और भुगतान सुरक्षित है।",
                author: "राजेश कुमार",
                role: "ट्रैक्टर चालक"
            }
        }
    };

    const t = content[language];
    const features = t.features;

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-white overflow-x-hidden transition-colors duration-300">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {/* Gradient orbs */}
                <div
                    className="absolute w-[800px] h-[800px] rounded-full opacity-30"
                    style={{
                        background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
                        top: '-200px',
                        left: '-200px',
                        transform: `translateY(${scrollY * 0.1}px)`
                    }}
                />
                <div
                    className="absolute w-[600px] h-[600px] rounded-full opacity-20"
                    style={{
                        background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
                        top: '40%',
                        right: '-100px',
                        transform: `translateY(${scrollY * -0.05}px)`
                    }}
                />
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-25"
                    style={{
                        background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
                        bottom: '-100px',
                        left: '30%',
                        transform: `translateY(${scrollY * -0.08}px)`
                    }}
                />
                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px'
                    }}
                />
            </div>

            {/* Language Toggle - Glass effect */}
            <div className="fixed top-6 right-6 z-50">
                <button
                    onClick={onLanguageToggle}
                    className="bg-white/90 dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/20 px-4 py-2.5 rounded-full text-sm font-bold text-gray-800 dark:text-white shadow-lg dark:shadow-2xl hover:bg-white dark:hover:bg-white/20 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                >
                    <Languages size={16} className="text-emerald-600 dark:text-emerald-400" />
                    {language === 'en' ? 'हिन्दी' : 'English'}
                </button>
            </div>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
                <div className="relative max-w-6xl mx-auto text-center">
                    {/* Logo with glow */}
                    <div className="mb-10">
                        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 backdrop-blur-xl border border-emerald-500/30 px-8 py-4 rounded-2xl shadow-[0_0_60px_rgba(16,185,129,0.3)]">
                            <div className="relative">
                                <MapPin size={36} className="text-emerald-400" fill="#10b981" />
                                <div className="absolute inset-0 blur-lg bg-emerald-400 opacity-50" />
                            </div>
                            <h1 className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-300 dark:to-green-400 bg-clip-text text-transparent font-serif-logo">CHOWKAR</h1>
                        </div>
                    </div>

                    {/* Hero Text with gradient */}
                    <div className="space-y-6 mb-14">
                        <h2 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tight">
                            <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-400 bg-clip-text text-transparent">{t.hero.title}</span>
                            <br />
                            <span className="text-gray-900 dark:text-white">{t.hero.subtitle}</span>
                            <br />
                            <span className="text-3xl md:text-4xl lg:text-5xl text-gray-600 dark:text-gray-400 font-semibold">{t.hero.tagline}</span>
                        </h2>

                        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
                            {t.hero.description}
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
                        <button
                            onClick={onGetStarted}
                            disabled={isSigningIn}
                            className="group relative bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white px-10 py-5 rounded-2xl text-lg font-bold shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.6)] transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 min-w-[240px] justify-center overflow-hidden"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            {isSigningIn ? (
                                <>
                                    <Loader2 className="animate-spin" size={22} />
                                    <span>Loading...</span>
                                </>
                            ) : (
                                <>
                                    <span>{t.hero.cta}</span>
                                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-emerald-300 dark:hover:border-white/30 text-gray-800 dark:text-white px-10 py-5 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                        >
                            {t.hero.secondary}
                        </button>
                    </div>

                    {/* Stats - Glass cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                        {t.stats.map((stat, idx) => {
                            const Icon = stat.icon;
                            return (
                                <div
                                    key={idx}
                                    className="group bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                >
                                    <Icon size={20} className="text-emerald-600 dark:text-emerald-400 mb-2 mx-auto opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-1">{stat.value}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-500 font-medium">{stat.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <div className="w-6 h-10 border-2 border-gray-300 dark:border-white/20 rounded-full flex justify-center pt-2">
                        <div className="w-1.5 h-3 bg-emerald-400 rounded-full animate-pulse" />
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-2.5 rounded-full mb-6">
                            <Sparkles size={18} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold text-sm uppercase tracking-wider">Features</span>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">
                            {language === 'en' ? 'Everything You Need' : 'सब कुछ जो चाहिए'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-500 text-lg max-w-xl mx-auto">
                            {language === 'en' ? 'Powerful tools to connect workers and employers' : 'कामगारों और मालिकों को जोड़ने के शक्तिशाली उपकरण'}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => {
                            const Icon = feature.icon;
                            const isActive = activeFeature === idx;
                            return (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setActiveFeature(idx)}
                                    className={`relative bg-white dark:bg-white/5 backdrop-blur-xl border rounded-2xl p-6 transition-all duration-500 cursor-pointer overflow-hidden ${isActive ? 'border-emerald-500/50 scale-105 shadow-lg dark:shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                >
                                    {/* Gradient overlay on active */}
                                    {isActive && (
                                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-10`} />
                                    )}

                                    <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center mb-5 bg-gradient-to-br ${feature.color} shadow-lg`}>
                                        <Icon size={26} className="text-white" />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 relative">{feature.title}</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm relative">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h3 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4">
                            {language === 'en' ? 'Popular Categories' : 'लोकप्रिय श्रेणियाँ'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-500 text-lg">
                            {language === 'en' ? 'Find work in various fields' : 'विभिन्न क्षेत्रों में काम खोजें'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {t.categories.map((category, idx) => (
                            <div
                                key={idx}
                                className="group bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-5 text-center hover:bg-gray-50 dark:hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 hover:scale-105 cursor-pointer"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-125 transition-transform duration-300">
                                    {['🌾', '🏗️', '🔧', '⚡', '🚗', '🧹'][idx % 6]}
                                </div>
                                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{category}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-24 px-6 relative overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 via-green-100 to-emerald-100 dark:from-emerald-900/20 dark:via-green-900/30 dark:to-emerald-900/20" />

                <div className="max-w-6xl mx-auto relative">
                    <div className="text-center mb-16">
                        <h3 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-3">{t.howItWorks.title}</h3>
                        <p className="text-emerald-600 dark:text-emerald-400/80 text-lg">{t.howItWorks.subtitle}</p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8 relative">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/50 to-emerald-500/20" />

                        {t.howItWorks.steps.map((step, idx) => {
                            const Icon = step.icon;
                            return (
                                <div key={idx} className="text-center relative">
                                    <div className="relative inline-block mb-6">
                                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] transform rotate-3 hover:rotate-0 transition-transform duration-300">
                                            <Icon size={32} className="text-white" />
                                        </div>
                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-gray-900 border-2 border-emerald-500 rounded-full flex items-center justify-center text-sm font-black text-emerald-600 dark:text-emerald-400">
                                            {idx + 1}
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">{step.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Testimonial - Dark glass */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="relative bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl p-8 md:p-12 shadow-lg dark:shadow-none">
                        {/* Quote icon */}
                        <div className="absolute -top-5 left-8">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl leading-none text-white">"</span>
                            </div>
                        </div>

                        <div className="mb-6 pt-4">
                            <div className="flex gap-1 mb-6">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star key={star} size={22} className="text-yellow-400" fill="#facc15" />
                                ))}
                            </div>
                            <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 italic font-medium leading-relaxed">
                                "{t.testimonial.quote}"
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                {t.testimonial.author[0]}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white text-lg">{t.testimonial.author}</div>
                                <div className="text-emerald-600 dark:text-emerald-400 text-sm">{t.testimonial.role}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6 relative">
                {/* Glow effect */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px]" />
                </div>

                <div className="max-w-4xl mx-auto text-center relative">
                    <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white mb-6">
                        {language === 'en' ? 'Ready to Get Started?' : 'शुरू करने के लिए तैयार?'}
                    </h3>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto">
                        {language === 'en'
                            ? 'Join thousands of workers and employers on CHOWKAR today.'
                            : 'आज ही CHOWKAR पर हजारों कामगारों और मालिकों से जुड़ें।'}
                    </p>
                    <button
                        onClick={onGetStarted}
                        disabled={isSigningIn}
                        className="group relative bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white px-14 py-6 rounded-2xl text-xl font-bold shadow-[0_0_60px_rgba(16,185,129,0.4)] hover:shadow-[0_0_80px_rgba(16,185,129,0.6)] transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3 overflow-hidden"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        {isSigningIn ? (
                            <>
                                <Loader2 className="animate-spin" size={26} />
                                <span>{language === 'en' ? 'Loading...' : 'लोड हो रहा...'}</span>
                            </>
                        ) : (
                            <>
                                <span>{t.hero.cta}</span>
                                <ArrowRight size={26} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-10 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <MapPin size={22} className="text-emerald-400" />
                        <span className="text-xl font-bold font-serif-logo bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">CHOWKAR</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {language === 'en'
                            ? '© 2024 CHOWKAR. Connecting local communities.'
                            : '© 2024 CHOWKAR. स्थानीय समुदायों को जोड़ना।'}
                    </p>
                </div>
            </footer>
        </div>
    );
};
