import React from 'react';
import { Job, UserRole } from '../types';
import { Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface ActiveJobsRailProps {
    jobs: Job[];
    role: UserRole;
    onJobClick: (job: Job) => void;
    onViewAll: () => void;
}

export const ActiveJobsRail: React.FC<ActiveJobsRailProps> = ({ jobs, role, onJobClick, onViewAll }) => {
    const { language } = useUser();

    if (jobs.length === 0) return null;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {role === UserRole.WORKER
                        ? (language === 'en' ? 'Active Jobs' : 'सक्रिय काम')
                        : (language === 'en' ? 'Ongoing Posts' : 'चल रही पोस्ट')}
                </h3>

            </div>

            <div className="flex gap-4 overflow-x-auto pb-6 px-2 -mx-2 snap-x hide-scrollbar">
                {jobs.map(job => (
                    <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className="snap-start min-w-[280px] w-[280px] bg-white dark:bg-gray-900 p-5 rounded-[2rem] shadow-glass border border-white dark:border-gray-800 relative group cursor-pointer transition-transform active:scale-95"
                    >
                        {/* Status Pill */}
                        <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                            {job.status}
                        </div>

                        <div className="flex items-start gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${role === UserRole.POSTER ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Clock size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1 text-lg leading-tight">
                                    {job.title}
                                </h4>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-1">
                                    {job.location}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                ₹{job.budget}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </div>
                    </div>
                ))}

                {jobs.length > 3 && (
                    <button
                        onClick={onViewAll}
                        className="snap-start min-w-[100px] flex flex-col items-center justify-center gap-2 group"
                    >
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110">
                            <ChevronRight size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {language === 'en' ? 'View All' : 'सभी देखें'}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};
