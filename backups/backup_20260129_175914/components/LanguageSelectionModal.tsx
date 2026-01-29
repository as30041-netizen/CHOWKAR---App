
import React, { useState } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { Language } from '../types';
import { Check, X, Languages } from 'lucide-react';

interface LanguageSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({ isOpen, onClose }) => {
    const { language, setLanguage } = useUser();
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300); // Animation duration
    };

    const handleSelect = (lang: Language) => {
        setLanguage(lang);
        handleClose();
    };

    if (!isOpen) return null;

    const LANGUAGES = [
        { id: 'en', label: 'English', native: 'English', sub: 'Default' },
        { id: 'hi', label: 'Hindi', native: 'हिन्दी', sub: 'भारत' },
        { id: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', sub: 'ਪੰਜਾਬ' },
    ] as const;

    return (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div
                className={`w-full md:w-[400px] bg-white dark:bg-gray-900 rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl transform transition-transform duration-300 ${isClosing ? 'translate-y-full md:scale-95 md:opacity-0' : 'translate-y-0 animate-in slide-in-from-bottom duration-300'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Languages size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white leading-none">
                                {language === 'en' ? 'Select Language' : language === 'hi' ? 'भाषा चुनें' : 'ਭਾਸ਼ਾ ਚੁਣੋ'}
                            </h2>
                            <p className="text- text-gray-500 mt-1 font-medium text-xs">
                                {language === 'en' ? 'Choose your preferred language' : language === 'hi' ? 'अपनी पसंदीदा भाषा चुनें' : 'ਆਪਣੀ ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ ਚੁਣੋ'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {LANGUAGES.map((lang) => {
                        const isSelected = language === lang.id;
                        return (
                            <button
                                key={lang.id}
                                onClick={() => handleSelect(lang.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${isSelected
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-transparent bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                                    }`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-base">{lang.native}</span>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-primary/70' : 'text-gray-400'}`}>
                                        {lang.label} • {lang.sub}
                                    </span>
                                </div>

                                {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                                        <Check size={14} strokeWidth={4} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Note */}
                <p className="text-center text-[10px] text-gray-400 font-medium mt-6 uppercase tracking-widest">
                    {language === 'en' ? 'Changes apply instantly' : language === 'hi' ? 'परिवर्तन तुरंत लागू होते हैं' : 'ਤਬਦੀਲੀਆਂ ਤੁਰੰਤ ਲਾਗੂ ਹੁੰਦੀਆਂ ਹਨ'}
                </p>
            </div>
        </div>
    );
};
