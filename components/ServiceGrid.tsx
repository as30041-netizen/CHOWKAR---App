import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, History, UserCircle,
    Plus, LayoutDashboard, Users, Zap
} from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';

interface ServiceGridProps {
    onTabChange: (tab: any) => void;
    currentTab: string;
}

export const ServiceGrid: React.FC<ServiceGridProps> = ({ onTabChange, currentTab }) => {
    const { role, t, language } = useUser();
    const navigate = useNavigate();

    const services = role === UserRole.WORKER ? [
        {
            id: 'FIND',
            label: language === 'en' ? 'Find Work' : 'काम खोजें',
            icon: Search,
            color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            action: () => onTabChange('FIND')
        },
        {
            id: 'HISTORY',
            label: language === 'en' ? 'My Activity' : 'मेरी गतिविधि',
            icon: History,
            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
            action: () => onTabChange('HISTORY')
        },

        {
            id: 'ACTIVE',
            label: language === 'en' ? 'My Work' : 'मेरा काम',
            icon: LayoutDashboard,
            color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
            action: () => onTabChange('ACTIVE')
        }
    ] : [
        {
            id: 'POST',
            label: language === 'en' ? 'Post Job' : 'काम डालें',
            icon: Plus,
            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
            action: () => navigate('/post')
        },
        {
            id: 'ACTIVE',
            label: language === 'en' ? 'My Posts' : 'मेरी पोस्ट',
            icon: LayoutDashboard,
            color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            action: () => onTabChange('ACTIVE')
        },
        {
            id: 'HISTORY',
            label: language === 'en' ? 'History' : 'इतिहास',
            icon: History,
            color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            action: () => onTabChange('HISTORY')
        },

    ];

    return (
        <div className="grid grid-cols-4 gap-4 px-2">
            {services.map((service) => (
                <button
                    key={service.id}
                    onClick={service.action}
                    className="flex flex-col items-center gap-3 group"
                >
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 shadow-sm group-hover:scale-105 group-active:scale-95 ${service.color} ${currentTab === service.id ? 'ring-4 ring-white dark:ring-gray-950 shadow-lg scale-105' : ''}`}>
                        <service.icon size={26} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 text-center leading-tight group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        {service.label}
                    </span>
                </button>
            ))}
        </div>
    );
};
