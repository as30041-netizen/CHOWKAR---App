import React from 'react';
import { IndianRupee, Clock, MapPin } from 'lucide-react';
import { Job } from '../../types';

interface JobInfoCardsProps {
    liveJob: Job;
    t: any;
}

export const JobInfoCards: React.FC<JobInfoCardsProps> = ({ liveJob, t }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border/50 p-4 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all active:scale-95 cursor-default">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 group-hover:rotate-12 transition-transform">
                    <IndianRupee size={20} strokeWidth={3} />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-0.5">{t.budget}</p>
                <p className="text-lg font-black text-text-primary tracking-tighter">₹{liveJob.budget.toLocaleString()}</p>
            </div>

            <div className="bg-surface border border-border/50 p-4 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all active:scale-95 cursor-default">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2 group-hover:rotate-12 transition-transform">
                    <Clock size={20} strokeWidth={3} />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-0.5">{t.duration || 'Duration'}</p>
                <p className="text-lg font-black text-text-primary tracking-tighter">{liveJob.duration} Days</p>
            </div>

            <div className="bg-surface border border-border/50 p-4 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all active:scale-95 cursor-default col-span-2 md:col-span-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2 group-hover:-rotate-12 transition-transform">
                    <MapPin size={20} strokeWidth={3} />
                </div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-0.5">{t.location || 'Location'}</p>
                <p className="text-sm font-bold text-text-primary tracking-tight truncate w-full px-2">{liveJob.location}</p>
            </div>
        </div>
    );
};
