import React, { useState } from 'react';
import { X, SlidersHorizontal, MapPin, IndianRupee, Navigation } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { location: string, minBudget: string, maxDistance: string }) => void;
    currentFilters: { location: string, minBudget: string, maxDistance: string };
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, onApply, currentFilters }) => {
    const { t, language } = useUser();
    const [location, setLocation] = useState(currentFilters.location);
    const [minBudget, setMinBudget] = useState(currentFilters.minBudget);
    const [maxDistance, setMaxDistance] = useState(currentFilters.maxDistance);

    if (!isOpen) return null;

    const handleApply = () => {
        onApply({ location, minBudget, maxDistance });
        onClose();
    };

    const handleReset = () => {
        setLocation('');
        setMinBudget('');
        setMaxDistance('');
        onApply({ location: '', minBudget: '', maxDistance: '' });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-slide-up pb-safe relative transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SlidersHorizontal size={20} className="text-emerald-600 dark:text-emerald-400" />
                        {language === 'en' ? 'Filters' : 'फिल्टर'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Location Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <MapPin size={16} /> {t.location}
                        </label>
                        <input
                            type="text"
                            placeholder={language === 'en' ? "e.g. Mumbai, Delhi" : "जैसे मुंबई, दिल्ली"}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            maxLength={100}
                        />
                    </div>

                    {/* Budget Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <IndianRupee size={16} /> {t.budget} ({language === 'en' ? 'Min' : 'न्यूनतम'})
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            placeholder={language === 'en' ? "e.g. 1000" : "जैसे 1000"}
                            min="0"
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            value={minBudget}
                            onChange={(e) => setMinBudget(e.target.value)}
                        />
                    </div>

                    {/* Distance Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <Navigation size={16} /> {language === 'en' ? 'Distance (km)' : 'दूरी (कि.मी.)'}
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={maxDistance || 50}
                                onChange={(e) => setMaxDistance(e.target.value)}
                            />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">
                                {maxDistance || '50'} km
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleReset}
                            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {language === 'en' ? 'Reset' : 'रीसेट'}
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-2 w-2/3 bg-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {language === 'en' ? 'Apply Filters' : 'लागू करें'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
