import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, Navigation, Wallet, UserCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

export const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role, t } = useUser();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 md:hidden flex justify-around items-center px-2 py-3 fixed bottom-0 left-0 right-0 z-30 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-lg-up transition-colors duration-300">
            <button onClick={() => navigate('/')} className={`flex flex-col items-center gap-1 min-w-[64px] ${isActive('/') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                <LayoutGrid size={24} className={isActive('/') ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px]">{t.home}</span>
            </button>

            {role === UserRole.POSTER ? (
                <button onClick={() => navigate('/post')} className="flex flex-col items-center gap-1 -mt-8">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-green-50 dark:border-gray-900 transition-transform active:scale-95 ${isActive('/post') ? 'bg-emerald-700 dark:bg-emerald-600 text-white' : 'bg-emerald-600 dark:bg-emerald-500 text-white'}`}>
                        <Plus size={28} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{t.postJob}</span>
                </button>
            ) : (
                <button onClick={() => { }} className="flex flex-col items-center gap-1 min-w-[64px] opacity-20 cursor-not-allowed">
                    {/* Placeholder for symmetry or another Worker feature */}
                    <Navigation size={24} />
                    <span className="text-[10px]">Map</span>
                </button>
            )}

            <button onClick={() => navigate('/wallet')} className={`flex flex-col items-center gap-1 min-w-[64px] ${isActive('/wallet') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                <Wallet size={24} className={isActive('/wallet') ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px]">{t.wallet}</span>
            </button>

            <button onClick={() => navigate('/profile')} className={`flex flex-col items-center gap-1 min-w-[64px] ${isActive('/profile') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                <UserCircle size={24} className={isActive('/profile') ? 'drop-shadow-sm' : ''} />
                <span className="text-[10px]">{t.profile}</span>
            </button>
        </nav>
    );
};
