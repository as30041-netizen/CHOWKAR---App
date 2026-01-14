import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TRANSLATIONS } from '../constants';

type Language = 'en' | 'hi';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Helper to get initial state from localStorage
    const getInitialLanguage = (): Language => {
        if (typeof window === 'undefined') return 'en';
        try {
            const saved = localStorage.getItem('chowkar_language');
            return saved ? JSON.parse(saved) : 'en';
        } catch (e) {
            console.error('Error parsing language from localStorage', e);
            return 'en';
        }
    };

    const [language, setLanguage] = useState<Language>(getInitialLanguage);

    // Persistence Effect
    useEffect(() => {
        localStorage.setItem('chowkar_language', JSON.stringify(language));
    }, [language]);

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            t: TRANSLATIONS[language]
        }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
