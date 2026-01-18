import React, { useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useNavigate } from 'react-router-dom';
import {
    X, Languages, LogOut, ChevronRight, Zap, Briefcase
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onLanguageToggle: () => void;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onLanguageToggle, onLogout }) => {
    const { user, role, setRole, language } = useUser();
    const navigate = useNavigate();
    const sidebarRef = useRef<HTMLDivElement>(null);

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
                className={`fixed top-0 left-0 h-full w-[80%] max-w-[300px] bg-white dark:bg-gray-900 shadow-2xl z-[101] transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Header: Profile */}
                    <div className="p-6 bg-emerald-600 dark:bg-emerald-900 text-white">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-16 h-16 rounded-full bg-white p-0.5">
                                <img
                                    src={user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                                    alt="Profile"
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold truncate">{user.name}</h2>
                        <p className="text-white/70 text-sm">{user.phone}</p>
                    </div>

                    {/* Role Switcher - Prominent */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">
                            {language === 'en' ? 'Current Mode' : 'वर्तमान मोड'}
                        </label>
                        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex">
                            <button
                                onClick={() => { setRole(UserRole.WORKER); onClose(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === UserRole.WORKER ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600' : 'text-gray-500'}`}
                            >
                                <Zap size={14} /> Worker
                            </button>
                            <button
                                onClick={() => { setRole(UserRole.POSTER); onClose(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === UserRole.POSTER ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
                            >
                                <Briefcase size={14} /> Poster
                            </button>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <nav className="flex-1 overflow-y-auto py-4">
                        <ul className="space-y-1">
                            {/* System Settings only, as navigation is now in the main UI */}
                            <MenuItem icon={Languages} label={language === 'en' ? "Change Language" : "भाषा बदलें"} onClick={onLanguageToggle} />
                            {/* Future: Add Settings, Help & Support here */}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={onLogout}
                            className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                            <LogOut size={18} />
                            {language === 'en' ? "Sign Out" : "साइन आउट"}
                        </button>
                        <p className="text-center text-[10px] text-gray-400 mt-4">v1.2.0 • Antigravity</p>
                    </div>
                </div>
            </div>
        </>
    );
};

const MenuItem: React.FC<{ icon: any, label: string, onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
        >
            <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300 font-medium">
                <Icon size={20} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                {label}
            </div>
            <ChevronRight size={16} className="text-gray-300" />
        </button>
    </li>
);
