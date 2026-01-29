import React, { useRef, useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X, Languages, LogOut, ChevronRight, Zap, Briefcase, Moon, Sun, MapPin, Settings, Home, User as UserIcon, HelpCircle, Shield, Plus, LayoutGrid
} from 'lucide-react';
import { UserRole } from '../types';
import { useTheme } from '../contexts/ThemeContext';

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
    const location = useLocation();
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

    const handleNav = (path: string) => {
        navigate(path);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div
                ref={sidebarRef}
                className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-surface shadow-2xl z-[101] transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) border-r border-border/50 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* 1. BRAND HEADER & LANGUAGE (Integrated) */}
                <div className="px-6 pt-10 pb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-500/20 shadow-sm">
                            <MapPin size={22} fill="currentColor" strokeWidth={1.5} />
                        </div>
                        <span className="text-2xl font-black font-serif-logo text-emerald-950 dark:text-emerald-50 tracking-tight leading-none">
                            CHOWKAR
                        </span>
                    </div>

                    <button
                        onClick={() => setShowLangModal(true)}
                        className="relative group flex items-center gap-2 p-2 bg-background border border-border rounded-xl hover:border-primary/30 transition-all active:scale-95 shadow-sm"
                    >
                        <Languages size={18} className="text-primary group-hover:rotate-12 transition-transform" />
                        <span className="text-[9px] font-black uppercase text-text-secondary pr-1">
                            {language === 'en' ? 'हिन्दी' : 'ENG'}
                        </span>
                    </button>
                </div>

                {/* 2. USER IDENTITY CARD (Premium) */}
                <div className="mx-4 mb-4 p-5 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-gray-900 rounded-[2rem] border border-emerald-200/30 dark:border-emerald-800/20 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="relative">
                            <img
                                src={user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                                alt="Profile"
                                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white dark:ring-gray-800 shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                                <Zap size={10} className="text-white fill-white" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-black text-text-primary leading-tight truncate">{user.name}</h2>
                            <p className="text-xs font-bold text-text-secondary/70">{user.phone}</p>
                            <button
                                onClick={() => handleNav('/profile')}
                                className="mt-1 text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:gap-2 transition-all"
                            >
                                {language === 'en' ? 'View Profile' : 'प्रोफ़ाइल देखें'} <ChevronRight size={10} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                    {/* Background Shine */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-100/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
                </div>

                {/* 3. MODE SWITCHER (High Contrast) */}
                <div className="px-6 mb-6">
                    <div className="bg-background border border-border/50 p-1 rounded-2xl flex gap-1 shadow-inner">
                        <button
                            onClick={() => { setRole(UserRole.WORKER); onClose(); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${role === UserRole.WORKER ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                        >
                            <Zap size={14} className={role === UserRole.WORKER ? 'fill-white' : ''} />
                            {language === 'en' ? 'Worker' : 'कामगार'}
                        </button>
                        <button
                            onClick={() => { setRole(UserRole.POSTER); onClose(); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${role === UserRole.POSTER ? 'bg-blue-600 text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                        >
                            <Briefcase size={14} />
                            {language === 'en' ? 'Poster' : 'पोस्टर'}
                        </button>
                    </div>
                </div>

                {/* 4. NAVIGATION SECTION */}
                <div className="flex-1 overflow-y-auto px-4 pb-8 no-scrollbar">
                    {/* Main Section */}
                    <div className="mb-6">
                        <label className="px-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 block">
                            {language === 'en' ? 'Main Menu' : 'मुख्य मेनू'}
                        </label>
                        <nav className="space-y-1">
                            {role === UserRole.WORKER ? (
                                <>
                                    <NavItem
                                        icon={Briefcase}
                                        label={language === 'en' ? "Find Work" : "काम खोजें"}
                                        active={location.pathname === '/' || location.pathname === '/find'}
                                        onClick={() => handleNav('/')}
                                    />
                                    <NavItem
                                        icon={LayoutGrid}
                                        label={language === 'en' ? "Categories" : "श्रेणियाँ"}
                                        active={location.pathname === '/categories'}
                                        onClick={() => handleNav('/categories')}
                                    />
                                    <NavItem
                                        icon={Home}
                                        label={language === 'en' ? "Active Jobs" : "सक्रिय कार्य"}
                                        active={location.pathname === '/my-jobs'}
                                        onClick={() => handleNav('/my-jobs')}
                                    />
                                </>
                            ) : (
                                <>
                                    <NavItem
                                        icon={Home}
                                        label={language === 'en' ? "My Dashboard" : "मेरा डैशबोर्ड"}
                                        active={location.pathname === '/'}
                                        onClick={() => handleNav('/')}
                                    />
                                    <NavItem
                                        icon={Plus}
                                        label={language === 'en' ? "Post a Job" : "काम पोस्ट करें"}
                                        active={location.pathname === '/post'}
                                        onClick={() => handleNav('/post')}
                                    />
                                </>
                            )}
                        </nav>
                    </div>

                    {/* System Section */}
                    <div className="mb-6 pt-6 border-t border-border/50">
                        <label className="px-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 block">
                            {language === 'en' ? 'System Settings' : 'सिस्टम सेटिंग्स'}
                        </label>
                        <nav className="space-y-1">
                            <NavItem
                                icon={isDark ? Sun : Moon}
                                label={language === 'en' ? (isDark ? "Light Aesthetics" : "Dark Aesthetics") : (isDark ? "लाइट थीम" : "डार्क थीम")}
                                onClick={() => { toggleTheme(); }}
                            />
                            <NavItem
                                icon={Languages}
                                label={language === 'en' ? "Language Settings" : "भाषा सेटिंग्स"}
                                onClick={() => setShowLangModal(true)}
                            />
                            {user?.email === 'as30041@gmail.com' && (
                                <NavItem
                                    icon={Shield}
                                    label={language === 'en' ? "Admin Console" : "एडमिट कंसोल"}
                                    active={location.pathname === '/admin'}
                                    onClick={() => handleNav('/admin')}
                                    highlight
                                />
                            )}
                            <NavItem
                                icon={HelpCircle}
                                label={language === 'en' ? "Help & Support" : "सहायता और समर्थन"}
                                onClick={() => { /* Support Logic */ }}
                            />
                        </nav>
                    </div>
                </div>

                {/* 5. FOOTER (Sign Out) */}
                <div className="p-6 border-t border-border/50 bg-surface">
                    <button
                        onClick={onLogout}
                        className="w-full py-4 rounded-2xl bg-red-500/10 text-red-600 hover:bg-red-500/15 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                        <LogOut size={18} strokeWidth={3} />
                        {language === 'en' ? "Sign Out" : "साइन आउट"}
                    </button>
                    <div className="mt-4 flex flex-col items-center gap-1 opacity-40">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">CHOWKAR GLOBAL</span>
                        <span className="text-[8px] font-medium text-text-muted">v2.1.0 • Antigravity Engine</span>
                    </div>
                </div>
            </div>

            {/* Language Selection Modal */}
            <LanguageSelectionModal isOpen={showLangModal} onClose={() => setShowLangModal(false)} />
        </>
    );
};

const NavItem: React.FC<{ icon: any, label: string, onClick: () => void, active?: boolean, highlight?: boolean }> = ({ icon: Icon, label, onClick, active, highlight }) => (
    <button
        onClick={onClick}
        className={`
            w-full px-4 py-3.5 flex items-center justify-between rounded-2xl transition-all group
            ${active
                ? 'bg-primary/10 text-primary'
                : 'text-text-secondary hover:bg-background/80 hover:text-text-primary'}
            ${highlight && !active ? 'border border-primary/20 bg-primary/5' : ''}
        `}
    >
        <div className="flex items-center gap-4">
            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center transition-all
                ${active ? 'bg-primary text-white shadow-lg' : 'bg-background text-text-muted group-hover:text-primary group-hover:bg-primary/10'}
            `}>
                <Icon size={20} className={active ? 'fill-white/20' : ''} />
            </div>
            <span className="text-sm font-bold tracking-tight">{label}</span>
        </div>
        {!active && <ChevronRight size={14} className="text-text-muted/30 group-hover:translate-x-1 transition-transform" />}
    </button>
);

const Clock: React.FC<any> = (props) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);
