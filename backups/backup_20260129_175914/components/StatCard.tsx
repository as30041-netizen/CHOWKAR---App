import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: number | string;
    gradient?: string;
    onClick?: () => void;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    icon: Icon,
    label,
    value,
    gradient = "bg-primary",
    onClick,
    className = ""
}) => {
    return (
        <div
            onClick={onClick}
            className={`bg-surface border border-border p-4 rounded-2xl flex items-center gap-4 shadow-sm min-w-[140px] flex-1 transition-all active:scale-95 ${onClick ? 'cursor-pointer hover:border-primary/30' : ''} ${className}`}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg shadow-black/5`}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-2xl font-black text-text-primary leading-none tracking-tight tabular-nums">
                    {value}
                </p>
                <p className="text-[10px] uppercase font-bold text-text-muted mt-1.5 tracking-widest truncate">
                    {label}
                </p>
            </div>
        </div>
    );
};
