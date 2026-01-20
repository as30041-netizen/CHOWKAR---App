import React, { useState, useEffect } from 'react';
import { ArrowLeft, LayoutGrid, IndianRupee, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContextDB';
import { useWallet } from '../contexts/WalletContext';
import { useJobs } from '../contexts/JobContextDB';
import { Bid, UserRole } from '../types';
import { enhanceBidMessageStream } from '../services/geminiService';
import { supabase } from '../lib/supabase';

interface BidModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string | null;
    onSuccess: () => void;
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
}



export const BidModal: React.FC<BidModalProps> = ({ isOpen, onClose, jobId, onSuccess, showAlert }) => {
    const {
        user: contextUser,
        t: contextT,
        checkFreeLimit: contextCheckFreeLimit,
        incrementAiUsage: contextIncrementAiUsage,
        language: contextLanguage
    } = useUser();
    const { walletBalance, refreshWallet } = useWallet();
    const { jobs, addBid } = useJobs();
    const navigate = useNavigate();

    const [bidAmount, setBidAmount] = useState('');
    const [bidMessage, setBidMessage] = useState('');
    const [isEnhancingBid, setIsEnhancingBid] = useState(false);

    // FRESH bid check - fetch from API instead of using cached data
    const [existingBid, setExistingBid] = useState<Bid | null>(null);
    const [isCheckingBid, setIsCheckingBid] = useState(false);

    // Add local submitting state to prevent double clicks
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check for existing bid whenever modal opens or user changes
    useEffect(() => {
        if (!isOpen || !jobId || !contextUser.id) {
            setExistingBid(null);
            return;
        }

        const checkExistingBid = async () => {
            setIsCheckingBid(true);
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                console.log('[BidModal] Checking for existing bid - User:', contextUser.id, 'Job:', jobId);

                const session = (await supabase.auth.getSession()).data.session;
                const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${supabaseKey}`;

                const response = await fetch(
                    `${supabaseUrl}/rest/v1/bids?worker_id=eq.${contextUser.id}&job_id=eq.${jobId}`,
                    {
                        method: 'GET',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': authHeader,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    const bids = await response.json();
                    if (bids && bids.length > 0) {
                        console.log('[BidModal] Found existing bid for this user:', bids[0]);
                        setExistingBid({
                            id: bids[0].id,
                            jobId: bids[0].job_id,
                            workerId: bids[0].worker_id,
                            amount: bids[0].amount,
                            status: bids[0].status,
                            message: bids[0].message
                        } as Bid);
                    } else {
                        console.log('[BidModal] No existing bid found for this user');
                        setExistingBid(null);
                    }
                }
            } catch (error) {
                console.error('[BidModal] Error checking existing bid:', error);
                setExistingBid(null);
            } finally {
                setIsCheckingBid(false);
            }
        };

        checkExistingBid();
    }, [isOpen, jobId, contextUser.id]);

    if (!isOpen || !jobId) return null;

    // Get current job for reference (for budget display, etc.)
    const job = jobs.find(j => j.id === jobId);

    const handleEnhanceBid = async () => {
        if (!contextCheckFreeLimit()) return;
        if (!bidMessage.trim()) return;
        if (!job) return;

        setIsEnhancingBid(true);
        await enhanceBidMessageStream(bidMessage, job.title, contextLanguage, (text) => setBidMessage(text));
        setIsEnhancingBid(false);
        contextIncrementAiUsage();
    };

    const handlePlaceBid = async () => {
        if (!jobId || !bidAmount || isSubmitting) return;

        const currentJob = jobs.find(j => j.id === jobId);
        if (!currentJob) return;

        // VALIDATION 0: Check Wallet Balance
        if (walletBalance < 1) {
            showAlert(
                contextLanguage === 'en'
                    ? 'Insufficient coins to place a bid. Cost: 1 Coin.'
                    : 'बोली लगाने के लिए अपर्याप्त सिक्के। लागत: 1 सिक्का।',
                'error'
            );
            return;
        }

        // VALIDATION 1: Check for duplicate bid (using fresh API check)
        if (existingBid) {
            showAlert(
                contextLanguage === 'en'
                    ? 'You have already placed a bid on this job. Wait for the employer to respond.'
                    : 'आपने इस जॉब पर पहले से बोली लगाई है। नियोक्ता की प्रतिक्रिया का इंतजार करें।',
                'error'
            );
            return;
        }

        // VALIDATION 2: Bid amount must be greater than 0
        const amount = parseInt(bidAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert(
                contextLanguage === 'en'
                    ? 'Please enter a valid bid amount greater than ₹0'
                    : 'कृपया ₹0 से अधिक वैध बोली राशि दर्ज करें',
                'error'
            );
            return;
        }

        // VALIDATION 3: Warn (but don't block) if bid exceeds budget
        if (currentJob.budget && amount > currentJob.budget) {
            // This is just a warning - we still proceed with the bid
            console.log(`[BidModal] Warning: Bid ₹${amount} exceeds budget ₹${currentJob.budget}`);
        }

        setIsSubmitting(true);

        const newBid: Bid = {
            id: `b${Date.now()}`,
            jobId: currentJob.id,
            posterId: currentJob.posterId,
            workerId: contextUser.id,
            workerName: contextUser.name,
            workerPhone: contextUser.phone || '',
            workerRating: contextUser.rating,
            workerLocation: contextUser.location || '',
            workerCoordinates: contextUser.coordinates,
            workerPhoto: contextUser.profilePhoto,
            amount: parseInt(bidAmount),
            message: bidMessage,
            createdAt: Date.now(),
            status: 'PENDING',
            // Fresh bids should have empty negotiation history - it only gets populated when counter-offers happen
            negotiationHistory: []
        };

        try {
            await addBid(newBid);

            showAlert(contextT.alertBidPlaced, 'success');

            onSuccess();
            onClose();
            // Refresh wallet to visually deduct the coin
            refreshWallet();
            // Reset state
            setBidAmount('');
            setBidMessage('');
        } catch (err: any) {
            console.error('Bid Error:', err);
            const msg = err.message || '';
            if (msg.includes('Job is closed') || msg.includes('no longer accepting')) {
                showAlert(contextLanguage === 'en' ? 'Job is closed or no longer accepting bids.' : 'यह जॉब बंद हो गया है।', 'error');
            } else {
                showAlert(msg, 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRecharge = () => {
        if (jobId) {
            sessionStorage.setItem('pendingBidJobId', jobId);
        }
        onClose();
        navigate('/wallet');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center pointer-events-none sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300"
                onClick={onClose}
            />
            <div className="w-full md:w-[480px] bg-white dark:bg-gray-950 md:rounded-[2.5rem] rounded-t-[2.5rem] pointer-events-auto animate-in slide-in-from-bottom duration-300 relative shadow-2xl flex flex-col max-h-[90vh] pb-safe">

                {/* Mobile Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-8 pt-6 pb-2 shrink-0 flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            {contextT.placeBid}
                        </h3>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1">
                            {job?.title}
                        </p>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto px-8 py-4 space-y-8">

                    {/* Existing Bid Warning */}
                    {!isCheckingBid && existingBid && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-4 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 dark:text-amber-400 shrink-0">
                                <IndianRupee size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-1">Active Bid</p>
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 leading-snug">
                                    {contextLanguage === 'en'
                                        ? `You placed a bid of ₹${existingBid.amount}. Status: ${existingBid.status}`
                                        : `आपने ₹${existingBid.amount} की बोली लगाई है। स्थिति: ${existingBid.status}`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Offer Input Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{contextT.yourOffer}</label>
                            {job && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                                    Budget: ₹{job.budget}
                                </span>
                            )}
                        </div>

                        <div className="relative group">
                            <input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                className="w-full text-5xl font-black text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-100 dark:border-gray-800 focus:border-emerald-500 outline-none py-4 pl-8 placeholder-gray-200 dark:placeholder-gray-800 transition-all font-mono tracking-tighter"
                                placeholder="0"
                                min="1"
                                autoFocus
                            />
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-500">₹</span>
                        </div>
                    </div>

                    {/* Message Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{contextT.msgToEmployer}</label>

                            <button
                                onClick={handleEnhanceBid}
                                disabled={isEnhancingBid}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
                            >
                                {isEnhancingBid ? <Loader2 size={10} className="animate-spin" /> : <LayoutGrid size={10} />}
                                {contextLanguage === 'en' ? 'AI Polish' : 'AI सुधारें'}
                            </button>
                        </div>

                        <div className="relative">
                            <textarea
                                value={bidMessage}
                                onChange={(e) => setBidMessage(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-emerald-500/50 focus:shadow-lg focus:shadow-emerald-500/5 outline-none resize-none transition-all h-32 leading-relaxed"
                                placeholder={contextT.bidMessagePlaceholder}
                                maxLength={500}
                            />
                            <div className="absolute bottom-3 right-3 text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
                                {bidMessage.length}/500
                            </div>
                        </div>
                    </div>

                    {/* Cost Info */}
                    <div className="flex items-center justify-between py-2 text-xs font-medium text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-4">
                        <span>Cost to bid</span>
                        <div className={`flex items-center gap-1.5 font-bold ${walletBalance < 1 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            1 Coin
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="font-normal text-gray-400">Bal: {walletBalance}</span>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-8 pt-4 pb-safe bg-white dark:bg-gray-950 md:rounded-b-[2.5rem]">
                    {walletBalance < 1 ? (
                        <button
                            onClick={handleRecharge}
                            className="w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/20 hover:shadow-orange-500/40"
                        >
                            <IndianRupee size={18} />
                            {contextLanguage === 'en' ? 'Recharge Wallet (1 Coin)' : 'वॉलेट रिचार्ज करें (1 सिक्का)'}
                        </button>
                    ) : (
                        <button
                            onClick={handlePlaceBid}
                            disabled={!!existingBid || isSubmitting}
                            className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${existingBid
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20 hover:shadow-emerald-500/40'
                                }`}
                        >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {existingBid
                                ? (contextLanguage === 'en' ? 'Bid Placed' : 'बोली लगी')
                                : contextT.sendBid
                            }
                        </button>
                    )}
                    {walletBalance < 1 && (
                        <p className="text-center text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-3 uppercase tracking-widest">
                            {contextLanguage === 'en' ? 'Low Balance Requires Top-up' : 'कम बैलेंस - रिचार्ज करें'}
                        </p>
                    )}
                </div>

            </div >
        </div >
    );
};
