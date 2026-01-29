import React from 'react';
import { Job, JobStatus, Bid } from '../types';
import { MapPin, Calendar, Clock, CheckCircle, XCircle, Handshake, MessageCircle, AlertCircle, ChevronRight, Ban, Star, Phone, Search } from 'lucide-react';
import { Language } from '../types';

interface WorkerActiveJobCardProps {
    job: Job;
    currentUserId: string;
    onViewDetails: (job: Job) => void;
    onChat: (job: Job) => void;
    language: Language;
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
    let stripColor = 'bg-primary';
    if (showCounterAction) stripColor = 'bg-amber-500 animate-pulse'; // Amber for attention
    if (isAccepted) stripColor = 'bg-green-500';
    if (isRejected) stripColor = 'bg-red-400';
    if (isCompleted) stripColor = 'bg-text-muted';

    // Badge Styles (Functional Premium)
    const badgeBase = "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border";
    let badgeClass = `${badgeBase} border-primary/20 bg-primary/5 text-primary`;
    if (showCounterAction) badgeClass = `${badgeBase} border-amber-500/20 bg-amber-500/5 text-amber-700 animate-pulse`;
    if (isAccepted) badgeClass = `${badgeBase} border-green-500/20 bg-green-500/5 text-green-600`;
    if (isRejected) badgeClass = `${badgeBase} border-red-500/20 bg-red-500/5 text-red-500`;
    if (isCompleted) badgeClass = `${badgeBase} border-border bg-surface text-text-muted`;
    if (job.status === JobStatus.CANCELLED) badgeClass = `${badgeBase} border-red-500/20 bg-red-500/5 text-red-500`;

    return (
        <div
            onClick={() => onViewDetails(job)}
            className={`card p-5 hover:shadow-elevation hover:border-primary/30 cursor-pointer group relative overflow-hidden transition-all duration-300 bg-surface border border-border rounded-3xl ${showCounterAction ? 'ring-2 ring-amber-400/50' : ''}`}
        >
            {/* Status Strip */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${stripColor} opacity-80`} />

            <div className="pl-4 flex flex-col gap-3">

                {/* Top: Title & Status */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/70 mb-1">
                            {job.category}
                        </p>
                        <h3 className="text-base font-black text-text-primary leading-tight line-clamp-1 flex-1 tracking-tight">
                            {job.title}
                        </h3>
                    </div>

                    {/* Compact Status Badge */}
                    <div className={badgeClass}>
                        {showCounterAction ? <AlertCircle size={10} strokeWidth={3} /> :
                            isAccepted ? <CheckCircle size={10} strokeWidth={3} /> :
                                isRejected ? <XCircle size={10} strokeWidth={3} /> :
                                    isCompleted ? <CheckCircle size={10} strokeWidth={3} /> :
                                        job.status === JobStatus.CANCELLED ? <Ban size={10} strokeWidth={3} /> :
                                            <Clock size={10} strokeWidth={3} />}

                        {showCounterAction ? (language === 'en' ? 'New Offer' : language === 'hi' ? 'नया प्रस्ताव' : 'ਨਵੀਂ ਪੇਸ਼ਕਸ਼') :
                            isAccepted ? (isInProgress ? (language === 'en' ? 'Hired' : language === 'hi' ? 'नियुक्त' : 'ਹਾਇਰ ਹੋਏ') : (language === 'en' ? 'Completed' : language === 'hi' ? 'पूरा हुआ' : 'ਪੂਰਾ ਹੋਇਆ')) :
                                isRejected ? (language === 'en' ? 'Declined' : language === 'hi' ? 'अस्वीकृत' : 'ਰੱਦ ਹੋਇਆ') :
                                    isCompleted ? (language === 'en' ? 'Completed' : language === 'hi' ? 'पूरा हुआ' : 'ਪੂਰਾ ਹੋਇਆ') :
                                        job.status === JobStatus.CANCELLED ? (language === 'en' ? 'Cancelled' : language === 'hi' ? 'रद्द' : 'ਰੱਦ ਹੋਇਆ') :
                                            (language === 'en' ? 'Pending' : language === 'hi' ? 'लंबित' : 'ਬਾਕੀ ਹੈ')}
                    </div>
                </div>

                {/* Middle: Details Row */}
                <div className={`flex items-center gap-4 text-xs font-medium text-text-secondary`}>
                    <span className={`px-2 py-1 rounded-md font-bold tabular-nums ${isCompleted ? 'bg-green-500/10 text-green-600' : 'bg-background text-text-primary'}`}>
                        {isCompleted ? 'Earned: ' : ''}₹{myBid.amount}
                    </span>
                    <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin size={12} className="text-text-muted" /> {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-text-muted" /> {new Date(job.jobDate).toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : 'en-US', { day: 'numeric', month: 'short' })}
                    </span>
                </div>

                {/* Bottom: Action Block (Only if actionable) */}
                {isInProgress ? (
                    <div className="mt-1 pt-3 border-t border-border flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onChat(job); }}
                            className="flex-1 btn btn-primary h-9 rounded-xl text-[10px] uppercase tracking-wider"
                        >
                            <MessageCircle size={14} /> Chat
                        </button>
                        {job.posterPhone && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${job.posterPhone}`);
                                }}
                                className="w-12 btn bg-primary text-white h-9 rounded-xl flex items-center justify-center hover:bg-primary/90 hover:shadow-none"
                            >
                                <Phone size={14} />
                            </button>
                        )}
                    </div>
                ) : showCounterAction ? (
                    <div className="mt-2 pt-2 border-t border-amber-100">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                <Handshake size={14} />
                                {language === 'en' ? 'Counter Offer Received' : language === 'hi' ? 'नया प्रस्ताव मिला' : 'ਨਵੀਂ ਪੇਸ਼ਕਸ਼ ਮਿਲੀ'}
                            </span>
                            <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                                View <ChevronRight size={12} />
                            </span>
                        </div>
                    </div>
                ) : (isRejected || isCompleted || job.status === JobStatus.CANCELLED) ? (
                    <div className="mt-2 pt-2 border-t border-border flex gap-2 justify-end">
                        {/* Show Find Similar only for Rejected */}
                        {isRejected && onFindSimilar && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onFindSimilar(); }}
                                className="flex-1 btn btn-secondary h-8 rounded-lg text-[10px] uppercase tracking-wider"
                            >
                                <Search size={12} /> {language === 'en' ? 'Find Similar' : language === 'hi' ? 'समान काम खोजें' : 'ਅਜਿਹੇ ਕੰਮ ਲੱਭੋ'}
                            </button>
                        )}
                        {onHide && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onHide(job.id); }}
                                className={`px-4 h-8 border rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${isRejected ? 'bg-surface border-border text-text-muted hover:text-red-500 hover:border-red-200'
                                    : 'bg-surface border-transparent text-text-muted hover:bg-background'
                                    }`}
                                title={language === 'en' ? 'Dismiss from History' : 'इतिहास से हटाएं'}
                            >
                                {isRejected ? <XCircle size={14} /> : (language === 'en' ? 'Dismiss' : language === 'hi' ? 'हटाएं' : 'ਹਟਾਓ')}
                            </button>
                        )}
                    </div>
                ) : isPending ? (
                    <div className="mt-1 pt-3 border-t border-border flex justify-end">
                        <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                            Tap to view details <ChevronRight size={12} />
                        </span>
                    </div>
                ) : null}

            </div>
        </div>
    );
};
