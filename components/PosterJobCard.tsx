import React from 'react';
import { Job, JobStatus } from '../types';
import { MapPin, Calendar, IndianRupee, Users, Edit2, Trash2, MessageCircle, Phone } from 'lucide-react';

interface PosterJobCardProps {
    job: Job;
    onViewBids: (job: Job) => void;
    onEdit: (job: Job) => void;
    onHide: (jobId: string) => void;
    currentUserId?: string; // Not strictly needed but keeps API consistent
    language: 'en' | 'hi';
    isHistory?: boolean;
    onChat?: (job: Job) => void;
}

export const PosterJobCard: React.FC<PosterJobCardProps> = ({
    job, onViewBids, onEdit, onHide, language, isHistory = false, onChat
}) => {

    const applicantCount = job.bids?.length || job.bidCount || 0;
    const isClosed = job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED;
    const hiredWorkerName = job.hiredWorkerName || job.workerName || job.bids?.find(b => b.id === job.acceptedBidId)?.workerName;

    // Analyze bids for actionable states
    const bids = job.bids || [];

    // [FIX] Use pre-calculated count from RPC if available (prevents flash of "no action" on load)
    // If bids are loaded (modal opened), re-calculate to ensure sync with client-side changes
    const calculatedActionCount = bids.filter(b => {
        // Defined "Action Required" for Poster: Bid is PENDING AND (Fresh OR Last move by WORKER)
        if (b.status !== 'PENDING') return false;
        const lastEntry = b.negotiationHistory?.[b.negotiationHistory.length - 1];
        // Note: Using case-insensitive check for safety
        return !lastEntry || lastEntry.by?.toUpperCase() === 'WORKER';
    }).length;

    const actionRequiredCount = bids.length > 0 ? calculatedActionCount : (job.actionRequiredCount || 0);

    const hasAction = actionRequiredCount > 0;

    return (
        <div className={`bg-white dark:bg-gray-900 border ${hasAction ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/30' : 'border-gray-100 dark:border-gray-800'} rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md active:scale-[0.99] group`}>

            {/* Status Strip */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${hasAction ? 'bg-amber-500 animate-pulse' :
                job.status === JobStatus.OPEN ? 'bg-emerald-500' :
                    job.status === JobStatus.IN_PROGRESS ? 'bg-blue-500' :
                        job.status === JobStatus.COMPLETED ? 'bg-green-500' : 'bg-red-400'
                }`} />

            <div className="pl-4 flex flex-col gap-4">

                {/* 1. Top Row: Title & Status Badge */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight mb-1 line-clamp-1">{job.title}</h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(job.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {!isHistory && (
                                <>
                                    <span>•</span>
                                    {hasAction ? (
                                        <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                            Action Required ({actionRequiredCount})
                                        </span>
                                    ) : (
                                        <span className={job.status === JobStatus.OPEN ? 'text-emerald-600' : 'text-gray-400'}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Applicant Counter Badge (Active Only) */}
                    {!isHistory && (
                        <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[60px] ${hasAction ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                            <span className={`text-sm font-black ${hasAction ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{applicantCount}</span>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${hasAction ? 'text-amber-600/70 dark:text-amber-400/70' : 'text-gray-400'}`}>Bids</span>
                        </div>
                    )}
                </div>

                {/* 2. Middle Row: Quick Stats */}
                <div className="flex items-center gap-4 text-xs font-bold text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg">
                        <span>₹{job.budget}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg">
                        <MapPin size={12} />
                        <span className="truncate max-w-[100px]">{job.location}</span>
                    </div>
                </div>

                {/* 3. Action Row */}
                {!isHistory ? (
                    <div className="flex items-center gap-3 mt-1">
                        {job.status === JobStatus.IN_PROGRESS ? (
                            <>
                                {/* Message Button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (onChat) onChat(job); }}
                                    className="flex-1 bg-blue-600 text-white h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-colors"
                                >
                                    <MessageCircle size={14} />
                                    {language === 'en' ? 'Message' : 'मैसेज'}
                                </button>

                                {/* Call Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Prioritize direct phone from job (if RPC updated), else try to find in bids
                                        // Also support job.posterPhone logic if we are viewer? No this is POSTER card.
                                        const phone = job.hiredWorkerPhone || job.bids?.find(b => b.id === job.acceptedBidId)?.workerPhone;
                                        if (phone) {
                                            window.location.href = `tel:${phone}`;
                                        } else {
                                            // Fallback: Open Manage view to see details if phone missing
                                            onViewBids(job);
                                        }
                                    }}
                                    className="flex-1 bg-green-600 text-white h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-green-200 dark:shadow-none hover:bg-green-700 transition-colors"
                                >
                                    <Phone size={14} />
                                    {language === 'en' ? 'Call' : 'कॉल'}
                                </button>
                            </>
                        ) : (
                            // ... Existing OPEN state buttons ...
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onViewBids(job); }}
                                    className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-gray-200 dark:shadow-none hover:bg-gray-800 transition-colors"
                                >
                                    <Users size={14} />
                                    {language === 'en' ? 'Manage Applications' : 'आवेदन प्रबंधित करें'}
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(job); }}
                                    className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                                    className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title={language === 'en' ? "Delete Job" : "काम हटाएं"}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                            {job.status === JobStatus.CANCELLED ? (
                                <div className="text-xs font-black text-red-500 uppercase tracking-wider flex items-center gap-1">
                                    <Trash2 size={12} /> CANCELLED
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">HIRED</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        {hiredWorkerName || (language === 'en' ? 'Worker' : 'कामगार')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewBids(job); }}
                            className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-colors"
                        >
                            {language === 'en' ? 'View Details' : 'विवरण देखें'}
                        </button>

                        {/* History Archive Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-2"
                            title={language === 'en' ? "Remove from History" : "इतिहास से हटाएं"}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
