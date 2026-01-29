import React from 'react';
import { MapPin } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'Loading...' }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-background/50 backdrop-blur-md flex items-center justify-center animate-fade-in">
            <div className="flex flex-col items-center gap-6 p-8 rounded-[2.5rem] bg-surface/80 shadow-2xl border border-white/20 dark:border-gray-800/50 relative overflow-hidden">

                {/* Metallic Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

                {/* Animated Brand Icon */}
                <div className="relative">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800/50 shadow-xl shadow-emerald-500/20 animate-bounce-slow">
                        <MapPin size={40} fill="currentColor" strokeWidth={1.5} className="animate-pulse" />
                    </div>
                    {/* Ripple Effect */}
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-3xl animate-ping" />
                </div>

                {/* Loading Message */}
                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-50 tracking-tight">CHOWKAR</h3>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] animate-pulse">
                        {message}
                    </p>
                </div>
            </div>
        </div>
    );
};
