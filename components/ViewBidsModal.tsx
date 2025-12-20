import React, { useState, useEffect } from 'react';
import { XCircle, UserCircle, Star } from 'lucide-react';
import { Job, UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';
import { useJobs } from '../contexts/JobContextDB';
import { getAppConfig } from '../services/paymentService';

interface ViewBidsModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job | null;
    onCounter: (bidId: string, amount: number) => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ViewBidsModal: React.FC<ViewBidsModalProps> = ({ isOpen, onClose, job, onCounter, showAlert }) => {
    const { user, t, addNotification, language } = useUser();
    const [isAcceptingBid, setIsAcceptingBid] = useState(false);
    const [connectionFee, setConnectionFee] = useState(20);
    const [localJob, setLocalJob] = useState<Job | null>(job);

    // Update local job when prop changes
    useEffect(() => {
        if (job) {
            setLocalJob(job);
        }
    }, [job]);

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
                async (payload) => {
                    console.log('[ViewBidsModal] Bid change detected:', payload.eventType, payload);

                    if (payload.eventType === 'INSERT' && payload.new) {
                        // Fetch full bid details with worker info
                        const { data: fullBid } = await supabase
                            .from('bids')
                            .select(`
                                *,
                                worker:profiles!bids_worker_id_fkey(name, phone, rating, profile_photo, location, latitude, longitude)
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (fullBid && localJob) {
                            const newBid = {
                                id: fullBid.id,
                                jobId: fullBid.job_id,
                                workerId: fullBid.worker_id,
                                workerName: fullBid.worker?.name || 'Worker',
                                workerPhone: fullBid.worker?.phone || '',
                                workerRating: fullBid.worker?.rating || 5.0,
                                workerLocation: fullBid.worker?.location || '',
                                workerPhoto: fullBid.worker?.profile_photo,
                                amount: fullBid.amount,
                                message: fullBid.message,
                                status: fullBid.status,
                                negotiationHistory: fullBid.negotiation_history || [],
                                createdAt: new Date(fullBid.created_at).getTime()
                            };

                            // Add new bid to local state
                            setLocalJob(prev => {
                                if (!prev) return prev;
                                // Check if bid already exists to avoid duplicates
                                const exists = prev.bids.some(b => b.id === newBid.id);
                                if (exists) return prev;

                                return {
                                    ...prev,
                                    bids: [...prev.bids, newBid]
                                };
                            });

                            console.log('[ViewBidsModal] New bid added:', newBid.id);
                        }
                    } else if (payload.eventType === 'UPDATE' && payload.new) {
                        setLocalJob(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                bids: prev.bids.map(bid =>
                                    bid.id === payload.new.id
                                        ? {
                                            ...bid,
                                            amount: payload.new.amount,
                                            status: payload.new.status,
                                            negotiationHistory: payload.new.negotiation_history || bid.negotiationHistory
                                        }
                                        : bid
                                )
                            };
                        });
                        console.log('[ViewBidsModal] Bid updated:', payload.new.id);
                    } else if (payload.eventType === 'DELETE' && payload.old) {
                        setLocalJob(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                bids: prev.bids.filter(bid => bid.id !== payload.old.id)
                            };
                        });
                        console.log('[ViewBidsModal] Bid deleted:', payload.old.id);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[ViewBidsModal] Subscription status:', status);
            });

        return () => {
            console.log('[ViewBidsModal] Cleaning up subscription for job:', job.id);
            supabase.removeChannel(channel);
        };
    }, [isOpen, job?.id]);

    // Load connection fee from admin config
    useEffect(() => {
        getAppConfig().then(config => setConnectionFee(config.connection_fee));
    }, []);

    if (!isOpen || !localJob) return null;

    const handleAcceptBid = async (jobId: string, bidId: string, bidAmount: number, workerId: string) => {
        // NO WALLET CHECK NEEDED - Poster already paid when posting
        setIsAcceptingBid(true);
        try {
            // 1. Accept Bid (RPC - no fees anymore)
            const { error } = await supabase.rpc('accept_bid', {
                p_job_id: jobId, p_bid_id: bidId, p_poster_id: user.id, p_worker_id: workerId, p_amount: bidAmount, p_poster_fee: 0
            });
            if (error) throw error;

            // 2. Notify accepted worker - they need to pay to unlock chat
            await addNotification(
                workerId,
                "Bid Accepted",
                `Congratulations! Your bid for "${job.title}" was accepted. Unlock chat for ₹${connectionFee} to start working!`,
                "SUCCESS",
                jobId
            );

            // 3. Notify REJECTED workers
            const otherBids = job.bids.filter(b => b.id !== bidId);
            for (const rejectedBid of otherBids) {
                await addNotification(
                    rejectedBid.workerId,
                    "Bid Not Selected",
                    `Another worker was selected for "${job.title}". Keep bidding on other jobs!`,
                    "INFO",
                    jobId
                );
            }

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
                    location: job.location
                };
                const channel = supabase.channel('job_system_hybrid_sync');
                await channel.subscribe();
                await channel.send({
                    type: 'broadcast',
                    event: 'job_updated',
                    payload: updatedJobPayload
                });
            } catch (broadcastErr) {
                console.warn('[ViewBids] Job broadcast failed:', broadcastErr);
            }

            onClose();
            showAlert(language === 'en' ? 'Bid accepted! Waiting for worker to unlock chat.' : 'बोली स्वीकार! कर्मचारी के चैट खोलने की प्रतीक्षा करें।', 'success');
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

            // Delete bid from database
            const { error } = await supabase.from('bids').delete().eq('id', bidId);
            if (error) throw error;

            // Notify the worker
            await addNotification(
                workerId,
                "Bid Rejected",
                `Your bid for "${localJob?.title}" was not selected. Keep trying on other jobs!`,
                "WARNING",
                jobId
            );

            // Send push notification to worker
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                        body: JSON.stringify({
                            userId: workerId,
                            title: 'Bid Rejected',
                            body: `Your bid was not selected for "${localJob?.title}"`,
                            data: { jobId, type: 'bid_rejected' }
                        })
                    });
                }
            } catch (pushErr) { console.warn('[Push] Failed:', pushErr); }

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

    // Sort bids: newest first
    const sortedBids = [...(localJob.bids || [])].sort((a, b) =>
        (b.createdAt || 0) - (a.createdAt || 0)
    );

    // language is now from context

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-0 relative z-10 max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Bids for {localJob.title}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">({localJob.bids?.length || 0})</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><XCircle size={24} className="text-gray-500 dark:text-gray-400" /></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {sortedBids.length > 0 ? (
                        sortedBids.map(bid => {
                            const isNew = isNewBid(bid.createdAt || 0);
                            return (
                                <div
                                    key={bid.id}
                                    className={`bg-white dark:bg-gray-800 border rounded-xl p-4 shadow-sm relative transition-all duration-300 ${isNew
                                        ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900/30 animate-pulse-once'
                                        : 'border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    {/* NEW Badge */}
                                    {isNew && (
                                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-bounce">
                                            NEW
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                                            {bid.workerPhoto ? <img src={bid.workerPhoto} className="w-full h-full object-cover" /> : <UserCircle size={40} className="text-gray-400 dark:text-gray-500" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{bid.workerName}</h4>
                                            <div className="flex items-center gap-1 text-xs text-yellow-600 font-bold"><Star size={12} fill="currentColor" /> {bid.workerRating}</div>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{bid.amount}</div>
                                            <div className={`text-[10px] ${isNew ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {getRelativeTime(bid.createdAt || Date.now())}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg mb-3 italic">"{bid.message}"</p>

                                    {/* Awaiting Response Indicator */}
                                    {bid.negotiationHistory && bid.negotiationHistory.length > 0 && bid.status === 'PENDING' && (() => {
                                        const lastCounter = bid.negotiationHistory[bid.negotiationHistory.length - 1];
                                        const isPosterViewing = user.id === localJob?.posterId;
                                        const lastCounterByWorker = lastCounter.by === UserRole.WORKER;
                                        const lastCounterByPoster = lastCounter.by === UserRole.POSTER;
                                        const recentCounter = lastCounter.timestamp && (Date.now() - lastCounter.timestamp < 86400000); // Within 24 hours

                                        if (isPosterViewing && lastCounterByWorker && recentCounter) {
                                            return (
                                                <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex items-center gap-2">
                                                    <span className="text-blue-600 dark:text-blue-400">📩</span>
                                                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Worker countered - awaiting your response</span>
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
                                        <p className="text-[10px] text-gray-400 mb-3 flex items-center gap-1">
                                            🔒 Contact details visible after accepting this bid
                                        </p>
                                    )}

                                    {/* Negotiation History */}
                                    {bid.negotiationHistory && bid.negotiationHistory.length > 1 && (
                                        <div className="mb-3 pl-3 border-l-2 border-gray-200 space-y-2">
                                            <div className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Negotiation History</div>
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
                                                            <span className="text-[10px] text-gray-400">
                                                                {getRelativeTime(h.timestamp)}
                                                            </span>
                                                        )}
                                                        {i === bid.negotiationHistory!.length - 1 && (
                                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">(Latest)</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {user.id === localJob?.posterId && bid.status === 'PENDING' && (
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAcceptBid(localJob!.id, bid.id, bid.amount, bid.workerId)}
                                                disabled={isAcceptingBid}
                                                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold text-sm shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                                            >
                                                {isAcceptingBid ? 'Accepting...' : 'Accept'}
                                            </button>
                                            <button onClick={() => onCounter(bid.id, bid.amount)} className="flex-1 bg-white dark:bg-gray-700 border border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 dark:hover:bg-gray-600 transition-colors">
                                                Counter
                                            </button>
                                            <button
                                                onClick={() => handleRejectBid(localJob!.id, bid.id, bid.workerName, bid.workerId)}
                                                className="px-3 bg-white dark:bg-gray-700 border border-red-400 dark:border-red-500 text-red-500 dark:text-red-400 py-2 rounded-lg font-bold text-sm hover:bg-red-50 dark:hover:bg-gray-600 transition-colors"
                                                title="Reject this bid"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : <p className="text-center text-gray-400 py-8">No bids yet.</p>}
                </div>
            </div>
        </div>
    );
};
