import React, { useState, useEffect } from 'react';
import { ArrowLeft, XCircle, LayoutGrid, IndianRupee } from 'lucide-react';
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

    const [bidAmount, setBidAmount] = useState('');
    const [bidMessage, setBidMessage] = useState('');
    const [isEnhancingBid, setIsEnhancingBid] = useState(false);

    // FRESH bid check - fetch from API instead of using cached data
    const [existingBid, setExistingBid] = useState<Bid | null>(null);
    const [isCheckingBid, setIsCheckingBid] = useState(false);

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
        if (!jobId || !bidAmount) return;

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
            const realBidId = await addBid(newBid);

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
                showAlert(msg, 'error');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-5 pointer-events-auto animate-slide-up pb-safe relative shadow-lg transition-all">

                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onClose}
                        className="btn-ghost !p-2 rounded-xl !bg-gray-100 dark:!bg-gray-800 text-gray-700 dark:text-gray-300 group"
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <IndianRupee size={22} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {contextT.placeBid}
                    </h3>
                </div>
                {/* Show warning if user already bid (check runs silently in background) */}
                {!isCheckingBid && existingBid && (
                    <div className="badge badge-warning w-full py-3 mb-4 rounded-xl items-start h-auto text-left leading-tight">
                        <p className="font-medium">
                            {contextLanguage === 'en'
                                ? `You already bid ₹${existingBid.amount} on this job. Status: ${existingBid.status}`
                                : `आपने इस जॉब पर ₹${existingBid.amount} बोली लगाई है। स्थिति: ${existingBid.status}`}
                        </p>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Job Budget Reference */}
                    {job && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 p-4 rounded-2xl flex items-center justify-between">
                            <span className="text-[10px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest">Employer's Budget</span>
                            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">₹{job.budget}</span>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1 block">{contextT.yourOffer}</label>
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-xl group-focus-within:scale-110 transition-transform">₹</span>
                            <input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                className="input-base !pl-12 !py-4 !text-xl font-black text-emerald-600 dark:text-emerald-400 !bg-gray-50 dark:!bg-gray-800/50 !rounded-2xl border-transparent focus:!border-emerald-500/50 focus:!shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all"
                                placeholder={job ? `${job.budget}` : "0"}
                                min="1"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block px-1">{contextT.msgToEmployer}</label>
                        <textarea
                            value={bidMessage}
                            onChange={(e) => setBidMessage(e.target.value)}
                            className="input-base input-focus h-28"
                            placeholder={contextT.bidMessagePlaceholder}
                            maxLength={500}
                        ></textarea>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <button onClick={handleEnhanceBid} disabled={isEnhancingBid} className="btn-ghost !p-0 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 group">
                                <div className="p-1 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg group-hover:scale-110 transition-transform"><LayoutGrid size={12} /></div>
                                <span className="text-xs font-bold">{isEnhancingBid ? (contextLanguage === 'en' ? 'Enhancing...' : 'बढ़ा रहा...') : (contextLanguage === 'en' ? 'Enhance with AI' : 'AI से बढ़ाएं')}</span>
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{bidMessage.length}/500</span>
                        </div>
                    </div>
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 p-4 rounded-2xl flex justify-between items-center">
                        <p className="text-[11px] font-bold text-blue-700/80 dark:text-blue-400/80 leading-relaxed max-w-[70%]">
                            {contextLanguage === 'en'
                                ? `Bidding costs 1 Coin. Once accepted, you can chat directly.`
                                : `बोली लगाने की लागत 1 सिक्का है। स्वीकार होने पर आप चैट कर सकते हैं।`}
                        </p>
                        <div className={`text-xs font-black px-3 py-1.5 rounded-lg border flex items-center gap-1 ${walletBalance < 1 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            <span>🪙</span>
                            <span>{walletBalance}</span>
                        </div>
                    </div>

                    <button
                        onClick={handlePlaceBid}
                        disabled={!!existingBid || walletBalance < 1}
                        className={`btn w-full mt-4 !py-5 !rounded-2xl font-black uppercase tracking-[0.2em] transition-all text-sm shadow-xl ${existingBid
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'btn-primary shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 active:scale-95'
                            }`}
                    >
                        {existingBid
                            ? (contextLanguage === 'en' ? 'Already Bid' : 'पहले से बोली लगाई')
                            : contextT.sendBid
                        }
                    </button>
                </div>
            </div >
        </div >
    );
};
