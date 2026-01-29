import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Role = 'poster' | 'worker';

interface ThemeContextType {
    theme: Theme;
    role: Role;
    toggleTheme: () => void;
    setRole: (role: Role) => void;
    isDark: boolean;
    isWorker: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check local storage - if not set, default to light
        if (localStorage.getItem('theme')) {
            return localStorage.getItem('theme') as Theme;
        }
        return 'light';
    });

    const [role, setRoleState] = useState<Role>(() => {
        return (localStorage.getItem('role') as Role) || 'poster';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Update Role Attribute on Root for CSS Selectors
        if (role === 'worker') {
            root.setAttribute('data-theme', 'worker');
        } else {
            root.removeAttribute('data-theme');
        }

        localStorage.setItem('theme', theme);
        localStorage.setItem('role', role);
    }, [theme, role]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setRole = (newRole: Role) => {
        setRoleState(newRole);
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            role,
            toggleTheme,
            setRole,
            isDark: theme === 'dark',
            isWorker: role === 'worker'
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
