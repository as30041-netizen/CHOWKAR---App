import React from 'react';
import { CATEGORY_CONFIG } from '../constants';
import { useUser } from '../contexts/UserContextDB';

interface CategoryGridProps {
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ selectedCategory, onSelectCategory }) => {
    const { language } = useUser();

    return (
        <div className="w-full overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sticky top-[60px] z-40 bg-green-50/80 dark:bg-gray-950/80 backdrop-blur-md pt-2">
            <div className="flex gap-3 min-w-max pr-4">
                {/* 'All' Option */}
                <button
                    onClick={() => onSelectCategory(null)}
                    className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl transition-all duration-300 border-2 ${selectedCategory === null
                            ? 'bg-white dark:bg-gray-900 border-emerald-500 shadow-lg scale-105'
                            : 'bg-white dark:bg-gray-900 border-transparent shadow-sm opacity-70 hover:opacity-100 hover:scale-[1.02]'
                        }`}
                >
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 mb-2">
                        <span className="text-xl font-bold">∞</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${selectedCategory === null ? 'text-emerald-600' : 'text-gray-400'
                        }`}>
                        {language === 'en' ? 'All Jobs' : 'सभी काम'}
                    </span>
                </button>

                {/* Categories */}
                {CATEGORY_CONFIG.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                            className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl transition-all duration-300 relative overflow-hidden group ${isSelected ? 'scale-105 shadow-xl ring-2 ring-white dark:ring-gray-900' : 'shadow-sm hover:shadow-md hover:scale-[1.02]'
                                }`}
                        >
                            {/* Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} ${isSelected ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />

                            {/* Icon Circle */}
                            <div className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-1.5 shadow-inner border border-white/20">
                                <Icon size={20} strokeWidth={2.5} />
                            </div>

                            {/* Label */}
                            <span className="relative z-10 text-[10px] font-black uppercase text-white tracking-widest text-center px-1 leading-tight">
                                {cat.label[language] || cat.label.en}
                            </span>

                            {/* Active Shine */}
                            {isSelected && (
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
