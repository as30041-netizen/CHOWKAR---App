import React from 'react';
import { Job, JobStatus, Language } from '../types';
import { MapPin, Calendar, IndianRupee, Users, Edit2, Trash2, MessageCircle, Phone, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

interface PosterJobCardProps {
    job: Job;
    onViewBids: (job: Job) => void;
    onEdit: (job: Job) => void;
    onHide: (jobId: string) => void;
    currentUserId?: string; // Not strictly needed but keeps API consistent
    language: Language;
    isHistory?: boolean;
    onChat?: (job: Job) => void;
    onClick?: () => void;
}

export const PosterJobCard: React.FC<PosterJobCardProps> = ({
    job, onViewBids, onEdit, onHide, language, isHistory = false, onChat, onClick
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
        <div
            onClick={onClick}
            className={`bg-surface border ${hasAction ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-border'} rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-elevation active:scale-[0.99] group cursor-pointer`}
        >

            {/* Status Strip */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${hasAction ? 'bg-amber-500 animate-pulse' :
                job.status === JobStatus.OPEN ? 'bg-emerald-500' :
                    job.status === JobStatus.IN_PROGRESS ? 'bg-blue-500' :
                        job.status === JobStatus.COMPLETED ? 'bg-green-500' : 'bg-red-400'
                }`} />

            <div className="pl-4 flex flex-col gap-4">

                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/70 mb-1">
                            {job.category}
                        </p>
                        <h3 className="text-lg font-black text-text-primary leading-tight mb-1 line-clamp-1">{job.title}</h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(job.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {!isHistory && (
                                <>
                                    <span>•</span>
                                    {hasAction ? (
                                        <span className="text-amber-500 flex items-center gap-1">
                                            Action Required ({actionRequiredCount})
                                        </span>
                                    ) : (
                                        <span className={job.status === JobStatus.OPEN ? 'text-emerald-500' : 'text-text-muted'}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Applicant Counter Badge (Active Only) - MOVED TO ACCOMMODATE STATUS CHIPS */}
                </div>

                {/* 2. Premium Status Row (New) */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {hasAction ? (
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-1.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-amber-500/20 animate-pulse border border-white/10">
                            <AlertCircle size={12} strokeWidth={3} /> {language === 'en' ? 'Action Required' : 'कारवाई आवश्यक'}
                        </div>
                    ) : job.hasAgreement ? (
                        <div className="bg-emerald-500 text-white py-1.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-emerald-500/30 shadow-lg animate-pulse-subtle border border-white/20">
                            <CheckCircle size={12} strokeWidth={3} /> {language === 'en' ? 'Agreement Reached' : 'सहमति बन गई'}
                        </div>
                    ) : job.hasNewBid ? (
                        <div className="bg-blue-600 text-white py-1.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 animate-bounce-subtle flex items-center gap-1.5">
                            <Sparkles size={12} strokeWidth={3} /> {language === 'en' ? 'Fresh Bids' : 'नई बोलियां'}
                        </div>
                    ) : null}

                    {/* Applicant Counter Badge */}
                    {!isHistory && (
                        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border ${hasAction ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-background border-border text-text-muted'}`}>
                            <Users size={12} strokeWidth={2.5} />
                            <span className="text-[10px] font-black">{applicantCount}</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider">{language === 'en' ? 'Bids' : 'बोलियां'}</span>
                        </div>
                    )}
                </div>

                {/* 2. Middle Row: Quick Stats */}
                <div className="flex items-center gap-4 text-xs font-bold text-text-secondary">
                    <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-lg border border-border">
                        <span>₹{job.budget}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-lg border border-border">
                        <MapPin size={12} className="text-text-muted" />
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
                                    className="flex-1 bg-text-primary text-background h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-black/5 hover:bg-text-primary/90 transition-colors"
                                >
                                    <Users size={14} />
                                    {language === 'en' ? 'Manage Applications' : 'आवेदन प्रबंधित करें'}
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(job); }}
                                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-text-secondary hover:bg-background transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title={language === 'en' ? "Delete Job" : "काम हटाएं"}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <div>
                            {job.status === JobStatus.CANCELLED ? (
                                <div className="text-xs font-black text-red-500 uppercase tracking-wider flex items-center gap-1">
                                    <Trash2 size={12} /> CANCELLED
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">HIRED</span>
                                    <span className="text-sm font-bold text-text-primary">
                                        {hiredWorkerName || (language === 'en' ? 'Worker' : 'कामगार')}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewBids(job); }}
                            className="px-4 py-2 bg-background text-text-secondary rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-border transition-colors"
                        >
                            {language === 'en' ? 'View Details' : 'विवरण देखें'}
                        </button>

                        {/* History Archive Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-2"
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
