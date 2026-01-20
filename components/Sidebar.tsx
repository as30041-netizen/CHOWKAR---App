import React, { useRef, useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useNavigate } from 'react-router-dom';
import {
    X, Languages, LogOut, ChevronRight, Zap, Briefcase, Moon, Sun, MapPin
} from 'lucide-react';
import { UserRole } from '../types';
import { useTheme } from '../contexts/ThemeContext';

import { CATEGORY_CONFIG } from '../constants';
import { LanguageSelectionModal } from './LanguageSelectionModal';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onLogout }) => {
    const { user, role, setRole, language } = useUser();
    const { toggleTheme, isDark } = useTheme();
    const navigate = useNavigate();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [showLangModal, setShowLangModal] = useState(false);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isOpen) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div
                ref={sidebarRef}
                className={`fixed top-0 left-0 h-full w-[80%] max-w-[300px] bg-surface shadow-elevation z-[101] transform transition-transform duration-300 ease-out border-r border-border ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* BRAND HEADER */}
                    <div className="px-6 pt-8 pb-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
                            <MapPin size={22} fill="currentColor" />
                        </div>
                        <span className="text-2xl font-bold font-serif-logo text-emerald-950 dark:text-emerald-50 tracking-tight">
                            CHOWKAR
                        </span>
                    </div>

                    {/* Header: Profile */}
                    <div className="p-6 bg-surface border-b border-border">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-16 h-16 rounded-full p-0.5 ring-2 ring-border">
                                <img
                                    src={user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                                    alt="Profile"
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors text-text-secondary">
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-text-primary truncate">{user.name}</h2>
                        <p className="text-text-secondary text-sm font-medium">{user.phone}</p>
                    </div>

                    {/* Role Switcher - Prominent */}
                    <div className="p-4 border-b border-border">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 block">
                            {language === 'en' ? 'Current Mode' : 'वर्तमान मोड'}
                        </label>
                        <div className="bg-background p-1 rounded-xl flex border border-border">
                            <button
                                onClick={() => { setRole(UserRole.WORKER); onClose(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === UserRole.WORKER ? 'bg-surface shadow-sm text-emerald-600' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                <Zap size={14} /> Worker
                            </button>
                            <button
                                onClick={() => { setRole(UserRole.POSTER); onClose(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === UserRole.POSTER ? 'bg-surface shadow-sm text-blue-600' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                <Briefcase size={14} /> Poster
                            </button>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <nav className="flex-1 overflow-y-auto py-4">
                        <ul className="space-y-1">
                            {/* Worker Categories */}
                            {role === UserRole.WORKER && (
                                <>
                                    <div className="px-6 py-2 text-xs font-bold text-text-muted uppercase tracking-widest mt-2 mb-1">
                                        {language === 'en' ? 'Browse Categories' : 'श्रेणियाँ ब्राउज़ करें'}
                                    </div>
                                    {CATEGORY_CONFIG.map(cat => (
                                        <MenuItem
                                            key={cat.id}
                                            icon={cat.icon}
                                            label={cat.label[language]}
                                            onClick={() => { navigate(`/category/${cat.id}`); onClose(); }}
                                        />
                                    ))}
                                    <div className="my-4 border-t border-border mx-6" />
                                </>
                            )}

                            {/* System Settings only, as navigation is now in the main UI */}
                            <MenuItem
                                icon={isDark ? Sun : Moon}
                                label={language === 'en' ? (isDark ? "Light Mode" : "Dark Mode") : (isDark ? "लाइट मोड" : "डार्क मोड")}
                                onClick={() => { toggleTheme(); onClose(); }}
                            />
                            <MenuItem
                                icon={Languages}
                                label={language === 'en' ? "Change Language" : "भाषा बदलें"}
                                onClick={() => setShowLangModal(true)}
                            />
                            {/* Future: Add Settings, Help & Support here */}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-border">
                        <button
                            onClick={onLogout}
                            className="w-full py-3 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <LogOut size={18} />
                            {language === 'en' ? "Sign Out" : "साइन आउट"}
                        </button>
                        <p className="text-center text-[10px] text-text-muted mt-4">v1.2.0 • Antigravity</p>
                    </div>
                </div>
            </div>

            {/* Language Selection Modal */}
            <LanguageSelectionModal isOpen={showLangModal} onClose={() => setShowLangModal(false)} />
        </>
    );
};

const MenuItem: React.FC<{ icon: any, label: string, onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-background transition-colors group"
        >
            <div className="flex items-center gap-4 text-text-secondary font-medium group-hover:text-text-primary">
                <Icon size={20} className="text-text-muted group-hover:text-primary transition-colors" />
                {label}
            </div>
            <ChevronRight size={16} className="text-border group-hover:text-text-muted" />
        </button>
    </li>
);
