import React, { useState } from 'react';
import {
    MapPin, Users, Briefcase, Star, TrendingUp, Shield,
    Languages, Loader2, ArrowRight, CheckCircle, Sparkles
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

    const content = {
        en: {
            hero: {
                title: "Find Work.",
                subtitle: "Post Jobs.",
                tagline: "Connect Locally.",
                description: "CHOWKAR connects job seekers and employers in rural India. Find work or hire workers in your area - fast, simple, and secure.",
                cta: "Get Started",
                secondary: "Learn More"
            },
            features: [
                {
                    icon: MapPin,
                    title: "Local Jobs",
                    description: "Find work opportunities near you with GPS-based matching"
                },
                {
                    icon: Briefcase,
                    title: "Quick Hiring",
                    description: "Post jobs and receive bids from skilled workers instantly"
                },
                {
                    icon: Star,
                    title: "Trusted Ratings",
                    description: "Make informed decisions with verified reviews and ratings"
                },
                {
                    icon: Shield,
                    title: "Secure Payments",
                    description: "Safe wallet system for seamless transactions"
                }
            ],
            stats: [
                { value: "10K+", label: "Active Workers" },
                { value: "5K+", label: "Jobs Posted" },
                { value: "4.8", label: "Avg Rating" },
                { value: "99%", label: "Success Rate" }
            ],
            categories: [
                "Farm Labor", "Construction", "Plumbing",
                "Electrical", "Driver", "Cleaning"
            ],
            howItWorks: {
                title: "How It Works",
                steps: [
                    { title: "Sign Up", desc: "Create account with Google" },
                    { title: "Find or Post", desc: "Browse jobs or post your requirement" },
                    { title: "Connect", desc: "Chat and negotiate with workers" },
                    { title: "Get It Done", desc: "Complete work and leave reviews" }
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
                cta: "शुरू करें",
                secondary: "और जानें"
            },
            features: [
                {
                    icon: MapPin,
                    title: "स्थानीय काम",
                    description: "GPS के साथ अपने पास के काम खोजें"
                },
                {
                    icon: Briefcase,
                    title: "तेज़ भर्ती",
                    description: "काम पोस्ट करें और तुरंत बोलियाँ पाएं"
                },
                {
                    icon: Star,
                    title: "भरोसेमंद रेटिंग",
                    description: "सत्यापित रिव्यु और रेटिंग देखें"
                },
                {
                    icon: Shield,
                    title: "सुरक्षित भुगतान",
                    description: "सुरक्षित वॉलेट सिस्टम"
                }
            ],
            stats: [
                { value: "10K+", label: "काम करने वाले" },
                { value: "5K+", label: "काम पोस्ट" },
                { value: "4.8", label: "औसत रेटिंग" },
                { value: "99%", label: "सफलता दर" }
            ],
            categories: [
                "खेत मजदूरी", "निर्माण", "नल फिटिंग",
                "बिजली", "ड्राइवर", "सफाई"
            ],
            howItWorks: {
                title: "कैसे काम करता है",
                steps: [
                    { title: "साइन अप करें", desc: "Google से खाता बनाएं" },
                    { title: "खोजें या पोस्ट करें", desc: "काम खोजें या अपनी ज़रूरत पोस्ट करें" },
                    { title: "जुड़ें", desc: "चैट करें और बात करें" },
                    { title: "पूरा करें", desc: "काम खत्म करें और रिव्यु दें" }
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
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 overflow-y-auto">
            {/* Language Toggle */}
            <div className="fixed top-6 right-6 z-50">
                <button
                    onClick={onLanguageToggle}
                    className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold text-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                >
                    <Languages size={16} />
                    {language === 'en' ? 'हिन्दी' : 'English'}
                </button>
            </div>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-300/20 rounded-full blur-3xl animate-pulse-slow"></div>
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                </div>

                <div className="relative max-w-6xl mx-auto text-center">
                    {/* Logo */}
                    <div className="mb-8 animate-fade-in">
                        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-xl">
                            <MapPin size={32} className="text-emerald-600" fill="#10b981" />
                            <h1 className="text-3xl font-black text-emerald-950 font-serif-logo">CHOWKAR</h1>
                        </div>
                    </div>

                    {/* Hero Text */}
                    <div className="space-y-6 mb-12 animate-slide-up">
                        <h2 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight">
                            <span className="text-emerald-600">{t.hero.title}</span>
                            <br />
                            <span className="text-gray-800">{t.hero.subtitle}</span>
                            <br />
                            <span className="text-emerald-700 text-4xl md:text-5xl">{t.hero.tagline}</span>
                        </h2>

                        <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto font-medium">
                            {t.hero.description}
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-pop">
                        <button
                            onClick={onGetStarted}
                            disabled={isSigningIn}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 min-w-[200px] justify-center"
                        >
                            {isSigningIn ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Loading...</span>
                                </>
                            ) : (
                                <>
                                    <span>{t.hero.cta}</span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-white/90 backdrop-blur-sm hover:bg-white text-emerald-700 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                        >
                            {t.hero.secondary}
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        {t.stats.map((stat, idx) => (
                            <div key={idx} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                                <div className="text-3xl md:text-4xl font-black text-emerald-600 mb-2">{stat.value}</div>
                                <div className="text-sm md:text-base font-semibold text-gray-700">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-6 bg-white/50 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-emerald-100 px-4 py-2 rounded-full mb-4">
                            <Sparkles size={20} className="text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Features</span>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
                            {language === 'en' ? 'Everything You Need' : 'सब कुछ जो चाहिए'}
                        </h3>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setActiveFeature(idx)}
                                    className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer ${activeFeature === idx ? 'scale-105 ring-2 ring-emerald-500' : ''
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${activeFeature === idx ? 'bg-emerald-600' : 'bg-emerald-100'
                                        } transition-colors duration-300`}>
                                        <Icon size={28} className={activeFeature === idx ? 'text-white' : 'text-emerald-600'} />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h4>
                                    <p className="text-gray-600">{feature.description}</p>
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
                        <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
                            {language === 'en' ? 'Popular Categories' : 'लोकप्रिय श्रेणियाँ'}
                        </h3>
                        <p className="text-xl text-gray-600">
                            {language === 'en' ? 'Find work in various fields' : 'विभिन्न क्षेत्रों में काम खोजें'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {t.categories.map((category, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-xl p-4 text-center shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group"
                            >
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                                    {['🌾', '🏗️', '🔧', '⚡', '🚗', '🧹'][idx % 6]}
                                </div>
                                <div className="text-sm font-bold text-gray-800">{category}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-6 bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h3 className="text-4xl md:text-5xl font-black mb-4">{t.howItWorks.title}</h3>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {t.howItWorks.steps.map((step, idx) => (
                            <div key={idx} className="text-center">
                                <div className="w-16 h-16 bg-white text-emerald-600 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-4 shadow-xl">
                                    {idx + 1}
                                </div>
                                <h4 className="text-xl font-bold mb-2">{step.title}</h4>
                                <p className="text-emerald-100">{step.desc}</p>
                                {idx < 3 && (
                                    <ArrowRight className="mx-auto mt-4 hidden md:block" size={24} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonial */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl relative">
                        <div className="absolute -top-6 left-8">
                            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                                <Star size={24} className="text-white" fill="white" />
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="flex gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star key={star} size={20} className="text-yellow-400" fill="#facc15" />
                                ))}
                            </div>
                            <p className="text-xl md:text-2xl text-gray-700 italic font-medium">
                                "{t.testimonial.quote}"
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                {t.testimonial.author[0]}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900">{t.testimonial.author}</div>
                                <div className="text-gray-600 text-sm">{t.testimonial.role}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-6 bg-gradient-to-br from-emerald-50 to-green-100">
                <div className="max-w-4xl mx-auto text-center">
                    <h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
                        {language === 'en' ? 'Ready to Get Started?' : 'शुरू करने के लिए तैयार?'}
                    </h3>
                    <p className="text-xl text-gray-700 mb-8">
                        {language === 'en'
                            ? 'Join thousands of workers and employers on CHOWKAR today.'
                            : 'आज ही CHOWKAR पर हजारों कामगारों और मालिकों से जुड़ें।'}
                    </p>
                    <button
                        onClick={onGetStarted}
                        disabled={isSigningIn}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-5 rounded-2xl text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
                    >
                        {isSigningIn ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                <span>{language === 'en' ? 'Loading...' : 'लोड हो रहा...'}</span>
                            </>
                        ) : (
                            <>
                                <span>{t.hero.cta}</span>
                                <ArrowRight size={24} />
                            </>
                        )}
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <MapPin size={20} className="text-emerald-400" />
                        <span className="text-lg font-bold font-serif-logo">CHOWKAR</span>
                    </div>
                    <p className="text-gray-400 text-sm">
                        {language === 'en'
                            ? '© 2024 CHOWKAR. Connecting local communities.'
                            : '© 2024 CHOWKAR. स्थानीय समुदायों को जोड़ना।'}
                    </p>
                </div>
            </footer>
        </div>
    );
};
