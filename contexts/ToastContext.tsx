import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type AlertType = 'success' | 'error' | 'info';

interface Alert {
    message: string;
    type: AlertType;
}

interface ToastContextType {
    currentAlert: Alert | null;
    showAlert: (message: string, type?: AlertType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);

    const showAlert = useCallback((message: string, type: AlertType = 'info') => {
        setCurrentAlert({ message, type });
        setTimeout(() => setCurrentAlert(null), 3000);
    }, []);

    return (
        <ToastContext.Provider value={{
            currentAlert,
            showAlert
        }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
