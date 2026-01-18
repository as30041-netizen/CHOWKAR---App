import React from 'react';
import { Job, JobStatus, Bid } from '../types';
import { MapPin, Calendar, Clock, CheckCircle, XCircle, Handshake, MessageCircle, AlertCircle, ChevronRight, Ban, Star, Phone, Search } from 'lucide-react';

interface WorkerActiveJobCardProps {
    job: Job;
    currentUserId: string;
    onViewDetails: (job: Job) => void;
    onChat: (job: Job) => void;
    language: 'en' | 'hi';
    onFindSimilar?: () => void; // Support for "Find Similar" action
    onHide?: (jobId: string) => void; // Support for dismissing rejected jobs
}

export const WorkerActiveJobCard: React.FC<WorkerActiveJobCardProps> = ({
    job, currentUserId, onViewDetails, onChat, language, onFindSimilar, onHide
}) => {
    // 1. Resolve My Bid
    const myBid = job.bids?.find(b => b.workerId === currentUserId) || (job.myBidId ? {
        id: job.myBidId,
        workerId: currentUserId,
        status: job.myBidStatus,
        amount: job.myBidAmount,
        negotiationHistory: [] // Simplified for card view
    } as Partial<Bid> : null);

    if (!myBid) return null; // Should not happen in "My Work"

    // 2. Status Logic
    const negotiationHistory = myBid.negotiationHistory || [];
    const lastNegotiation = negotiationHistory.length > 0 ? negotiationHistory[negotiationHistory.length - 1] : null;
    const isCounterOffer = myBid.status === 'PENDING' && lastNegotiation && lastNegotiation.by === 'POSTER';

    // Also support the optimized field `myBidLastNegotiationBy` if available directly on job
    const isCounterOfferOptimized = job.myBidStatus === 'PENDING' && job.myBidLastNegotiationBy === 'POSTER';

    const showCounterAction = isCounterOffer || isCounterOfferOptimized;

    const isAccepted = myBid.status === 'ACCEPTED';
    const isRejected = myBid.status === 'REJECTED';
    const isPending = myBid.status === 'PENDING' && !showCounterAction;
    const isInProgress = job.status === JobStatus.IN_PROGRESS && isAccepted;
    const isCompleted = job.status === JobStatus.COMPLETED;

    // 3. Status Color Strip
    let stripColor = 'bg-blue-500';
    if (showCounterAction) stripColor = 'bg-amber-500 animate-pulse'; // Amber for attention
    if (isAccepted) stripColor = 'bg-emerald-500';
    if (isRejected) stripColor = 'bg-red-400';
    if (isCompleted) stripColor = 'bg-gray-400';

    return (
        <div
            onClick={() => onViewDetails(job)}
            className={`bg-white dark:bg-gray-900 border ${showCounterAction ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/30' : 'border-gray-100 dark:border-gray-800'} rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md active:scale-[0.99] group cursor-pointer`}
        >
            {/* Status Strip */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${stripColor}`} />

            <div className="pl-4 flex flex-col gap-3">

                {/* Top: Title & Status */}
                <div className="flex justify-between items-start gap-4">
                    <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight line-clamp-1 flex-1">
                        {job.title}
                    </h3>

                    {/* Compact Status Badge */}
                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${showCounterAction ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        isAccepted ? 'bg-emerald-50 text-emerald-600' :
                            isRejected ? 'bg-red-50 text-red-500' :
                                isCompleted ? 'bg-gray-100 text-gray-500' :
                                    job.status === JobStatus.CANCELLED ? 'bg-red-50 text-red-500' :
                                        'bg-blue-50 text-blue-600'
                        }`}>
                        {showCounterAction ? <AlertCircle size={10} strokeWidth={3} /> :
                            isAccepted ? <CheckCircle size={10} strokeWidth={3} /> :
                                isRejected ? <XCircle size={10} strokeWidth={3} /> :
                                    isCompleted ? <CheckCircle size={10} strokeWidth={3} /> :
                                        job.status === JobStatus.CANCELLED ? <Ban size={10} strokeWidth={3} /> :
                                            <Clock size={10} strokeWidth={3} />}

                        {showCounterAction ? (language === 'en' ? 'New Offer' : 'नया प्रस्ताव') :
                            isAccepted ? (isInProgress ? 'Hired' : 'Completed') :
                                isRejected ? 'Declined' :
                                    isCompleted ? 'Completed' :
                                        job.status === JobStatus.CANCELLED ? 'Cancelled' : 'Pending'}
                    </div>
                </div>

                {/* Middle: Details Row */}
                <div className={`flex items-center gap-4 text-xs font-bold ${isCompleted ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className={`px-2 py-1 rounded-md ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800'}`}>
                        {isCompleted ? 'Earned: ' : ''}₹{myBid.amount}
                    </span>
                    <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin size={12} /> {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(job.jobDate).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { day: 'numeric', month: 'short' })}
                    </span>
                </div>

                {/* Bottom: Action Block (Only if actionable) */}
                {isInProgress ? (
                    <div className="mt-1 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onChat(job); }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                        >
                            <MessageCircle size={14} /> Chat
                        </button>
                        {job.posterPhone && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${job.posterPhone}`);
                                }}
                                className="w-12 bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                            >
                                <Phone size={14} />
                            </button>
                        )}
                    </div>
                ) : showCounterAction ? (
                    <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-800/30">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                <Handshake size={14} />
                                {language === 'en' ? 'Counter Offer Received' : 'नया प्रस्ताव मिला'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                View <ChevronRight size={12} />
                            </span>
                        </div>
                    </div>
                ) : (isRejected || isCompleted || job.status === JobStatus.CANCELLED) ? (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2 justify-end">
                        {/* Show Find Similar only for Rejected */}
                        {isRejected && onFindSimilar && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onFindSimilar(); }}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 h-8 rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-100"
                            >
                                <Search size={12} /> {language === 'en' ? 'Find Similar' : 'समान काम खोजें'}
                            </button>
                        )}
                        {onHide && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                                className={`px-4 h-8 border rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${isRejected ? 'bg-white dark:bg-gray-900 border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200'
                                        : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                title={language === 'en' ? 'Dismiss from History' : 'इतिहास से हटाएं'}
                            >
                                {isRejected ? <XCircle size={14} /> : (language === 'en' ? 'Dismiss' : 'हटाएं')}
                            </button>
                        )}
                    </div>
                ) : isPending ? (
                    <div className="mt-1 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            Tap to view details <ChevronRight size={12} />
                        </span>
                    </div>
                ) : null}

            </div>
        </div>
    );
};
