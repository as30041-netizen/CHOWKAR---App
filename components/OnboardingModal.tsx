import React from 'react';
import { UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { Briefcase, Search, Languages } from 'lucide-react';

interface OnboardingModalProps {
    isOpen: boolean;
    onComplete: (role: UserRole) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
    const { language, setLanguage } = useUser();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative border-4 border-white/50 bg-clip-padding">

                {/* Language Toggle */}
                <button
                    onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
                    className="absolute top-4 right-4 p-2 text-emerald-800 text-xs font-bold border border-emerald-100 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 transition-colors z-10"
                >
                    <Languages size={16} /> {language === 'en' ? 'हि' : 'En'}
                </button>

                <div className="mb-6">
                    <h2 className="text-3xl font-bold text-emerald-950 mb-2">
                        {language === 'en' ? 'Welcome to CHOWKAR!' : 'CHOWKAR में स्वागत है!'}
                    </h2>
                    <p className="text-gray-500 font-medium">
                        {language === 'en' ? 'How would you like to use the app?' : 'आप ऐप का उपयोग कैसे करना चाहेंगे?'}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={() => onComplete(UserRole.POSTER)}
                        className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left shadow-sm hover:shadow-md bg-white"
                    >
                        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Briefcase size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-emerald-950 group-hover:text-emerald-700">
                                {language === 'en' ? 'I want to Hire' : 'मुझे काम देना है (Hire)'}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {language === 'en' ? 'Post jobs & find workers' : 'जॉब पोस्ट करें और वर्कर ढूँढें'}
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={() => onComplete(UserRole.WORKER)}
                        className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left shadow-sm hover:shadow-md bg-white"
                    >
                        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Search size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-emerald-950 group-hover:text-blue-700">
                                {language === 'en' ? 'I want to Work' : 'मुझे काम चाहिए (Work)'}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {language === 'en' ? 'Find jobs & earn money' : 'जॉब ढूँढें और पैसे कमाएं'}
                            </p>
                        </div>
                    </button>
                </div>

                <p className="mt-6 text-xs text-gray-400">
                    {language === 'en'
                        ? 'You can switch anytime from the top menu.'
                        : 'आप ऊपर दिए गए मेनू से कभी भी बदल सकते हैं।'}
                </p>
            </div>
        </div>
    );
};
