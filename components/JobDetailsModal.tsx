import React, { useEffect } from 'react';
import { X, ArrowLeft, XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee, UserCircle, Users, ChevronRight, Loader2, Clock, Handshake, Trash2, Navigation, CheckCircle, Heart, MessageCircle, Phone } from 'lucide-react';
import { Job, UserRole, JobStatus } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { supabase } from '../lib/supabase';
import { LeafletMap } from './LeafletMap';

interface JobDetailsModalProps {
    job: Job | null;
    onClose: () => void;
    onBid: (jobId: string) => void;
    onViewBids: (job: Job) => void;
    onChat: (job: Job) => void;
    onEdit: (job: Job) => void;
    onDelete: (jobId: string) => void;
    onCancel?: (jobId: string) => void;
    onReplyToCounter?: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
    onViewProfile: (userId: string, name?: string, phoneNumber?: string) => void;
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
    onCompleteJob?: (job?: Job) => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job, onClose, onBid, onViewBids, onChat, onEdit, onDelete, onCancel, onReplyToCounter, onViewProfile, showAlert, onCompleteJob
}) => {
    const { user, role, t, language, isAuthLoading } = useUser();
    const { getJobWithFullDetails, jobs } = useJobs();
    const [showCounterInput, setShowCounterInput] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Initial touch states
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

    useEffect(() => {
        if (job?.id) {
            // Use cache (10s freshness) instead of forcing a DB call every time the modal mounts
            getJobWithFullDetails(job.id);
        }
    }, [job?.id, getJobWithFullDetails]);

    // --- REALTIME SYNC (Added for Dealer/Negotiation Speed) ---
    const realtimeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // 1. Hybrid Sync (Focus/Online - Refetch on app switch)
    useEffect(() => {
        if (!job?.id) return;

        const handleFocus = () => {
            if (!document.hidden && job?.id) {
                console.log('[JobDetails] 📱 App foregrounded - Triggering Refetch...');
                getJobWithFullDetails(job.id, true);
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);
        window.addEventListener('online', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
            window.removeEventListener('online', handleFocus);
        };
    }, [job?.id, getJobWithFullDetails]);

    // 2. Direct Realtime Subscription (Watch Bids Table)
    useEffect(() => {
        if (!job?.id) return;

        console.log('[JobDetails] Setting up realtime subscription for job:', job.id);

        const channel = supabase
            .channel(`job_details_${job.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bids',
                    filter: `job_id=eq.${job.id}`
                },
                (payload) => {
                    console.log('[JobDetails] Bid change detected via Realtime:', payload.eventType);
                    // Debounce the refetch to avoid spamming validity checks
                    if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
                    realtimeTimeoutRef.current = setTimeout(() => {
                        console.log('[JobDetails] Refetching due to change...');
                        getJobWithFullDetails(job.id, true);
                    }, 800);
                }
            )
            .subscribe();

        return () => {
            if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [job?.id, getJobWithFullDetails]);

    // Use live job data from context if available to handle real-time updates
    const liveJob = jobs.find(j => j.id === job?.id) || job;

    if (!liveJob) return null;

    // Use surgically fetched summary fields if full bids array is still loading
    const myBid = liveJob.bids.find(b => b.workerId === user.id) ||
        (liveJob.myBidId ? { id: liveJob.myBidId, status: liveJob.myBidStatus, amount: liveJob.myBidAmount } as any : null);

    // Compute lastTurnBy from actual bid data if available, otherwise use precomputed field
    const fullBid = liveJob.bids.find(b => b.workerId === user.id);
    const lastNegotiationEntry = fullBid?.negotiationHistory?.length
        ? fullBid.negotiationHistory[fullBid.negotiationHistory.length - 1]
        : null;
    const lastTurnBy = lastNegotiationEntry?.by || liveJob.myBidLastNegotiationBy;
    const currentStatus = myBid?.status || liveJob.myBidStatus;

    // Worker's turn if POSTER made the last move on a PENDING bid
    const isWorkerTurn = lastTurnBy === UserRole.POSTER && currentStatus === 'PENDING';

    const acceptedBid = liveJob.acceptedBidId ? liveJob.bids.find(b => b.id === liveJob.acceptedBidId) : null;
    const myBidStatus = liveJob.myBidStatus || myBid?.status;

    const isAcceptedWorker = (
        (currentStatus === 'ACCEPTED') || // Simple check first (matches JobCard)
        (liveJob.acceptedBidId && acceptedBid && user.id === acceptedBid.workerId) ||
        (liveJob.workerId === user.id)
    );
    const isParticipant = user.id === liveJob.posterId || isAcceptedWorker;

    const handleSubmitCounter = async () => {
        if (!user.id || !myBid || !onReplyToCounter || !counterAmount || isProcessing) return;

        const amount = parseInt(counterAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert(t.alertInvalidAmount, 'error');
            return;
        }

        setIsProcessing(true);
        try {
            await onReplyToCounter(liveJob.id, myBid.id, 'COUNTER', amount);
            setShowCounterInput(false);
            setCounterAmount('');
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    // Minimum distance for a swipe to be registered
    const minSwipeDistance = 75;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none md:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg pointer-events-auto transition-opacity" onClick={onClose} />
            <div
                className="w-full h-full md:w-[95vw] md:h-[90vh] bg-white dark:bg-gray-950 md:rounded-[2.5rem] p-0 pointer-events-auto animate-in slide-in-from-right duration-300 relative overflow-hidden flex flex-col md:flex-row transition-all shadow-2xl pb-safe md:pb-0 border-0 md:border border-white/10 dark:border-gray-800/50"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Navigation: Back Button (Top Left) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-50 p-2.5 bg-gray-100/50 dark:bg-black/20 backdrop-blur-md rounded-full text-gray-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-90 border border-white/20 shadow-sm"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>

                <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    {/* Compact Header Section - Added Top Margin for Back Button */}
                    <div className="mb-4 mt-12">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${liveJob.status === 'OPEN' ? 'bg-emerald-500 text-white' : liveJob.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                                {String(liveJob.status || 'UNKNOWN').replace('_', ' ')}
                            </span>
                            <span className="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800/50 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                                {liveJob.category || 'General'}
                            </span>
                        </div>
                        <h1 className="text-lg md:text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{liveJob.title}</h1>
                    </div>

                    {/* Immersive Headerless Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500 dark:text-gray-400 mb-6 px-1">
                        <span className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold">
                            <Clock size={14} className="text-emerald-500" />
                            {liveJob.duration} Days
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <span className="flex items-center gap-1.5">
                            <MapPin size={14} />
                            {liveJob.location}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <span>Posted {new Date(liveJob.jobDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800 w-full mb-6" />

                    {/* Job Image - Constrained Height */}
                    {liveJob.image && (
                        <div className="relative group/img overflow-hidden rounded-2xl border-2 border-white dark:border-gray-900 shadow-md h-48 md:h-64 bg-gray-100 dark:bg-gray-800">
                            <img src={liveJob.image} alt="Job Context" className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        </div>
                    )}

                    {/* Clean Description Section - Tighter Top Margin */}
                    <div className="py-2">
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-2 flex items-center gap-3">
                            <div className="w-1.5 h-3 bg-gray-200 dark:bg-gray-800 rounded-full" />
                            {t.description}
                        </h4>
                        <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800">

                            <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-medium leading-relaxed">
                                {liveJob.description}
                            </p>
                        </div>
                    </div>

                    {/* Reviews Breakdown for Completed Jobs */}
                    {liveJob.status === JobStatus.COMPLETED && liveJob.reviews && liveJob.reviews.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4 ml-1 flex items-center gap-3">
                                <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                                {language === 'en' ? 'Reviews & Feedback' : 'समीक्षा और फीडबैक'}
                            </h4>
                            <div className="space-y-4">
                                {liveJob.reviews.map((review, idx) => (
                                    <div key={review.id || idx} className="bg-white/50 dark:bg-gray-950 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="font-black text-gray-900 dark:text-white text-sm">{review.reviewerName}</p>
                                            <div className="flex gap-1 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800/50">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={10}
                                                        className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 italic font-medium leading-relaxed">"{review.comment}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Compact Profile Row */}
                    <div
                        className="md:hidden flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-emerald-500/50 transition-all shadow-sm"
                        onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                                {liveJob.posterPhoto ? (
                                    <img src={liveJob.posterPhoto} alt={liveJob.posterName || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle size={24} />
                                )}
                            </div>
                            <div>
                                <p className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    {liveJob.posterName || 'User'}
                                    <ExternalLink size={12} className="text-gray-300" />
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {liveJob.posterRating && liveJob.posterRating > 0 && (
                                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 dark:text-amber-400">
                                            <Star size={10} fill="currentColor" /> {liveJob.posterRating.toFixed(1)}
                                        </span>
                                    )}
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                        Member since {new Date(liveJob.createdAt).getFullYear()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                            <ChevronRight size={16} strokeWidth={3} />
                        </div>
                    </div>

                    {/* Interactive Map Preview */}
                    {liveJob.coordinates && (
                        <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-gray-950 h-64 shadow-2xl group/map z-0">
                            <LeafletMap lat={liveJob.coordinates.lat} lng={liveJob.coordinates.lng} popupText={liveJob.location} />
                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${liveJob.coordinates.lat},${liveJob.coordinates.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto w-fit bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all pointer-events-auto z-[400]"
                                >
                                    <Navigation size={14} fill="currentColor" /> Directions
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Bids Breakdown for Poster */}
                    {role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                    {t.bidsReceived} ({liveJob.bids.length})
                                </h4>
                                <button onClick={() => onViewBids(liveJob)} className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline">View All</button>
                            </div>
                            <div className="space-y-3">
                                {liveJob.bids.slice(0, 3).map(bid => (
                                    <div key={bid.id} onClick={() => onViewBids(liveJob)} className="bg-white/50 dark:bg-gray-900/50 rounded-[2rem] p-4 flex items-center gap-4 border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-emerald-500/50 hover:bg-white dark:hover:bg-gray-900 transition-all group">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 shadow-sm">
                                            {bid.workerPhoto ? <img src={bid.workerPhoto} alt={bid.workerName} className="w-full h-full object-cover" /> : <UserCircle size={40} className="text-gray-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-gray-900 dark:text-white truncate text-sm">{bid.workerName}</p>
                                                {bid.status === 'PENDING' && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">
                                                <Star size={10} className="fill-amber-400 text-amber-400" />
                                                <span>{bid.workerRating?.toFixed(1) || '5.0'}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <span className="truncate">{bid.workerLocation}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">₹{bid.amount}</p>
                                            <button className="mt-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-[9px] font-black uppercase tracking-widest group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Mobile/Tablet Footer for Actions - OUTSIDE ScrollView */}
                <div className="md:hidden px-8 py-6 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shrink-0 z-30">
                    <div className="flex gap-4">
                        {/* Budget Display - RESTORED */}
                        {!myBid && liveJob.status === JobStatus.OPEN && (
                            <div className="flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t.budget}</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">₹{liveJob.budget}</p>
                            </div>
                        )}

                        {/* Worker: Bid Action OR Hired View */}
                        {!isAuthLoading && role === UserRole.WORKER && (
                            <>
                                {liveJob.status === JobStatus.OPEN && liveJob.posterId !== user.id && !myBid && (
                                    <button
                                        onClick={() => onBid(liveJob.id)}
                                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {t.bidNow} <ChevronRight size={18} strokeWidth={3} />
                                    </button>
                                )}

                            </>
                        )}



                        {/* Worker: Negotiation Actions (Mobile) */}
                        {!isAuthLoading && role === UserRole.WORKER && myBid && liveJob.status === JobStatus.OPEN && (
                            isWorkerTurn ? (
                                <div className="flex w-full gap-2">
                                    <button
                                        onClick={() => { if (onReplyToCounter) { onReplyToCounter(liveJob.id, myBid?.id || '', 'ACCEPT'); onClose(); } }}
                                        className="flex-1 bg-emerald-600 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                                    >
                                        <CheckCircle size={16} strokeWidth={3} /> {t.accept || "Accept"}
                                    </button>
                                    <button
                                        onClick={() => setShowCounterInput(true)}
                                        className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.1em] active:scale-95 transition-all flex items-center justify-center gap-1"
                                    >
                                        <Handshake size={16} strokeWidth={3} /> {t.counter || "Counter"}
                                    </button>
                                    <button
                                        onClick={() => { if (confirm(t.withdrawConfirm || "Withdraw your bid?")) { onCancel?.(liveJob.id); onClose(); } }}
                                        className="px-4 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-[1.5rem] font-black active:scale-90 transition-all flex items-center justify-center border border-red-100 dark:border-red-900/30"
                                    >
                                        <X size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 flex gap-3">
                                    <div className="flex-1 bg-blue-500 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2">
                                        <Clock size={16} strokeWidth={3} />
                                        {(myBid.negotiationHistory && myBid.negotiationHistory.length > 0) ? (t.counterSent || "Counter Sent") : (t.pending || "Pending")}: ₹{myBid.amount}
                                    </div>
                                </div>
                            )
                        )}


                        {/* Poster: View Bids */}
                        {!isAuthLoading && role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0 && (
                            <button
                                onClick={() => onViewBids(liveJob)}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                                {t.viewBids} ({liveJob.bids.length})
                            </button>
                        )}

                        {/* Participant Actions: Chat, Completion */}
                        {isParticipant && (liveJob.status === JobStatus.IN_PROGRESS || liveJob.status === JobStatus.COMPLETED) && (
                            <div className="flex w-full gap-4 flex-col">
                                <div className="flex w-full gap-4">
                                    {liveJob.status === JobStatus.COMPLETED ? (
                                        <>
                                            {liveJob.hasMyReview ? (
                                                <div className="flex-1 bg-green-500/10 text-green-600 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-green-500/20">
                                                    <Heart size={16} fill="currentColor" /> Already Reviewed
                                                </div>
                                            ) : (
                                                <button onClick={() => showAlert('Please open Chat to rate user.', 'info')} className="flex-1 bg-amber-400 text-amber-950 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                                    <Star size={18} fill="currentColor" /> {t.rateExperience}
                                                </button>
                                            )}
                                            <button onClick={() => onChat(liveJob)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-all">
                                                {t.chat} (Archived)
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => onChat(liveJob)} className="flex-1 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <MessageCircle size={20} strokeWidth={3} /> {t.chat}
                                            </button>
                                            {/* Call Button for Worker */}
                                            {isAcceptedWorker && liveJob.posterPhone && (
                                                <button
                                                    onClick={() => window.open(`tel:${liveJob.posterPhone}`)}
                                                    className="w-16 bg-emerald-500/10 text-emerald-600 rounded-[1.5rem] font-black shadow-sm flex items-center justify-center active:scale-95 transition-all border border-emerald-500/20"
                                                >
                                                    <Phone size={20} strokeWidth={3} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                {/* Complete Job Button for Poster */}
                                {liveJob.status === JobStatus.IN_PROGRESS && liveJob.posterId === user.id && onCompleteJob && (
                                    <button
                                        onClick={() => {
                                            if (confirm(t.completeJobConfirm || "Mark this job as complete?")) {
                                                onCompleteJob(liveJob);
                                            }
                                        }}
                                        className="w-full bg-blue-600 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                                    >
                                        <CheckCircle size={20} strokeWidth={3} /> {t.markComplete || "Complete Job"}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Administrative Actions: Edit, Delete, Cancel */}
                        {/* Administrative Actions: Edit, Delete, Cancel */}
                        {!isAuthLoading && liveJob.posterId === user.id && (
                            <div className="flex gap-3 ml-auto">
                                {/* Cancel Allowed if IN_PROGRESS OR (OPEN with bids) */}
                                {((liveJob.status === JobStatus.IN_PROGRESS) || (liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0)) && onCancel && (
                                    <button onClick={() => { if (confirm(t.cancelJobRefundPrompt)) onCancel(liveJob.id); }} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-5 rounded-[1.5rem] border-2 border-red-100 dark:border-red-900/50 active:scale-90 transition-all">
                                        <XCircle size={20} />
                                    </button>
                                )}
                                {/* Edit Allowed only if OPEN and NO BIDS */}
                                {liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && (
                                    <button onClick={() => onEdit(liveJob)} className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-5 rounded-[1.5rem] border-2 border-blue-100 dark:border-blue-900/50 active:scale-90 transition-all">
                                        <Pencil size={20} />
                                    </button>
                                )}
                                {/* Delete Allowed only if OPEN and NO BIDS (Strict) */}
                                {liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && (
                                    <button onClick={() => onDelete(liveJob.id)} className="bg-red-500 text-white p-5 rounded-[1.5rem] shadow-xl shadow-red-500/20 active:scale-90 transition-all">
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Sticky Sidebar (Right Panel) - MOVED INSIDE */}
                <div className="hidden md:flex w-[400px] bg-gray-50/50 dark:bg-gray-900/50 border-l border-white/10 dark:border-gray-800/50 flex-col p-8 overflow-y-auto shrink-0 z-20 backdrop-blur-xl h-full">
                    {/* Budget Card */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6 group hover:border-emerald-500/30 transition-all">
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{t.budget}</p>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <IndianRupee size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {liveJob.budget.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Desktop Actions */}
                    {!isAuthLoading && role === UserRole.WORKER && isWorkerTurn && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <Handshake size={18} className="text-amber-500" />
                                Negotiation Active
                            </h3>
                            <button
                                onClick={() => { if (myBid) { onReplyToCounter?.(liveJob.id, myBid.id, 'ACCEPT'); onClose(); } }}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 mb-3 active:scale-95 transition-all"
                            >
                                Accept Offer
                            </button>
                            <button
                                onClick={() => setShowCounterInput(true)}
                                className="w-full py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                            >
                                Counter Offer
                            </button>
                        </div>
                    )}

                    {/* Pending Bid Status (Waiting for Response) */}
                    {!isAuthLoading && role === UserRole.WORKER && myBid && !isWorkerTurn && liveJob.status === JobStatus.OPEN && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-4 uppercase tracking-widest">
                                <Clock size={16} />
                                Status
                            </h3>
                            <div className="w-full py-6 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center gap-2">
                                <span className="font-black text-lg">₹{myBid.amount}</span>
                                <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                                    {(myBid.negotiationHistory && myBid.negotiationHistory.length > 0) ? (t.counterSent || "Counter Offer Sent") : (t.applicationSent || "Application Sent")}
                                </span>
                            </div>
                            <p className="text-xs text-center text-gray-400 mt-4 leading-relaxed">
                                {(myBid.negotiationHistory && myBid.negotiationHistory.length > 0)
                                    ? "Waiting for employer to accept or counter."
                                    : "The employer will be notified of your bid."}
                            </p>
                        </div>
                    )}

                    {/* Poster View: Hired Worker Details (IN_PROGRESS / COMPLETED) */}
                    {!isAuthLoading && role === UserRole.POSTER && liveJob.posterId === user.id && (liveJob.status === JobStatus.IN_PROGRESS || liveJob.status === JobStatus.COMPLETED) && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <CheckCircle size={18} className="text-emerald-500" />
                                {liveJob.status === JobStatus.COMPLETED ? t.jobCompleted || "Job Completed" : "Hired Worker"}
                            </h3>

                            {/* Worker Card */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                    {(acceptedBid?.workerPhoto) ? (
                                        <img src={acceptedBid.workerPhoto} alt="Worker" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle size={24} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-gray-900 dark:text-white text-sm">
                                        {acceptedBid?.workerName || liveJob.hiredWorkerName || "Worker"}
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                        ₹{acceptedBid?.amount || "0"} agreed
                                    </p>
                                </div>
                                {acceptedBid?.workerRating && (
                                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                                        <Star size={10} className="fill-amber-400 text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{acceptedBid.workerRating.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onChat(liveJob)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={16} /> {t.chat}
                                </button>
                                {(acceptedBid?.workerPhone || liveJob.hiredWorkerPhone) && (
                                    <button
                                        onClick={() => window.open(`tel:${acceptedBid?.workerPhone || liveJob.hiredWorkerPhone}`)}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Phone size={16} /> {t.call || "Call"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* General Actions for Desktop (Bid, etc) */}
                    {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.OPEN && liveJob.posterId !== user.id && !myBid && (
                        <button
                            onClick={() => onBid(liveJob.id)}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mb-6"
                        >
                            {t.bidNow} <ChevronRight size={18} strokeWidth={3} />
                        </button>
                    )}

                    {/* Hired Worker: Chat Action in Sidebar */}
                    {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.IN_PROGRESS && isAcceptedWorker && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <CheckCircle size={18} className="text-emerald-500" />
                                Assigned to You
                            </h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => onChat(liveJob)}
                                    className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={18} strokeWidth={2.5} /> {t.chat}
                                </button>
                                {liveJob.posterPhone && (
                                    <button
                                        onClick={() => window.open(`tel:${liveJob.posterPhone}`)}
                                        className="w-14 bg-emerald-500/10 text-emerald-600 rounded-xl font-black shadow-sm flex items-center justify-center active:scale-95 transition-all border border-emerald-500/20 hover:bg-emerald-500/20"
                                    >
                                        <Phone size={20} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* History Status: Completed */}
                    {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.COMPLETED && isAcceptedWorker && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <CheckCircle size={18} className="text-emerald-500" />
                                {t.jobCompleted || "Job Completed"}
                            </h3>
                            <div className="w-full py-6 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center gap-2">
                                <span className="font-black text-lg">₹{myBid?.amount || liveJob.budget}</span>
                                <span className="text-xs font-bold uppercase tracking-widest opacity-80">Earned</span>
                            </div>
                        </div>
                    )}

                    {/* History Status: Cancelled */}
                    {!isAuthLoading && role === UserRole.WORKER && (liveJob.status === JobStatus.CANCELLED || (myBid?.status === 'REJECTED')) && (
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <XCircle size={18} className="text-red-500" />
                                {myBid?.status === 'REJECTED' ? "Application Declined" : "Job Cancelled"}
                            </h3>
                            <div className="w-full py-4 bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-800 flex items-center justify-center text-xs font-bold uppercase tracking-widest opacity-80">
                                {myBid?.status === 'REJECTED' ? "Better luck next time" : "No longer active"}
                            </div>
                        </div>
                    )}

                    <div
                        className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 cursor-pointer group hover:border-emerald-500/50 transition-all shadow-md flex items-center gap-4"
                        onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName, isAcceptedWorker ? liveJob.posterPhone : undefined)}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                            {liveJob.posterPhoto ? (
                                <img src={liveJob.posterPhoto} alt={liveJob.posterName} className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle size={28} className="text-gray-400" />
                            )}
                        </div>
                        <div>
                            <p className="font-black text-gray-900 dark:text-white group-hover:text-emerald-500 transition-colors">{liveJob.posterName}</p>
                            <p className="text-xs text-gray-500">Member since {new Date(liveJob.createdAt).getFullYear()}</p>
                        </div>
                        <ExternalLink size={16} className="text-gray-300 ml-auto group-hover:text-emerald-500 transition-colors" />
                    </div>
                </div>
                {/* Overlay: Counter Input */}
                {showCounterInput && (
                    <div className="absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-6 z-50 animate-slide-up pb-safe">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-lg text-gray-900 dark:text-white">Propose New Amount</h3>
                            <button onClick={() => setShowCounterInput(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <IndianRupee size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="number"
                                    value={counterAmount}
                                    onChange={(e) => setCounterAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-2xl py-4 pl-12 pr-4 font-black text-xl focus:ring-2 focus:ring-emerald-500"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleSubmitCounter}
                                disabled={!counterAmount || isProcessing}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" /> : <>Send Offer <ChevronRight size={18} /></>}
                            </button>
                        </div>
                    </div>
                )}
            </div >
        </div >

    );
};
