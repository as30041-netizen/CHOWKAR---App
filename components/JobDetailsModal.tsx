import React, { useEffect } from 'react';
import { ArrowLeft, XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee, UserCircle, Users, ChevronRight, Loader2, Clock, Handshake, Trash2, Navigation, CheckCircle } from 'lucide-react';
import { Job, UserRole, JobStatus } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
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
    onViewProfile: (userId: string, name?: string) => void;
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

    useEffect(() => {
        if (job?.id) {
            // Use cache (10s freshness) instead of forcing a DB call every time the modal mounts
            getJobWithFullDetails(job.id);
        }
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

    const isAcceptedWorker = (liveJob.acceptedBidId && myBidStatus !== 'REJECTED' && (
        (acceptedBid && user.id === acceptedBid.workerId) ||
        (liveJob.myBidId && liveJob.myBidId === liveJob.acceptedBidId)
    ));
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto" onClick={onClose} />
            <div className="w-full max-w-4xl bg-white dark:bg-gray-950 rounded-[2rem] p-0 pointer-events-auto animate-slide-up relative max-h-[90vh] overflow-hidden flex flex-col transition-all shadow-2xl pb-safe border border-white/20 dark:border-gray-800/50">

                {/* Header */}
                <div className="px-6 pt-5 pb-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
                    <button onClick={onClose} className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-90 shadow-sm group">
                        <ArrowLeft size={22} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-1 md:w-1.5 h-6 md:h-8 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t.jobDetails || 'Job Details'}</h2>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-6">
                    {/* Job Title & Status */}
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${liveJob.status === 'OPEN' ? 'bg-emerald-500 text-white' : liveJob.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                                {liveJob.status.replace('_', ' ')}
                            </span>
                            <span className="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800/50 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]">
                                {liveJob.category}
                            </span>

                        </div>
                        <h1 className="text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{liveJob.title}</h1>
                    </div>

                    {/* Negotiation Tool (Worker Only) - Ultra Compact */}
                    {!isAuthLoading && role === UserRole.WORKER && isWorkerTurn && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 md:p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Handshake size={14} className="text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">{t.posterCountered}</span>
                                </div>
                                <span className="text-lg md:text-xl font-black text-amber-600 dark:text-amber-400">₹{myBid!.amount}</span>
                            </div>

                            {showCounterInput ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        value={counterAmount}
                                        onChange={(e) => setCounterAmount(e.target.value)}
                                        placeholder="₹"
                                        className="flex-1 bg-white dark:bg-gray-800 border border-emerald-400 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none"
                                        autoFocus
                                        min="1"
                                    />
                                    <button onClick={handleSubmitCounter} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold text-xs active:scale-95">✓</button>
                                    <button onClick={() => setShowCounterInput(false)} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-lg font-bold text-xs active:scale-95">✕</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { if (myBid) { onReplyToCounter?.(liveJob.id, myBid.id, 'ACCEPT'); onClose(); } }}
                                        className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide active:scale-95"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => setShowCounterInput(true)}
                                        className="flex-1 py-2 bg-white dark:bg-gray-800 text-amber-600 border border-amber-400 rounded-lg font-bold text-[10px] uppercase tracking-wide active:scale-95"
                                    >
                                        Counter
                                    </button>
                                    <button
                                        onClick={() => { if (myBid) { onReplyToCounter?.(liveJob.id, myBid.id, 'REJECT'); onClose(); } }}
                                        className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-800 rounded-lg active:scale-95"
                                    >
                                        <XCircle size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info Grid - Responsive 3 cols on desktop */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 p-5 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:border-emerald-500/30 transition-all group">
                            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                                <MapPin size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Location</p>
                                <span className="text-lg font-black text-gray-900 dark:text-white leading-tight block truncate max-w-[140px]">{liveJob.location}</span>
                            </div>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-900/50 p-5 rounded-[1.5rem] border border-amber-100 dark:border-amber-900/30 shadow-sm hover:border-amber-400 transition-all group">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest">{t.budget}</p>
                                <IndianRupee size={16} className="text-amber-500 opacity-50" />
                            </div>
                            <p className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tighter group-hover:scale-105 transition-transform origin-left">₹{liveJob.budget}</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-900/50 p-5 rounded-[1.5rem] border border-blue-100 dark:border-blue-900/30 shadow-sm hover:border-blue-400 transition-all group">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-widest">Duration</p>
                                <Clock size={16} className="text-blue-500 opacity-50" />
                            </div>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight leading-tight group-hover:scale-105 transition-transform origin-left">
                                {new Date(liveJob.jobDate).toLocaleDateString([], { day: 'numeric', month: 'short' })} • {liveJob.duration} days
                            </p>
                        </div>
                    </div>

                    {/* Description Section */}
                    <div>
                        <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4 ml-1 flex items-center gap-3">
                            <div className="w-1.5 h-4 bg-gray-200 dark:bg-gray-800 rounded-full" />
                            {t.description}
                        </h4>
                        <div className="bg-gray-50/50 dark:bg-gray-900/30 p-8 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 shadow-sm leading-relaxed">
                            <p className="text-lg text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-medium">
                                {liveJob.description}
                            </p>
                        </div>
                    </div>

                    {/* Job Image High-end Display */}
                    {liveJob.image && (
                        <div className="relative group/img overflow-hidden rounded-[3rem] border-8 border-white dark:border-gray-900 shadow-2xl">
                            <img src={liveJob.image} alt="Job Context" className="w-full h-auto object-cover transition-transform duration-1000 group-hover/img:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                        </div>
                    )}

                    {/* Reviews Breakdown for Completed Jobs */}
                    {liveJob.status === JobStatus.COMPLETED && liveJob.reviews && liveJob.reviews.length > 0 && (
                        <div>
                            <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4 ml-1 flex items-center gap-3">
                                <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                                {language === 'en' ? 'Reviews & Feedback' : 'समीक्षा और फीडबैक'}
                            </h4>
                            <div className="space-y-4">
                                {liveJob.reviews.map((review, idx) => (
                                    <div key={review.id || idx} className="bg-white/50 dark:bg-gray-950 p-6 rounded-3xl border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="font-black text-gray-900 dark:text-white">{review.reviewerName}</p>
                                            <div className="flex gap-1 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800/50">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-md text-gray-600 dark:text-gray-400 italic font-medium leading-relaxed">"{review.comment}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* High-end Poster Profile Card */}
                    <div
                        className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950 p-6 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 cursor-pointer group hover:border-emerald-500/50 transition-all shadow-glass"
                        onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName)}
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 p-1 shadow-glass group-hover:scale-110 transition-transform group-hover:-rotate-3">
                                <div className="w-full h-full rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-3xl overflow-hidden">
                                    {liveJob.posterPhoto ? (
                                        <img src={liveJob.posterPhoto} alt={liveJob.posterName || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                        (liveJob.posterName || 'User').charAt(0)
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-2xl text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                                    {liveJob.posterName || 'User'}
                                    <ExternalLink size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mt-1">Hiring on Chowkar since {new Date(liveJob.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                <ChevronRight size={24} strokeWidth={3} />
                            </div>
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

                {/* Footer Sticky Actions Area */}
                <div className="px-8 py-6 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="flex gap-4">
                        {/* Worker: Bid Action */}
                        {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.OPEN && liveJob.posterId !== user.id && !myBid && (
                            <button
                                onClick={() => onBid(liveJob.id)}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {t.bidNow} <ChevronRight size={18} strokeWidth={3} />
                            </button>
                        )}


                        {/* Worker: Pending Bid view if NOT their turn (waiting for poster) */}
                        {!isAuthLoading && role === UserRole.WORKER && myBid && !isWorkerTurn && liveJob.status === JobStatus.OPEN && (
                            <div className="flex-1 flex gap-3">
                                <div className="flex-1 bg-blue-500 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2">
                                    <Clock size={18} strokeWidth={3} /> {t.pending}: ₹{myBid.amount}
                                </div>
                            </div>
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
                                            <button onClick={() => showAlert('Please open Chat to rate user.', 'info')} className="flex-1 bg-amber-400 text-amber-950 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                                <Star size={18} fill="currentColor" /> {t.rateExperience}
                                            </button>
                                            <button onClick={() => onChat(liveJob)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-all">
                                                {t.chat} (Archived)
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => onChat(liveJob)} className="flex-1 bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                            <ChevronRight size={20} strokeWidth={3} /> {t.chat}
                                        </button>
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
            </div>
        </div >
    );
};
