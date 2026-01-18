import React from 'react';
import { MapPin, IndianRupee, Zap, Clock } from 'lucide-react';

interface FilterPillsProps {
    activeFilters: {
        nearby: boolean;
        highPay: boolean;
        urgent: boolean;
        today: boolean;
    };
    onToggle: (type: 'nearby' | 'highPay' | 'urgent' | 'today') => void;
    language: 'en' | 'hi';
}

export const FilterPills: React.FC<FilterPillsProps> = ({ activeFilters, onToggle, language }) => {

    // Pill Component
    const Pill = ({
        type,
        icon: Icon,
        label,
        isActive,
        colorClass
    }: {
        type: 'nearby' | 'highPay' | 'urgent' | 'today',
        icon: any,
        label: string,
        isActive: boolean,
        colorClass: string
    }) => (
        <button
            onClick={() => onToggle(type)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all active:scale-95 ${isActive
                    ? `${colorClass} text-white border-transparent shadow-lg transform scale-105`
                    : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
        >
            <Icon size={14} strokeWidth={isActive ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
            {isActive && <div className="ml-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
        </button>
    );

    return (
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-6 py-2 -mx-0">
            <Pill
                type="nearby"
                icon={MapPin}
                label={language === 'en' ? 'Near Me (<5km)' : 'नज़दीकी (<5km)'}
                isActive={activeFilters.nearby}
                colorClass="bg-blue-600"
            />
            <Pill
                type="highPay"
                icon={IndianRupee}
                label={language === 'en' ? 'High Pay (>₹800)' : 'उच्च वेतन (>₹800)'}
                isActive={activeFilters.highPay}
                colorClass="bg-emerald-600"
            />
            <Pill
                type="urgent"
                icon={Zap}
                label={language === 'en' ? 'Urgent' : 'ज़रूरी'}
                isActive={activeFilters.urgent}
                colorClass="bg-red-500"
            />
            <Pill
                type="today"
                icon={Clock}
                label={language === 'en' ? 'Starts Today' : 'आज शुरू'}
                isActive={activeFilters.today}
                colorClass="bg-purple-600"
            />
        </div>
    );
};
