import React from 'react';
import { useUser } from '../contexts/UserContextDB';

interface Tab {
    id: string;
    label: string;
    count?: number;
}

interface StickyTabsProps {
    tabs: Tab[];
    currentTab: string;
    onTabChange: (tabId: any) => void;
}

export const StickyTabs: React.FC<StickyTabsProps> = ({ tabs, currentTab, onTabChange }) => {
    return (
        <div className="bg-gray-200/50 dark:bg-gray-800/50 p-1 rounded-2xl flex relative max-w-lg mx-auto">
            {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex-1 relative py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 z-10 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                {tab.count}
                            </span>
                        )}

                        {/* Active Background Animation */}
                        {isActive && (
                            <div className="absolute inset-0 bg-white dark:bg-gray-900 rounded-xl shadow-sm -z-10 animate-in fade-in zoom-in-95 duration-200" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
