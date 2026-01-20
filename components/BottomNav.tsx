import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, UserCircle, MessageCircle, Wallet, Search } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

import { useKeyboard } from '../hooks/useKeyboard';

import { useNotification } from '../contexts/NotificationContext';
import { useWallet } from '../contexts/WalletContext';
import { useModals } from '../contexts/ModalContext';

export const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role, t, user, showAlert, setShowEditProfile, language } = useUser();
    const { isOpen } = useKeyboard(); // Mobile Keyboard State
    const { unreadCount, unreadChatCount } = useNotification();
    const { balance } = useWallet();
    const { openChatList } = useModals();

    const onTabChange = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleChatClick = () => {
        onTabChange();
        // If we want a separate page for chats on mobile, navigate to /chats? 
        // Or open Global Chat List?
        // Old BottomNav prop was onChatClick.
        // App.tsx used to pass openChatList?
        // Let's assume onChatClick opens the Chat List Modal/Panel or Navigates.
        // Given we have useModals().openChatList, let's use that.
        openChatList();
    };

    const isActive = (path: string) => location.pathname === path;

    // HIDE NAV ON MOBILE if keyboard is open to save space
    if (isOpen) return null;

    return (
        <nav className="bg-surface/90 backdrop-blur-xl border-t border-border md:hidden flex justify-between items-end px-6 pt-2 pb-safe fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">

            {/* 1. HOME */}
            <button onClick={() => { onTabChange(); navigate('/'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/') ? 'text-primary' : 'text-text-secondary'} relative`}>
                <div className="relative">
                    <LayoutGrid size={24} strokeWidth={isActive('/') ? 2.5 : 2} className={`transition-all ${isActive('/') ? 'scale-110' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface animate-pulse" />
                    )}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest">
                    {role === UserRole.POSTER ? (language === 'en' ? 'Dashboard' : 'डैशबोर्ड') : t.home}
                </span>
            </button>

            {/* 2. CHAT */}
            <button onClick={handleChatClick} className="flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 text-text-secondary relative">
                <div className="relative">
                    <MessageCircle size={24} strokeWidth={2} />
                    {unreadChatCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-surface">
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
                    className={`w-16 h-16 rounded-[22px] flex items-center justify-center shadow-lg border-4 border-background transition-all duration-300 active:scale-95 ${isActive('/post') || isActive('/find')
                        ? 'bg-primary text-white brightness-110'
                        : 'bg-primary text-white'}`}
                >
                    {role === UserRole.POSTER ? <Plus size={32} strokeWidth={2.5} /> : <Search size={28} strokeWidth={2.5} />}
                </button>
            </div>

            {/* 4. WALLET */}
            <button onClick={() => { onTabChange(); navigate('/wallet'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/wallet') ? 'text-primary' : 'text-text-secondary'}`}>
                <Wallet size={24} strokeWidth={isActive('/wallet') ? 2.5 : 2} className={`transition-all ${isActive('/wallet') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{language === 'en' ? 'Cash' : 'कैश'}</span>
            </button>

            {/* 5. PROFILE */}
            <button onClick={() => { onTabChange(); navigate('/profile'); }} className={`flex flex-col items-center gap-1 mb-3 transition-all duration-300 w-12 ${isActive('/profile') ? 'text-primary' : 'text-text-secondary'}`}>
                <UserCircle size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} className={`transition-all ${isActive('/profile') ? 'scale-110' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t.profile}</span>
            </button>
        </nav>
    );
};
