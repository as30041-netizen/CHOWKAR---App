import React from 'react';
import { UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { Briefcase, Search, Languages, ChevronRight, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
    isOpen: boolean;
    onComplete: (role: UserRole) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
    const { language, setLanguage } = useUser();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-2xl animate-fade-in" />

            <div className="bg-white dark:bg-gray-950 w-full max-w-lg rounded-[3.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative z-20 animate-pop border-8 border-white dark:border-gray-900 transition-all">

                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

                <div className="p-10 text-center relative">
                    {/* Language Switcher */}
                    <button
                        onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
                        className="absolute top-8 right-8 px-5 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all flex items-center gap-3 active:scale-95 shadow-sm"
                    >
                        <Languages size={14} className="text-emerald-500" /> {language === 'en' ? 'हिंदी' : 'English'}
                    </button>

                    <div className="mt-8 mb-12">
                        <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/20 animate-bounce-slow">
                            <Sparkles size={32} className="text-white" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-4">
                            {language === 'en' ? 'Welcome to CHOWKAR' : 'चौकड़ में आपका स्वागत है'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg leading-tight uppercase tracking-widest text-[10px] opacity-70">
                            {language === 'en' ? 'Choose how you want to start' : 'चुनें कि आप कैसे शुरू करना चाहते हैं'}
                        </p>
                    </div>

                    <div className="grid gap-4">
                        <button
                            onClick={() => onComplete(UserRole.POSTER)}
                            className="group relative flex items-center gap-6 p-8 rounded-[2.5rem] bg-gray-50 dark:bg-gray-900 border-4 border-transparent hover:border-emerald-500 hover:bg-white dark:hover:bg-gray-800 transition-all text-left shadow-sm hover:shadow-2xl active:scale-[0.98]"
                        >
                            <div className="w-18 h-18 rounded-[1.5rem] bg-white dark:bg-gray-800 shadow-glass flex items-center justify-center text-emerald-600 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                                <Briefcase size={32} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-2xl text-gray-900 dark:text-white leading-none mb-2 tracking-tight">
                                    {language === 'en' ? 'I want to Hire' : 'मुझे काम देना है'}
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                                    {language === 'en' ? 'Post jobs & find local workers' : 'जॉब पोस्ट करें और वर्कर ढूँढें'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all shadow-lg">
                                <ChevronRight size={24} strokeWidth={3} />
                            </div>
                        </button>

                        <button
                            onClick={() => onComplete(UserRole.WORKER)}
                            className="group relative flex items-center gap-6 p-8 rounded-[2.5rem] bg-gray-50 dark:bg-gray-900 border-4 border-transparent hover:border-blue-500 hover:bg-white dark:hover:bg-gray-800 transition-all text-left shadow-sm hover:shadow-2xl active:scale-[0.98]"
                        >
                            <div className="w-18 h-18 rounded-[1.5rem] bg-white dark:bg-gray-800 shadow-glass flex items-center justify-center text-blue-600 transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110">
                                <Search size={32} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-2xl text-gray-900 dark:text-white leading-none mb-2 tracking-tight">
                                    {language === 'en' ? 'I want to Work' : 'मुझे काम चाहिए'}
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                                    {language === 'en' ? 'Find local jobs & earn money' : 'जॉब ढूँढें और पैसे कमाएं'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all shadow-lg">
                                <ChevronRight size={24} strokeWidth={3} />
                            </div>
                        </button>
                    </div>

                    <div className="mt-12 pt-8 border-t-2 border-gray-100 dark:border-gray-900">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            {language === 'en'
                                ? 'Switch roles anytime in profile'
                                : 'प्रोफाइल में कभी भी भूमिका बदलें'}
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
