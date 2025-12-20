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
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-slide-up pb-safe relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <SlidersHorizontal size={20} className="text-emerald-600" />
                        {language === 'en' ? 'Filters' : 'फिल्टर'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Location Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <MapPin size={16} /> {t.location}
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Mumbai, Delhi"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    {/* Budget Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <IndianRupee size={16} /> {t.budget} (Min)
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g. 1000"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
                            value={minBudget}
                            onChange={(e) => setMinBudget(e.target.value)}
                        />
                    </div>

                    {/* Distance Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Navigation size={16} /> {language === 'en' ? 'Distance (km)' : 'दूरी (कि.मी.)'}
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={maxDistance || 50}
                                onChange={(e) => setMaxDistance(e.target.value)}
                            />
                            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                                {maxDistance || '50'} km
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleReset}
                            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
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
