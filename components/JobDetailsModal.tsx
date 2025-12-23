import React, { useEffect } from 'react';
import { XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee, UserCircle, Users, ChevronRight, Loader2 } from 'lucide-react';
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
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job, onClose, onBid, onViewBids, onChat, onEdit, onDelete, onCancel, onReplyToCounter, onViewProfile, showAlert
}) => {
    const { user, role, t, language, isAuthLoading } = useUser();
    const { getJobWithFullDetails, jobs } = useJobs();
    const [showCounterInput, setShowCounterInput] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    useEffect(() => {
        if (job?.id) {
            getJobWithFullDetails(job.id, true);
        }
    }, [job?.id]);

    // Use live job data from context if available to handle real-time updates
    const liveJob = jobs.find(j => j.id === job?.id) || job;

    if (!liveJob) return null;

    // Use surgically fetched summary fields if full bids array is still loading
    const myBid = liveJob.bids.find(b => b.workerId === user.id) ||
        (liveJob.myBidId ? { id: liveJob.myBidId, status: liveJob.myBidStatus, amount: liveJob.myBidAmount } as any : null);

    const lastNegotiation = myBid?.negotiationHistory && myBid.negotiationHistory.length > 0
        ? myBid.negotiationHistory[myBid.negotiationHistory.length - 1]
        : null;

    // Fallback to optimized summary field if full bid object isn't loaded yet
    const lastTurnBy = lastNegotiation?.by || liveJob.myBidLastNegotiationBy;
    const currentStatus = myBid?.status || liveJob.myBidStatus;

    const isWorkerTurn = lastTurnBy === UserRole.POSTER && currentStatus === 'PENDING';

    // Check if user is a participant (Poster or Accepted Worker)
    // Using both local bids array and the optimized myBidId/acceptedBidId fields for reliability (Surgical Loading)
    const acceptedBid = liveJob.acceptedBidId ? liveJob.bids.find(b => b.id === liveJob.acceptedBidId) : null;
    const myBidStatus = liveJob.myBidStatus || myBid?.status;

    const isAcceptedWorker = (liveJob.acceptedBidId && myBidStatus !== 'REJECTED' && (
        (acceptedBid && user.id === acceptedBid.workerId) ||
        (liveJob.myBidId && liveJob.myBidId === liveJob.acceptedBidId)
    ));
    const isParticipant = user.id === liveJob.posterId || isAcceptedWorker;

    const handleSubmitCounter = async () => {
        if (!myBid || !onReplyToCounter || !counterAmount || isProcessing) return;

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-pop relative max-h-[90vh] overflow-y-auto transition-colors">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><XCircle size={24} /></button>

                {/* Job Header */}
                <div className="mb-4">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${liveJob.status === 'OPEN' ? 'bg-green-100 text-green-700' : liveJob.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {liveJob.status.replace('_', ' ')}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">{liveJob.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{liveJob.category}</p>
                </div>

                {/* Negotiation Section (for Worker) */}
                {!isAuthLoading && role === UserRole.WORKER && isWorkerTurn && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5 shadow-sm">
                        <h4 className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                            {t.posterCountered}: ₹{myBid!.amount}
                        </h4>

                        {showCounterInput ? (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={counterAmount}
                                    onChange={(e) => setCounterAmount(e.target.value)}
                                    placeholder="Enter ₹"
                                    className="flex-1 p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 outline-none font-bold text-gray-900 dark:text-white"
                                    autoFocus
                                    min="1"
                                />
                                <button onClick={handleSubmitCounter} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm">Send</button>
                                <button onClick={() => setShowCounterInput(false)} className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg">✕</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { if (myBid) { onReplyToCounter?.(liveJob.id, myBid.id, 'ACCEPT'); onClose(); } }}
                                    className="bg-emerald-600 text-white py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all"
                                >
                                    {t.acceptCounter}
                                </button>
                                <button
                                    onClick={() => setShowCounterInput(true)}
                                    className="bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 py-2.5 rounded-xl font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                                >
                                    {t.counterOffer}
                                </button>
                                <button
                                    onClick={() => { if (myBid) { onReplyToCounter?.(liveJob.id, myBid.id, 'REJECT'); onClose(); } }}
                                    className="col-span-2 text-xs text-red-500 dark:text-red-400 font-bold hover:underline py-1"
                                >
                                    {t.declineCounterPrompt}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Job Info */}
                <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={16} className="text-emerald-600" />
                        <span>{liveJob.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <IndianRupee size={16} className="text-amber-500" />
                        <span className="font-bold text-gray-900 dark:text-white">₹{liveJob.budget}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <AlertCircle size={16} className="text-blue-500" />
                        <span>{new Date(liveJob.jobDate).toLocaleDateString()} • {liveJob.duration}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t.description}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{liveJob.description}</p>
                </div>

                {/* Image */}
                {liveJob.image && (
                    <div className="mb-4 w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img src={liveJob.image} alt="Job" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Feedbacks/Reviews Section for Completed Jobs */}
                {liveJob.status === JobStatus.COMPLETED && liveJob.reviews && liveJob.reviews.length > 0 && (
                    <div className="mb-5">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">
                            <Star size={16} className="text-amber-500 fill-amber-500" />
                            {language === 'en' ? 'Reviews & Feedback' : 'समीक्षा और फीडबैक'}
                        </h4>
                        <div className="space-y-3">
                            {liveJob.reviews.map((review, idx) => (
                                <div key={review.id || idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{review.reviewerName}</p>
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    size={10}
                                                    className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{review.comment}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Poster Info */}
                <div
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName)}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold overflow-hidden">
                            {liveJob.posterPhoto ? (
                                <img src={liveJob.posterPhoto} alt={liveJob.posterName || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                (liveJob.posterName || 'User').charAt(0)
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                {liveJob.posterName || 'User'}
                                <ExternalLink size={12} className="text-gray-400" />
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Posted {new Date(liveJob.createdAt).toLocaleDateString()}</p>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </div>
                </div>

                {/* Map Location Preview */}
                {
                    liveJob.coordinates && (
                        <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 h-48 relative group z-0">
                            <LeafletMap lat={liveJob.coordinates.lat} lng={liveJob.coordinates.lng} popupText={liveJob.location} />

                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${liveJob.coordinates.lat},${liveJob.coordinates.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-2 rounded-lg shadow-md flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors z-[400]"
                            >
                                <ExternalLink size={14} /> Open Maps
                            </a>
                        </div>
                    )
                }

                {/* Bids Preview (for Poster viewing their OPEN liveJob with bids) */}
                {
                    role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0 && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <Users size={16} className="text-emerald-600" />
                                    {t.bidsReceived} ({liveJob.bids.length})
                                </h4>
                                <button
                                    onClick={() => onViewBids(liveJob)}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline"
                                >
                                    {t.viewAll} <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {liveJob.bids.slice(0, 3).map(bid => (
                                    <div
                                        key={bid.id}
                                        onClick={() => onViewBids(liveJob)}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-emerald-50 dark:hover:bg-gray-700/80 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                            {bid.workerPhoto ? (
                                                <img src={bid.workerPhoto} alt={bid.workerName} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserCircle size={40} className="text-gray-400 dark:text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{bid.workerName}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Star size={10} className="text-amber-500 fill-amber-500" />
                                                <span>{bid.workerRating?.toFixed(1) || '5.0'}</span>
                                                <span className="mx-1">•</span>
                                                <span className="text-gray-400 dark:text-gray-500">{bid.workerLocation}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{bid.amount}</p>
                                            <p className={`text-[10px] font-medium ${bid.status === 'PENDING' ? 'text-blue-500' :
                                                bid.status === 'ACCEPTED' ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'
                                                }`}>
                                                {bid.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {liveJob.bids.length > 3 && (
                                    <button
                                        onClick={() => onViewBids(liveJob)}
                                        className="w-full py-2 text-center text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                    >
                                        +{liveJob.bids.length - 3} {t.moreBids}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Actions */}
                <div className="flex gap-3 flex-wrap">
                    {/* Worker: Bid button */}
                    {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.OPEN && liveJob.posterId !== user.id && !myBid && (
                        <button
                            onClick={() => onBid(liveJob.id)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.bidNow}
                        </button>
                    )}

                    {/* Worker: Pending Bid view if not turn */}
                    {!isAuthLoading && role === UserRole.WORKER && myBid && !isWorkerTurn && liveJob.status === JobStatus.OPEN && (
                        <div className="flex-1 flex gap-2">
                            <div className="flex-1 text-center py-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{t.pending}: ₹{myBid.amount}</p>
                            </div>
                            {/* Hightlight Button for Existing Bid */}
                            {myBid && !myBid.isHighlighted && (
                                <button
                                    onClick={async () => {
                                        if (!confirm(language === 'en' ? 'Highlight your bid for ₹10?' : '₹10 में अपनी बोली हाइलाइट करें?')) return;

                                        const { checkWalletBalance } = await import('../services/paymentService');
                                        const { sufficient } = await checkWalletBalance(user.id, 10);
                                        if (!sufficient) {
                                            showAlert(language === 'en' ? 'Insufficient balance.' : 'कम बैलेंस।', 'error');
                                            return;
                                        }

                                        try {
                                            const { supabase } = await import('../lib/supabase');
                                            const { error } = await supabase.rpc('highlight_bid', { p_bid_id: myBid.id });
                                            if (error) throw error;

                                            showAlert(language === 'en' ? 'Bid Highlighted! ✨' : 'बोली हाइलाइट की गई! ✨', 'success');
                                            // Refresh job details to show update
                                            getJobWithFullDetails(liveJob.id);
                                        } catch (err: any) {
                                            console.error(err);
                                            showAlert('Failed to highlight bid', 'error');
                                        }
                                    }}
                                    className="px-3 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-1"
                                >
                                    <Star size={12} className="fill-current" />
                                    {language === 'en' ? 'Highlight' : 'हाइलाइट'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* ACTION AREA LOADING GUARD */}
                    {isAuthLoading && (
                        <div className="flex-1 flex items-center justify-center py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <Loader2 size={20} className="animate-spin text-emerald-600 mr-2" />
                            <span className="text-sm font-medium text-gray-500">Syncing...</span>
                        </div>
                    )}

                    {/* Poster: View Bids button if there are bids */}
                    {!isAuthLoading && role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0 && (
                        <button
                            onClick={() => onViewBids(liveJob)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.viewBids} ({liveJob.bids.length})
                        </button>
                    )}

                    {/* Chat button for in-progress liveJobs (With isParticipant check) */}
                    {liveJob.status === JobStatus.IN_PROGRESS && isParticipant && (
                        <button
                            onClick={() => onChat(liveJob)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.chat}
                        </button>
                    )}

                    {/* Actions for COMPLETED liveJobs - Participant Only */}
                    {liveJob.status === JobStatus.COMPLETED && isParticipant && (
                        <div className="flex w-full gap-3">
                            <button
                                onClick={() => showAlert('Please open Chat to rate user.', 'info')}
                                className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Star size={18} fill="currentColor" /> {t.rateExperience}
                            </button>
                            <button
                                onClick={() => onChat(liveJob)}
                                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 active:scale-95 transition-all"
                            >
                                {t.chat} (Archived)
                            </button>
                        </div>
                    )}

                    {/* Poster: Cancel Job (with Refund) - only if IN_PROGRESS */}
                    {!isAuthLoading && liveJob.posterId === user.id && liveJob.status === JobStatus.IN_PROGRESS && onCancel && (
                        <button
                            onClick={() => {
                                if (confirm(t.cancelJobRefundPrompt)) {
                                    onCancel(liveJob.id);
                                }
                            }}
                            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> {t.cancelJob}
                        </button>
                    )}

                    {/* Poster: Edit button - only if OPEN and NO bids placed */}
                    {!isAuthLoading && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && (
                        <button
                            onClick={() => onEdit(liveJob)}
                            className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Pencil size={16} /> {t.editJob}
                        </button>
                    )}

                    {/* Poster: Delete button - only if OPEN and no bid accepted */}
                    {!isAuthLoading && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && !liveJob.acceptedBidId && (
                        <button
                            onClick={() => {
                                if (confirm(t.deleteJobPrompt)) {
                                    onDelete(liveJob.id);
                                }
                            }}
                            className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> {t.delete}
                        </button>
                    )}
                </div>
            </div >
        </div >
    );
};
