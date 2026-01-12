import React, { useState, useEffect } from 'react';
import { ArrowLeft, XCircle, UserCircle, Star, ExternalLink, Loader2 } from 'lucide-react';
import { Job, UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';
import { useJobs } from '../contexts/JobContextDB';


interface ViewBidsModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job | null;
    onCounter: (bidId: string, amount: number) => void;
    onViewProfile: (userId: string, name?: string) => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ViewBidsModal: React.FC<ViewBidsModalProps> = ({ isOpen, onClose, job, onCounter, onViewProfile, showAlert }) => {
    const { user, t, addNotification, language } = useUser();
    const [isAcceptingBid, setIsAcceptingBid] = useState(false);

    const [localJob, setLocalJob] = useState<Job | null>(job);

    // Use live job data from context for syncing
    const { getJobWithFullDetails } = useJobs();

    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const lastFetchIdRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!isOpen) return; // Optimization: Don't do anything if not open

        console.log('[ViewBidsModal] useEffect triggered', { isOpen, jobId: job?.id, lastFetch: lastFetchIdRef.current });

        if (isOpen && job?.id) {
            // Always fetch when modal opens for a job
            const fetchDetails = async () => {
                console.log('[ViewBidsModal] Fetching details for job:', job.id);
                lastFetchIdRef.current = job.id;

                // Only show loading if we don't already have bids
                if (!job.bids || job.bids.length === 0) {
                    setIsLoadingDetails(true);
                }
                try {
                    const result = await getJobWithFullDetails(job.id, true);
                    console.log('[ViewBidsModal] Got full details:', result?.bids?.length || 0, 'bids');
                } catch (e) {
                    console.error('Failed to fetch details', e);
                    lastFetchIdRef.current = null;
                } finally {
                    setIsLoadingDetails(false);
                }
            };
            fetchDetails();
        }
    }, [isOpen, job?.id, getJobWithFullDetails]);

    // Update local job when prop changes
    useEffect(() => {
        if (job) {
            setLocalJob(job);
        }
    }, [job]);

    // Use a ref to store a debounce timer for real-time updates
    const realtimeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Real-time subscription for this specific job's bids
    // Real-time subscription for this specific job's bids
    useEffect(() => {
        if (!isOpen || !job?.id) return;

        console.log('[ViewBidsModal] Setting up realtime subscription for job:', job.id);

        const channel = supabase
            .channel(`bids_modal_${job.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'bids',
                    filter: `job_id=eq.${job.id}`
                },
                (payload) => {
                    console.log('[ViewBidsModal] Bid change detected via Realtime:', payload.eventType);

                    // DEBOUNCE REFRESH: Instead of fetching individual rows (which might be slow or missing metadata),
                    // we trigger a full refresh of the job details from the cache/server after a short quiet period.
                    if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);

                    realtimeTimeoutRef.current = setTimeout(async () => {
                        console.log('[ViewBidsModal] Refetching job details after Realtime activity...');
                        try {
                            // This uses the optimized feed cache/fetch logic
                            await getJobWithFullDetails(job.id, true);
                        } catch (err) {
                            console.error('[ViewBidsModal] Realtime refresh failed', err);
                        }
                    }, 800);
                }
            )
            .subscribe();

        return () => {
            if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [isOpen, job?.id, getJobWithFullDetails]);



    if (!isOpen || !localJob) return null;

    const handleAcceptBid = async (jobId: string, bidId: string, bidAmount: number, workerId: string) => {
        // NO WALLET CHECK NEEDED - Poster already paid when posting
        setIsAcceptingBid(true);
        try {
            // Use safeRPC to avoid Supabase client hanging after refresh
            const { safeRPC } = await import('../lib/supabase');
            const { error } = await safeRPC('accept_bid', {
                p_job_id: jobId, p_bid_id: bidId, p_poster_id: user.id, p_worker_id: workerId, p_amount: bidAmount, p_poster_fee: 0
            });
            if (error) throw error;

            // Note: DB trigger 'notify_on_bid_accept' handles notifications to:
            // - Accepted worker ("You Got the Job!")
            // - Other bidders ("Job Update - Another worker selected")
            // So we don't need frontend notifications here - prevents duplicates!

            // 4. Broadcast job update for instant real-time sync
            try {
                const updatedJobPayload = {
                    id: jobId,
                    status: 'IN_PROGRESS',
                    accepted_bid_id: bidId,
                    poster_id: job.posterId,
                    title: job.title,
                    description: job.description,
                    category: job.category,
                    budget: job.budget,
                    location: job.location,
                    poster_name: job.posterName,
                    poster_photo: job.posterPhoto,
                    created_at: new Date(job.createdAt).toISOString()
                };
                const channel = supabase.channel('global_sync');
                await channel.send({
                    type: 'broadcast',
                    event: 'job_updated',
                    payload: updatedJobPayload
                });
            } catch (broadcastErr) {
                console.warn('[ViewBids] Job broadcast failed:', broadcastErr);
            }

            onClose();
            showAlert(language === 'en' ? 'Worker hired! Chat is now available.' : 'कामगार को नियुक्त किया! चैट अब उपलब्ध है।', 'success');
        } catch (error: any) {
            console.error("Bid accept error:", error);
            showAlert(`Failed to accept bid: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            setIsAcceptingBid(false);
        }
    };

    // Handle poster rejecting a bid explicitly
    const handleRejectBid = async (jobId: string, bidId: string, workerName: string, workerId: string) => {
        if (!confirm(language === 'en' ? `Reject ${workerName}'s bid? This cannot be undone.` : `${workerName} की बोली अस्वीकार करें?`)) return;

        try {
            // Remove the bid from the job
            setLocalJob(prev => prev ? { ...prev, bids: prev.bids.filter(b => b.id !== bidId) } : prev);

            // 2. SOFT REJECT: Update status instead of deleting to preserve market data
            const { error } = await supabase
                .from('bids')
                .update({ status: 'REJECTED' })
                .eq('id', bidId);

            if (error) throw error;

            // 3. Broadcast update for instant UI update on other clients
            const broadcastChannel = supabase.channel('global_sync');
            broadcastChannel.send({
                type: 'broadcast',
                event: 'bid_updated',
                payload: { id: bidId, job_id: jobId, status: 'REJECTED' }
            });

            // 4. Notify the worker with friendly message (no mention of "rejected")
            await addNotification(
                workerId,
                "Bid Update",
                `The employer chose a different worker for "${localJob?.title}". Don't give up - more jobs await!`,
                "INFO",
                jobId
            );
            // Note: addNotification handles push automatically

            showAlert(language === 'en' ? 'Bid rejected' : 'बोली अस्वीकार', 'info');
        } catch (error: any) {
            console.error("Bid reject error:", error);
            showAlert(`Failed to reject bid: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    // Helper function for relative time display
    const getRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Check if a bid is "new" (less than 1 hour old)
    const isNewBid = (timestamp: number): boolean => {
        return Date.now() - timestamp < 3600000; // 1 hour in ms
    };

    // Sort bids: Newest first
    const sortedBids = [...(localJob.bids || [])].sort((a, b) => {
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    // language is now from context

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] p-0 pointer-events-auto relative shadow-[0_-8px_32px_rgba(0,0,0,0.1)] transition-all max-h-[90vh] overflow-hidden flex flex-col animate-slide-up pb-safe">

                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-gray-900 z-10 sticky top-0">
                    <button onClick={onClose} className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-90 shadow-sm group">
                        <ArrowLeft size={22} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none uppercase tracking-widest text-xs opacity-50 mb-1">Applications</h3>
                        <div className="flex items-center gap-2">
                            <h4 className="font-black text-lg text-gray-900 dark:text-white line-clamp-1">{localJob.title}</h4>
                            <span className="badge badge-success !py-1 !px-2 !text-[10px] !rounded-lg">{localJob.bids?.length || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar">
                    {sortedBids.length > 0 ? (
                        sortedBids.map(bid => {
                            const isNew = isNewBid(bid.createdAt || 0);
                            return (
                                <div
                                    key={bid.id}
                                    className={`relative p-5 rounded-[2.5rem] border-2 transition-all duration-300 shadow-sm ${isNew
                                        ? 'border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-900/10'
                                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50'
                                        }`}
                                >
                                    {/* NEW Badge */}
                                    {isNew && (
                                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-bounce z-10">
                                            NEW
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4 mb-4 cursor-pointer group" onClick={() => onViewProfile(bid.workerId, bid.workerName)}>
                                        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 overflow-hidden ring-4 ring-white dark:ring-gray-900 shadow-md group-hover:scale-110 transition-transform">
                                            {bid.workerPhoto ? <img src={bid.workerPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800"><UserCircle size={28} /></div>}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors flex items-center gap-1.5 pt-0.5">
                                                {bid.workerName}
                                                <ExternalLink size={14} className="text-gray-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </h4>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="flex items-center px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-100 dark:border-amber-800/50">
                                                    <Star size={10} fill="currentColor" className="mr-1" /> {bid.workerRating}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">₹{bid.amount}</div>
                                            <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                                                {getRelativeTime(bid.createdAt || Date.now())}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-2xl mb-4 italic font-medium leading-relaxed border border-gray-100/50 dark:border-gray-800/50 shadow-inner">
                                        "{bid.message}"
                                    </p>

                                    {/* Awaiting Response Indicator */}
                                    {bid.negotiationHistory && bid.negotiationHistory.length > 0 && bid.status === 'PENDING' && (() => {
                                        const lastCounter = bid.negotiationHistory[bid.negotiationHistory.length - 1];
                                        const isPosterViewing = user.id === localJob?.posterId;
                                        const lastCounterByWorker = lastCounter.by === UserRole.WORKER;
                                        const lastCounterByPoster = lastCounter.by === UserRole.POSTER;
                                        const recentCounter = lastCounter.timestamp && (Date.now() - lastCounter.timestamp < 86400000); // Within 24 hours

                                        if (isPosterViewing && lastCounterByWorker && recentCounter) {
                                            const hasAgreed = (lastCounter as any).agreed === true;
                                            return (
                                                <div className={`mb-3 ${hasAgreed ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'} border rounded-lg px-3 py-2 flex items-center gap-2`}>
                                                    <span className={hasAgreed ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}>{hasAgreed ? "🤝" : "📩"}</span>
                                                    <span className={`text-xs ${hasAgreed ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'} font-black`}>
                                                        {hasAgreed ? (language === 'en' ? "Worker agreed to terms! Press 'Accept Bid' to finalize." : "कामगार ने शर्तें मान ली हैं! अंतिम पुष्टि के लिए 'Accept Bid' दबाएं।") : (language === 'en' ? "Worker countered - awaiting your response" : "कामगार ने नया दाम दिया - आपके जवाब का इंतज़ार है")}
                                                    </span>
                                                </div>
                                            );
                                        } else if (!isPosterViewing && lastCounterByPoster && recentCounter) {
                                            return (
                                                <div className="mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2">
                                                    <span className="text-emerald-600 dark:text-emerald-400">📩</span>
                                                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">New counter offer - awaiting your response</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Visibility hint */}
                                    {localJob.status === 'OPEN' && (
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1">
                                            🔒 Contact details visible after accepting this bid
                                        </p>
                                    )}

                                    {/* Negotiation History */}
                                    {bid.negotiationHistory && bid.negotiationHistory.length > 1 && (
                                        <div className="mb-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Negotiation History</div>
                                            {bid.negotiationHistory.map((h, i) => {
                                                const isPosterViewing = user.id === localJob?.posterId;
                                                const isFromWorker = h.by === UserRole.WORKER;
                                                return (
                                                    <div key={i} className="text-xs flex items-center gap-2 flex-wrap">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${isFromWorker ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold" : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 font-bold"}`}>
                                                            {isFromWorker ? (isPosterViewing ? 'Worker' : 'You') : (isPosterViewing ? 'You' : 'Poster')}
                                                        </span>
                                                        <span className="text-gray-700 dark:text-gray-300 font-semibold">₹{h.amount}</span>
                                                        {h.timestamp && (
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                                {getRelativeTime(h.timestamp)}
                                                            </span>
                                                        )}
                                                        {i === bid.negotiationHistory!.length - 1 && (
                                                            <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1 rounded">(Latest)</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {user.id === localJob?.posterId && bid.status === 'PENDING' && (() => {
                                        // Determine whose turn it is
                                        const lastCounter = bid.negotiationHistory && bid.negotiationHistory.length > 0
                                            ? bid.negotiationHistory[bid.negotiationHistory.length - 1]
                                            : null;

                                        // Check if worker agreed to poster's terms
                                        const workerAgreed = lastCounter && lastCounter.by?.toString().toUpperCase() === UserRole.WORKER && (lastCounter as any).agreed === true;

                                        // Poster's turn if: no negotiation yet (fresh bid) OR worker made last move
                                        // Use case-insensitive comparison since DB may have lowercase
                                        const isPostersTurn = !lastCounter || lastCounter.by?.toString().toUpperCase() === UserRole.WORKER;

                                        if (workerAgreed) {
                                            // Worker agreed! Show celebratory HIRE button
                                            return (
                                                <div className="mt-4 space-y-3">
                                                    <button
                                                        onClick={() => handleAcceptBid(localJob!.id, bid.id, bid.amount, bid.workerId)}
                                                        disabled={isAcceptingBid}
                                                        className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isAcceptingBid ? (
                                                            <Loader2 size={20} className="animate-spin" />
                                                        ) : (
                                                            <>🎉 {language === 'en' ? 'Hire Now' : 'नियुक्त करें'} • ₹{bid.amount}</>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectBid(localJob!.id, bid.id, bid.workerName, bid.workerId)}
                                                        className="w-full py-2 text-[10px] text-gray-400 dark:text-gray-500 font-medium hover:text-red-500 transition-colors"
                                                    >
                                                        {language === 'en' ? 'Decline this worker' : 'इस कामगार को अस्वीकार करें'}
                                                    </button>
                                                </div>
                                            );
                                        } else if (isPostersTurn) {
                                            // Poster can Accept, Counter, or Reject
                                            return (
                                                <div className="flex gap-3 mt-4">
                                                    <button
                                                        onClick={() => handleAcceptBid(localJob!.id, bid.id, bid.amount, bid.workerId)}
                                                        disabled={isAcceptingBid}
                                                        className="flex-1 btn btn-primary !py-4 !rounded-2xl shadow-lg font-black uppercase tracking-widest text-xs hover:shadow-emerald-500/20"
                                                    >
                                                        {isAcceptingBid ? (
                                                            <Loader2 size={18} className="animate-spin mx-auto" />
                                                        ) : (
                                                            'Accept Bid'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => onCounter(bid.id, bid.amount)}
                                                        className="flex-1 py-4 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        Counter
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectBid(localJob!.id, bid.id, bid.workerName, bid.workerId)}
                                                        className="w-14 items-center justify-center flex bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-500 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-all"
                                                        title="Reject this bid"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        } else {
                                            // Poster made last move - waiting for worker
                                            return (
                                                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3 flex items-center justify-center gap-2">
                                                    <span className="text-blue-600 dark:text-blue-400">⏳</span>
                                                    <span className="text-xs text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wide">
                                                        {language === 'en' ? 'Waiting for worker\'s response' : 'कामगार के जवाब का इंतज़ार'}
                                                    </span>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            );
                        })
                    ) : isLoadingDetails && (localJob?.bidCount || 0) > 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={32} className="text-emerald-600 animate-spin mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Loading bids...</p>
                        </div>
                    ) : (
                        <p className="text-center text-gray-400 dark:text-gray-500 py-8">No bids yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
