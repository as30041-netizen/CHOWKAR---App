import React from 'react';
import { CATEGORY_CONFIG } from '../constants';
import { useUser } from '../contexts/UserContextDB';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CategoryHeroProps {
    // No props needed for navigation mode
    selectedCategory?: string | null; // Optional for backward compatibility if needed, but unused
    onSelectCategory?: (category: string | null) => void;
}

export const CategoryHero: React.FC<CategoryHeroProps> = () => {
    const { language } = useUser();
    const navigate = useNavigate();

    return (
        <div className="w-full mb-6">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                    {language === 'en' ? 'Explore Categories' : 'श्रेणियाँ खोजें'}
                </h3>
            </div>

            {/* Mobile: Horizontal Snap Carousel */}
            <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-1 -mx-4 px-4 no-scrollbar">
                {CATEGORY_CONFIG.map((cat) => {
                    return (
                        <button
                            key={cat.id}
                            onClick={() => navigate(`/category/${cat.id}`)}
                            className="snap-center shrink-0 w-[240px] h-[140px] rounded-[1.5rem] relative overflow-hidden transition-all duration-300 group hover:scale-[1.02]"
                        >
                            {/* Background Image / Color */}
                            {cat.image ? (
                                <img
                                    src={cat.image}
                                    alt={cat.label.en}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            ) : (
                                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color}`} />
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-5 text-left w-full">
                                <div className="w-8 h-8 rounded-full mb-2 flex items-center justify-center backdrop-blur-md bg-white/20 text-white">
                                    <cat.icon size={16} />
                                </div>
                                <h4 className="text-white font-black text-lg leading-none mb-1">
                                    {cat.label[language] || cat.label.en}
                                </h4>
                                <p className="text-white/80 text-[10px] uppercase font-bold tracking-wider">
                                    {language === 'en' ? 'View Jobs' : 'काम देखें'}
                                </p>
                            </div>

                            {/* Arrow Indicator */}
                            <div className="absolute top-4 right-4 w-6 h-6 bg-white/20 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight size={16} className="text-white" />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Desktop: Grid Layout */}
            <div className="hidden md:grid grid-cols-4 gap-4">
                {CATEGORY_CONFIG.map((cat) => {
                    return (
                        <button
                            key={cat.id}
                            onClick={() => navigate(`/category/${cat.id}`)}
                            className="h-[120px] rounded-2xl relative overflow-hidden transition-all duration-300 group hover:scale-[1.02] hover:shadow-xl"
                        >
                            {/* Background Image / Color */}
                            {cat.image ? (
                                <img
                                    src={cat.image}
                                    alt={cat.label.en}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            ) : (
                                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color}`} />
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-70 group-hover:opacity-50 transition-opacity" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-4 text-left w-full">
                                <h4 className="text-white font-black text-sm leading-none mb-1 flex items-center gap-2">
                                    {cat.label[language] || cat.label.en}
                                    <ChevronRight size={14} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </h4>
                            </div>

                        </button>
                    );
                })}
            </div>
        </div>
    );
};
