import React, { useState } from 'react';
import { Briefcase, Users, Globe, MapPin, CheckCircle, Smartphone } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface MobileWelcomeProps {
    onGetStarted: () => void;
    isSigningIn: boolean;
    language: 'en' | 'hi' | 'pa';
    onLanguageToggle: () => void;
}

export const MobileWelcome: React.FC<MobileWelcomeProps> = ({ onGetStarted, isSigningIn, language, onLanguageToggle }) => {
    const { t } = useUser();
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: language === 'en' ? 'Find Local Work' : language === 'hi' ? 'स्थानीय काम खोजें' : 'ਨੇੜਲੇ ਕੰਮ ਲੱਭੋ',
            subtitle: language === 'en' ? 'Connect with employers near you instantly.' : language === 'hi' ? 'अपने आस-पास के नियोक्ताओं से तुरंत जुड़ें।' : 'ਆਪਣੇ ਨੇੜਲੇ ਮਾਲਕਾਂ ਨਾਲ ਤੁਰੰਤ ਜੁੜੋ।',
            icon: <Briefcase size={48} className="text-emerald-500" />,
            color: "bg-emerald-50 dark:bg-emerald-900/20"
        },
        {
            title: language === 'en' ? 'Hire Trusted Help' : language === 'hi' ? 'भरोसेमंद कामगारों को रखें' : 'ਭਰੋਸੇਮੰਦ ਮਦਦ ਰੱਖੋ',
            subtitle: language === 'en' ? 'Verified profiles for peace of mind.' : language === 'hi' ? 'मन की शांति के लिए सत्यापित प्रोफाइल।' : 'ਮਨ ਦੀ ਸ਼ਾਂਤੀ ਲਈ ਤਸਦੀਕਸ਼ੁਦਾ ਪ੍ਰੋਫਾਈਲ।',
            icon: <Users size={48} className="text-blue-500" />,
            color: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            title: language === 'en' ? '100% Free' : language === 'hi' ? '100% मुफ़्त' : '100% ਮੁਫ਼ਤ',
            subtitle: language === 'en' ? 'No commissions. Keep what you earn.' : language === 'hi' ? 'कोई कमीशन नहीं। आप जो कमाते हैं वह आपका है।' : 'ਕੋਈ ਕਮਿਸ਼ਨ ਨਹੀਂ। ਆਪਣੀ ਕਮਾਈ ਆਪਣੇ ਕੋਲ ਰੱਖੋ।',
            icon: <CheckCircle size={48} className="text-amber-500" />,
            color: "bg-amber-50 dark:bg-amber-900/20"
        }
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col pt-safe pb-safe overflow-hidden relative">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-emerald-400/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-20%] w-[70vw] h-[70vw] bg-blue-400/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Header: Logo & Language */}
            <div className="px-6 py-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <MapPin size={24} fill="currentColor" />
                    </div>
                    <span className="text-2xl font-bold font-serif-logo text-text-primary">
                        CHOWKAR
                    </span>
                </div>
                <button
                    onClick={onLanguageToggle}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border shadow-sm active:scale-95 transition-all"
                >
                    <Globe size={16} className="text-primary" />
                    <span className="text-sm font-bold text-text-primary">
                        {language === 'en' ? 'हिन्दी' : language === 'hi' ? 'ਪੰਜਾਬੀ' : 'English'}
                    </span>
                </button>
            </div>

            {/* Content: Carousel/Steps */}
            <div className="flex-1 flex flex-col justify-center px-6 relative z-10">
                <div className="mb-8 flex justify-center">
                    <div className={`w-32 h-32 rounded-[2rem] flex items-center justify-center shadow-2xl ${steps[step].color} transition-colors duration-500`}>
                        {steps[step].icon}
                    </div>
                </div>

                <div className="text-center space-y-4 mb-8 min-h-[140px]">
                    <h1 className="text-4xl font-black text-text-primary tracking-tight leading-tight animate-fade-in-up">
                        {steps[step].title}
                    </h1>
                    <p className="text-lg text-text-secondary font-medium animate-fade-in-up delay-100 px-4">
                        {steps[step].subtitle}
                    </p>
                </div>

                {/* Dots Indicator */}
                <div className="flex justify-center gap-2 mb-10">
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-black dark:bg-white' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Bottom: Actions */}
            <div className="px-6 pb-8 space-y-4 z-10">
                <button
                    onClick={onGetStarted}
                    disabled={isSigningIn}
                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    {isSigningIn ? (
                        <>
                            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {language === 'en' ? 'Signing in...' : language === 'hi' ? 'साइन इन हो रहा है...' : 'ਸਾਈਨ ਇਨ ਹੋ ਰਿਹਾ ਹੈ...'}
                        </>
                    ) : (
                        <>
                            <Smartphone size={24} />
                            {language === 'en' ? 'Continue with Google' : language === 'hi' ? 'Google के साथ जारी रखें' : 'Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ'}
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-text-muted font-medium w-3/4 mx-auto leading-relaxed">
                    {language === 'en'
                        ? 'By continuing, you agree to our Terms of Service & Privacy Policy.'
                        : language === 'hi'
                            ? 'जारी रखकर, आप हमारी सेवा की शर्तों और गोपनीयता नीति से सहमत होते हैं।'
                            : 'ਜਾਰੀ ਰੱਖ ਕੇ, ਤੁਸੀਂ ਸਾਡੀਆਂ ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ ਅਤੇ ਗੋਪਨੀਯਤਾ ਨੀਤੀ ਨਾਲ ਸਹਿਮਤ ਹੁੰਦੇ ਹੋ।'}
                </p>
            </div>
        </div>
    );
};
