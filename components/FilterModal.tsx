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
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto animate-fade-in" onClick={onClose} />
            <div className="w-full max-w-lg bg-white dark:bg-gray-950 rounded-[3.5rem] p-0 pointer-events-auto animate-slide-up pb-safe relative shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] transition-all border-4 border-white/20 dark:border-gray-800/50 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="px-10 pt-4 pb-8 border-b border-gray-100 dark:border-gray-800 flex items-center gap-6 shrink-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl rounded-t-[3.5rem]">
                    <button
                        onClick={onClose}
                        className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-emerald-600 transition-all active:scale-90 border border-gray-100 dark:border-gray-800 group"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <SlidersHorizontal size={28} strokeWidth={3} />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] mb-1">Search Tools</h4>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                {language === 'en' ? 'Refine Results' : 'परिणामों को सुधारें'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto p-10 space-y-10 custom-scrollbar flex-1">
                    {/* Category Selection */}
                    <div className="space-y-4">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                            <LayoutGrid size={16} className="text-emerald-500" />
                            {language === 'en' ? 'Choose Category' : 'श्रेणी चुनें'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {['All', ...CATEGORIES].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm border-2 ${category === cat
                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                        : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-100 dark:border-gray-800 hover:border-emerald-200'}`}
                                >
                                    {cat === 'All' ? t.allJobs : (CATEGORY_TRANSLATIONS[cat]?.[language] || cat)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort Selection */}
                    <div className="space-y-4">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                            <ArrowUpDown size={16} className="text-emerald-500" />
                            {language === 'en' ? 'Sort By' : 'क्रमबद्ध करें'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {sortOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => setSortBy(option.value)}
                                    className={`px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all text-left border-2 ${sortBy === option.value
                                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border-emerald-500'
                                        : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-100 dark:border-gray-800'}`}
                                >
                                    {language === 'en' ? option.labelEn : option.labelHi}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location Filter */}
                    <div className="space-y-4 group">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-emerald-500 transition-colors">
                            <MapPin size={16} className="text-emerald-500" />
                            {language === 'en' ? 'Target Location' : 'लक्ष्य स्थान'}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={language === 'en' ? "e.g. Mumbai, Delhi" : "जैसे मुंबई, दिल्ली"}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-8 py-6 text-xl font-black text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                maxLength={100}
                            />
                        </div>
                    </div>

                    {/* Budget & Distance Grid */}
                    <div className="grid sm:grid-cols-2 gap-10">
                        <div className="space-y-4 group">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-emerald-500 transition-colors">
                                <IndianRupee size={16} className="text-emerald-500" />
                                {language === 'en' ? 'Minimum Budget' : 'न्यूनतम बजट'}
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder="0"
                                min="0"
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-8 py-6 text-2xl font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                                value={minBudget}
                                onChange={(e) => setMinBudget(e.target.value)}
                            />
                        </div>

                        <div className="space-y-4 group">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                                <Navigation size={16} className="text-emerald-500" />
                                {language === 'en' ? 'Search Radius' : 'तलाश का घेरा'}
                            </label>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border-4 border-white dark:border-gray-800 shadow-glass">
                                <div className="flex items-center gap-6">
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        value={maxDistance || 50}
                                        onChange={(e) => setMaxDistance(e.target.value)}
                                    />
                                    <div className="bg-emerald-600 text-white py-2 px-4 rounded-[1.25rem] shadow-lg shadow-emerald-500/20 text-xs font-black min-w-[70px] text-center">
                                        {maxDistance || '50'} KM
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shrink-0 flex gap-6">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-6 rounded-[2rem] bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-black text-[10px] uppercase tracking-[0.3em] shadow-sm hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                    >
                        <RotateCcw size={18} className="group-hover:rotate-[-180deg] transition-transform duration-500" />
                        {language === 'en' ? 'Reset' : 'रीसेट'}
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-[2] py-6 rounded-[2rem] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-emerald-500/30 transform transition-all active:scale-95 flex items-center justify-center gap-3 hover:-translate-y-1"
                    >
                        {language === 'en' ? 'Apply Filters' : 'लागू करें'} <ChevronRight size={20} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};
