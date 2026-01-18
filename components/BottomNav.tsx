import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, UserCircle, MessageCircle, Wallet, Search } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

interface BottomNavProps {
    unreadChatCount: number;
    walletBalance: number;
    onChatClick: () => void;
    onTabChange: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ unreadChatCount, walletBalance, onChatClick, onTabChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role, t, user, showAlert, setShowEditProfile, language } = useUser();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 md:hidden flex justify-between items-end px-6 py-2 fixed bottom-0 left-0 right-0 z-[100] pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 h-[84px]">

            {/* 1. HOME */}
            <button onClick={() => { onTabChange(); navigate('/'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/') ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <LayoutGrid size={24} strokeWidth={isActive('/') ? 2.5 : 2} className={`transition-all ${isActive('/') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    {role === UserRole.POSTER ? (language === 'en' ? 'Dashboard' : 'डैशबोर्ड') : t.home}
                </span>
            </button>

            {/* 2. CHAT */}
            <button onClick={onChatClick} className="flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 text-gray-400 dark:text-gray-500 relative">
                <div className="relative">
                    <MessageCircle size={24} strokeWidth={2} />
                    {unreadChatCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-950">
                            {unreadChatCount}
                        </span>
                    )}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest">{language === 'en' ? 'Chat' : 'चैट'}</span>
            </button>

            {/* 3. CENTER ACTION FAB */}
            <div className="relative -top-6">
                <button
                    onClick={() => {
                        onTabChange();
                        if (role === UserRole.POSTER) {
                            if (!user.phone || !user.location || user.location === 'Not set') {
                                setShowEditProfile(true);
                                showAlert(language === 'en' ? 'Complete profile first' : 'प्रोफ़ाइल पूरी करें', 'info');
                                return;
                            }
                            navigate('/post');
                        } else {
                            navigate('/find'); // Worker "Find" goes to /find
                        }
                    }}
                    className={`w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] border-4 border-gray-50 dark:border-gray-950 transition-all duration-300 active:scale-95 ${isActive('/post') || isActive('/find')
                        ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white'
                        : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'}`}
                >
                    {role === UserRole.POSTER ? <Plus size={32} strokeWidth={2.5} /> : <Search size={28} strokeWidth={2.5} />}
                </button>
            </div>

            {/* 4. WALLET */}
            <button onClick={() => { onTabChange(); navigate('/wallet'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/wallet') ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <Wallet size={24} strokeWidth={isActive('/wallet') ? 2.5 : 2} className={`transition-all ${isActive('/wallet') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{language === 'en' ? 'Cash' : 'कैश'}</span>
            </button>

            {/* 5. PROFILE */}
            <button onClick={() => { onTabChange(); navigate('/profile'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/profile') ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <UserCircle size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} className={`transition-all ${isActive('/profile') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t.profile}</span>
            </button>
        </nav>
    );
};
