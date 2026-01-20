import React from 'react';
import { MapPin, Facebook, Twitter, Instagram, Mail } from 'lucide-react';
import { Language } from '../types';

interface FooterProps {
    language: Language;
    onOpenModal: (type: 'safety' | 'guidelines' | 'terms') => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onOpenModal }) => {
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
                            {language === 'en'
                                ? 'Connecting rural India with local opportunities. Simple, fast, and secure.'
                                : 'ग्रामीण भारत को स्थानीय अवसरों से जोड़ना। सरल, तेज और सुरक्षित।'}
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
                        <h4 className="font-bold text-lg mb-6">{language === 'en' ? 'Resources' : 'संसाधन'}</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><button onClick={() => onOpenModal('safety')} className="hover:text-emerald-400 transition-colors">Safety Tips</button></li>
                            <li><button onClick={() => onOpenModal('guidelines')} className="hover:text-emerald-400 transition-colors">Community Guidelines</button></li>
                            <li><a href="#" className="hover:text-emerald-400 transition-colors">Success Stories</a></li>
                            <li><a href="#" className="hover:text-emerald-400 transition-colors">Help Center</a></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-bold text-lg mb-6">{language === 'en' ? 'Legal' : 'कानूनी'}</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><button onClick={() => onOpenModal('terms')} className="hover:text-emerald-400 transition-colors">Terms of Service</button></li>
                            <li><button onClick={() => onOpenModal('terms')} className="hover:text-emerald-400 transition-colors">Privacy Policy</button></li>
                            <li><a href="#" className="hover:text-emerald-400 transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-bold text-lg mb-6">{language === 'en' ? 'Contact' : 'संपर्क'}</h4>
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
                        {language === 'en'
                            ? `© ${new Date().getFullYear()} CHOWKAR. All rights reserved.`
                            : `© ${new Date().getFullYear()} CHOWKAR. सर्वाधिकार सुरक्षित।`}
                    </p>
                </div>
            </div>
        </footer>
    );
};
