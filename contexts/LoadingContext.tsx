import React, { createContext, useContext, useState, useCallback } from 'react';
import { LoadingOverlay } from '../components/LoadingOverlay';

interface LoadingContextType {
    showLoading: (message?: string) => void;
    hideLoading: () => void;
    isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('Loading...');

    const showLoading = useCallback((msg?: string) => {
        setMessage(msg || 'Loading...');
        setIsLoading(true);
    }, []);

    const hideLoading = useCallback(() => {
        setIsLoading(false);
    }, []);

    return (
        <LoadingContext.Provider value={{ showLoading, hideLoading, isLoading }}>
            {children}
            <LoadingOverlay isVisible={isLoading} message={message} />
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};
