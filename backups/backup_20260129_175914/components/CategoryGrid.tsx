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
        <div className="w-full overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sticky top-[60px] z-40 bg-background/90 backdrop-blur-xl border-b border-border pt-2 transition-colors">
            <div className="flex gap-3 min-w-max pr-4">
                {/* 'All' Option */}
                <button
                    onClick={() => onSelectCategory(null)}
                    className={`flex flex-col items-center justify-center w-20 h-24 rounded-squircle transition-all duration-300 border ${selectedCategory === null
                        ? 'bg-surface border-primary shadow-elevation scale-105'
                        : 'bg-surface border-border opacity-70 hover:opacity-100 hover:scale-[1.02]'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${selectedCategory === null ? 'bg-primary text-white' : 'bg-background text-text-secondary'}`}>
                        <span className="text-xl font-bold">∞</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedCategory === null ? 'text-primary' : 'text-text-secondary'
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
                            className={`flex flex-col items-center justify-center w-24 h-24 rounded-squircle transition-all duration-300 relative overflow-hidden group border ${isSelected
                                ? 'bg-surface border-primary shadow-elevation scale-105'
                                : 'bg-surface border-border hover:border-primary/30 hover:shadow-sm hover:scale-[1.02]'
                                }`}
                        >
                            {/* Icon Circle */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-colors ${isSelected
                                ? 'bg-primary text-white'
                                : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                                }`}>
                                <Icon size={20} strokeWidth={2.5} />
                            </div>

                            {/* Label */}
                            <span className={`text-[10px] font-bold uppercase tracking-widest text-center px-1 leading-tight ${isSelected
                                ? 'text-text-primary'
                                : 'text-text-secondary group-hover:text-primary'
                                }`}>
                                {cat.label[language] || cat.label.en}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
