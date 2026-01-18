import React, { useState } from 'react';
import { ArrowLeft, X, SlidersHorizontal, MapPin, IndianRupee, Navigation, RotateCcw, ChevronRight, LayoutGrid, ArrowUpDown } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { CATEGORIES, CATEGORY_TRANSLATIONS } from '../constants';

type SortOption = 'NEWEST' | 'BUDGET_HIGH' | 'BUDGET_LOW' | 'NEAREST';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { location: string, minBudget: string, maxDistance: string, category: string, sortBy: SortOption }) => void;
    currentFilters: { location: string, minBudget: string, maxDistance: string, category: string, sortBy: SortOption };
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, onApply, currentFilters }) => {
    const { t, language } = useUser();
    const [location, setLocation] = useState(currentFilters.location);
    const [minBudget, setMinBudget] = useState(currentFilters.minBudget);
    const [maxDistance, setMaxDistance] = useState(currentFilters.maxDistance);
    const [category, setCategory] = useState(currentFilters.category);
    const [sortBy, setSortBy] = useState<SortOption>(currentFilters.sortBy);

    if (!isOpen) return null;

    const sortOptions: { value: SortOption; labelEn: string; labelHi: string }[] = [
        { value: 'NEWEST', labelEn: 'Newest First', labelHi: 'नया पहले' },
        { value: 'BUDGET_HIGH', labelEn: 'Budget: High to Low', labelHi: 'बजट: ज्यादा से कम' },
        { value: 'BUDGET_LOW', labelEn: 'Budget: Low to High', labelHi: 'बजट: कम से ज्यादा' },
        { value: 'NEAREST', labelEn: 'Nearest First', labelHi: 'पास वाले पहले' },
    ];

    const handleApply = () => {
        onApply({ location, minBudget, maxDistance, category, sortBy });
        onClose();
    };

    const handleReset = () => {
        setLocation('');
        setMinBudget('');
        setMaxDistance('');
        setCategory('All');
        setSortBy('NEWEST');
        onApply({ location: '', minBudget: '', maxDistance: '', category: 'All', sortBy: 'NEWEST' });
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-[110] flex items-end md:items-center justify-center pointer-events-none sm:p-4 ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

            {/* Modal/Sheet Container */}
            <div className="w-full md:max-w-md bg-white dark:bg-gray-950 rounded-t-[2.5rem] md:rounded-[2.5rem] p-0 pointer-events-auto animate-in slide-in-from-bottom duration-300 relative shadow-2xl flex flex-col max-h-[90vh]">

                {/* Mobile Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-8 pt-4 pb-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-3 -ml-2 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-90"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em] mb-1">Search Tools</h4>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            <SlidersHorizontal size={24} className="text-emerald-500" strokeWidth={3} />
                            {language === 'en' ? 'Refine' : 'फ़िल्टर'}
                        </h3>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">

                    {/* Category Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">
                            {language === 'en' ? 'Category' : 'श्रेणी'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {['All', ...CATEGORIES].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${category === cat
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/30'
                                        : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800'}`}
                                >
                                    {cat === 'All' ? t.allJobs : (CATEGORY_TRANSLATIONS[cat]?.[language] || cat)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">
                            {language === 'en' ? 'Sort By' : 'क्रमबद्ध करें'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {sortOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => setSortBy(option.value)}
                                    className={`px-3 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-left border ${sortBy === option.value
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50'
                                        : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800'}`}
                                >
                                    {language === 'en' ? option.labelEn : option.labelHi}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location Filter */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <MapPin size={12} className="text-emerald-500" />
                            {language === 'en' ? 'Location' : 'स्थान'}
                        </label>
                        <input
                            type="text"
                            placeholder={language === 'en' ? "e.g. Mumbai" : "जैसे मुंबई"}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500/50 rounded-2xl px-5 py-4 text-base font-bold text-gray-900 dark:text-white outline-none transition-all"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    {/* Budget & Distance Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <IndianRupee size={12} className="text-emerald-500" />
                                {language === 'en' ? 'Min Budget' : 'न्यूनतम बजट'}
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500/50 rounded-2xl px-5 py-4 text-lg font-bold text-gray-900 dark:text-white outline-none transition-all"
                                value={minBudget}
                                onChange={(e) => setMinBudget(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Navigation size={12} className="text-emerald-500" />
                                {language === 'en' ? 'Radius' : 'घेरा'}
                            </label>
                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-2xl flex items-center gap-2 h-[60px]">
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 ml-2"
                                    value={maxDistance || 50}
                                    onChange={(e) => setMaxDistance(e.target.value)}
                                />
                                <div className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm whitespace-nowrap min-w-[50px] text-center">
                                    {maxDistance || '50'}km
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white dark:bg-gray-950 md:rounded-b-[2.5rem] flex gap-4 border-t border-gray-100 dark:border-gray-800 pb-safe">
                    <button
                        onClick={handleReset}
                        className="px-6 py-4 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
                    >
                        <RotateCcw size={18} />
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {language === 'en' ? 'Apply Filters' : 'लागू करें'} <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};
