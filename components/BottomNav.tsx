import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, UserCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

export const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role, t, user, showAlert, setShowEditProfile, language } = useUser();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 md:hidden flex justify-around items-center px-4 py-3 fixed bottom-0 left-0 right-0 z-30 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
            <button onClick={() => navigate('/')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-90 ${isActive('/') ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <LayoutGrid size={24} className={`transition-all ${isActive('/') ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] scale-110' : ''}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${isActive('/') ? 'opacity-100' : 'opacity-60'}`}>{t.home}</span>
            </button>

            {role === UserRole.POSTER && (
                <button
                    onClick={() => {
                        if (!user.phone || !user.location || user.location === 'Not set') {
                            setShowEditProfile(true);
                            showAlert(language === 'en'
                                ? 'Please complete your profile (Phone & Location) before posting a job.'
                                : 'काम पोस्ट करने से पहले कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
                            return;
                        }
                        navigate('/post');
                    }}
                    className="flex flex-col items-center gap-1.5 -mt-10 relative group"
                >
                    <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] border-[5px] border-green-50 dark:border-gray-900 transition-all duration-500 active:scale-95 group-hover:rotate-90 ${isActive('/post') ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white' : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'}`}>
                        <Plus size={32} strokeWidth={3} />
                    </div>
                </button>
            )}


            <button onClick={() => navigate('/profile')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-90 ${isActive('/profile') ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <UserCircle size={24} className={`transition-all ${isActive('/profile') ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] scale-110' : ''}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${isActive('/profile') ? 'opacity-100' : 'opacity-60'}`}>{t.profile}</span>
            </button>
        </nav>
    );
};
