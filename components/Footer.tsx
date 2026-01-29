import React from 'react';
import { MapPin, Facebook, Twitter, Instagram, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Language } from '../types';

interface FooterProps {
    language: Language;
    onOpenModal: (type: 'safety' | 'guidelines' | 'terms') => void;
}

const FOOTER_CONTENT = {
    en: {
        tagline: "Connecting rural India with local opportunities. Simple, fast and secure.",
        headings: {
            resources: "Resources",
            legal: "Legal",
            contact: "Contact"
        },
        links: {
            safety: "Safety Tips",
            guidelines: "Community Guidelines",
            stories: "Success Stories",
            help: "Help Center",
            terms: "Terms of Service",
            privacy: "Privacy Policy",
            cookies: "Cookie Policy"
        },
        copyright: "© 2026 CHOWKAR. All rights reserved."
    },
    hi: {
        tagline: "ग्रामीण भारत को स्थानीय अवसरों से जोड़ना। सरल, तेज और सुरक्षित।",
        headings: {
            resources: "संसाधन",
            legal: "कानूनी",
            contact: "संपर्क"
        },
        links: {
            safety: "सुरक्षा युक्तियाँ",
            guidelines: "समुदाय दिशानिर्देश",
            stories: "सफलता की कहानियां",
            help: "सहायता केंद्र",
            terms: "सेवा की शर्तें",
            privacy: "गोपनीयता नीति",
            cookies: "कुकी नीति"
        },
        copyright: "© 2026 CHOWKAR. सर्वाधिकार सुरक्षित।"
    },
    pa: {
        tagline: "ਪੇਂਡੂ ਭਾਰਤ ਨੂੰ ਸਥਾਨਕ ਮੌਕਿਆਂ ਨਾਲ ਜੋੜਨਾ। ਸਰਲ, ਤੇਜ਼ ਅਤੇ ਸੁਰੱਖਿਅਤ।",
        headings: {
            resources: "ਸਰੋਤ",
            legal: "ਕਾਨੂੰਨੀ",
            contact: "ਸੰਪਰਕ"
        },
        links: {
            safety: "ਸੁਰੱਖਿਆ ਸੁਝਾਅ",
            guidelines: "ਭਾਈਚਾਰਾ ਦਿਸ਼ਾ-ਨਿਰਦੇਸ਼",
            stories: "ਸਫਲਤਾ ਦੀਆਂ ਕਹਾਣੀਆਂ",
            help: "ਮਦਦ ਕੇਂਦਰ",
            terms: "ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ",
            privacy: "ਪਰਦੇਦਾਰੀ ਨੀਤੀ",
            cookies: "ਕੁਕੀ ਨੀਤੀ"
        },
        copyright: "© 2026 CHOWKAR. ਸਾਰੇ ਅਧਿਕਾਰ ਸੁਰੱਖਿਅਤ।"
    }
};

export const Footer: React.FC<FooterProps> = ({ language, onOpenModal }) => {
    const content = FOOTER_CONTENT[language] || FOOTER_CONTENT['hi'];

    return (
        <footer className="bg-gray-900 text-white pt-16 pb-8 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <MapPin size={24} className="text-emerald-400" fill="#10b981" />
                            <span className="text-2xl font-bold font-serif-logo bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">CHOWKAR</span>
                        </div>
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            {content.tagline}
                        </p>
                        <div className="flex gap-4">
                            {[Facebook, Twitter, Instagram].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all duration-300">
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="font-bold text-lg mb-6">{content.headings.resources}</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><button onClick={() => onOpenModal('safety')} className="hover:text-emerald-400 transition-colors">{content.links.safety}</button></li>
                            <li><button onClick={() => onOpenModal('guidelines')} className="hover:text-emerald-400 transition-colors">{content.links.guidelines}</button></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-bold text-lg mb-6">{content.headings.legal}</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><button onClick={() => onOpenModal('terms')} className="hover:text-emerald-400 transition-colors">{content.links.terms}</button></li>
                            <li><Link to="/privacy" className="hover:text-emerald-400 transition-colors">{content.links.privacy}</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-bold text-lg mb-6">{content.headings.contact}</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li className="flex items-start gap-3">
                                <Mail size={18} className="text-emerald-400 mt-1" />
                                <span>support@chowkar.in</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <MapPin size={18} className="text-emerald-400 mt-1" />
                                <span>123 Village Tech Hub,<br />Madhya Pradesh, India</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
                    <p>
                        {content.copyright}
                    </p>
                </div>
            </div>
        </footer>
    );
};
