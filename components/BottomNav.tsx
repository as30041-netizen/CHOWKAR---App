import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Plus, UserCircle, MessageCircle, LayoutGrid, Search } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

import { useKeyboard } from '../hooks/useKeyboard';

interface BottomNavProps {
    unreadChatCount: number;
    unreadCount: number;
    onChatClick: () => void;
    onTabChange: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ unreadChatCount, unreadCount, onChatClick, onTabChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role, t, user, showAlert, setShowEditProfile, language, isProfileComplete } = useUser();
    const { isOpen } = useKeyboard(); // Mobile Keyboard State

    const isActive = (path: string) => location.pathname === path;

    // HIDE NAV ON MOBILE if keyboard is open to save space
    if (isOpen) return null;

    return (
        <nav className={`bg-surface/90 backdrop-blur-2xl border-t border-border md:hidden grid ${role === UserRole.WORKER ? 'grid-cols-5' : 'grid-cols-4'} items-center px-2 pt-2 pb-safe fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.06)] transition-all duration-300`}>

            {/* 1. HOME */}
            <button
                onClick={() => {
                    onTabChange();
                    if (role === UserRole.WORKER) {
                        navigate('/my-jobs');
                    } else {
                        navigate('/');
                    }
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-300 ${isActive('/') || isActive('/my-jobs') ? 'text-primary' : 'text-text-secondary'}`}
            >
                <div className="relative">
                    <Home size={22} strokeWidth={isActive('/') || isActive('/my-jobs') ? 2.5 : 2} className={`transition-all ${isActive('/') || isActive('/my-jobs') ? 'scale-110' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-surface" />
                    )}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-center">
                    {language === 'en' ? 'Home' : 'होम'}
                </span>
            </button>

            {/* 2. CHAT */}
            <button
                onClick={onChatClick}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-300 ${location.pathname === '/chat' ? 'text-primary' : 'text-text-secondary'}`}
            >
                <div className="relative">
                    <MessageCircle size={22} strokeWidth={isActive('/chat') ? 2.5 : 2} />
                    {unreadChatCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border-2 border-surface min-w-[18px]">
                            {unreadChatCount}
                        </span>
                    )}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-center">{language === 'en' ? 'Chat' : 'चैट'}</span>
            </button>

            {/* 3. CENTER ACTION FAB */}
            <div className={`flex justify-center -mt-8 relative h-full ${role === UserRole.POSTER ? 'order-3' : ''}`}>
                <button
                    onClick={() => {
                        onTabChange();
                        if (role === UserRole.POSTER) {
                            if (!isProfileComplete) return;
                            navigate('/post');
                        } else {
                            navigate('/find');
                        }
                    }}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 relative ${isActive('/post') || isActive('/find')
                        ? 'bg-primary text-white scale-110 ring-4 ring-primary/20'
                        : 'bg-primary text-white'}`}
                >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 hover:opacity-100 transition-opacity" />
                    {role === UserRole.POSTER ? <Plus size={32} strokeWidth={3} /> : <Search size={28} strokeWidth={3} />}
                </button>
            </div>

            {/* 4. EXPLORE (Worker Only) */}
            {role === UserRole.WORKER && (
                <button
                    onClick={() => {
                        onTabChange();
                        navigate('/categories');
                    }}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-300 ${isActive('/categories') ? 'text-primary' : 'text-text-secondary'}`}
                >
                    <LayoutGrid size={22} strokeWidth={isActive('/categories') ? 2.5 : 2} className={`transition-all ${isActive('/categories') ? 'scale-110' : ''}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-center">{language === 'en' ? 'Explore' : 'खोजें'}</span>
                </button>
            )}

            {/* 5. PROFILE */}
            <button
                onClick={() => { onTabChange(); navigate('/profile'); }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-300 ${isActive('/profile') ? 'text-primary' : 'text-text-secondary'} ${role === UserRole.POSTER ? 'order-4' : ''}`}
            >
                <UserCircle size={22} strokeWidth={isActive('/profile') ? 2.5 : 2} className={`transition-all ${isActive('/profile') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-center">{t.navProfile}</span>
            </button>
        </nav>
    );
};
