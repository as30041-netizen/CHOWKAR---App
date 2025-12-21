import React, { useState, useEffect } from 'react';
import { XCircle, LayoutGrid } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Bid, UserRole } from '../types';
import { enhanceBidMessageStream } from '../services/geminiService';
import { getAppConfig } from '../services/paymentService';

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
        language: contextLanguage,
        addNotification: contextAddNotification
    } = useUser();
    const { jobs, addBid } = useJobs();

    const [bidAmount, setBidAmount] = useState('');
    const [bidMessage, setBidMessage] = useState('');
    const [isEnhancingBid, setIsEnhancingBid] = useState(false);

    if (!isOpen || !jobId) return null;

    const handleEnhanceBid = async () => {
        if (!contextCheckFreeLimit()) return;
        if (!bidMessage.trim()) return;
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        setIsEnhancingBid(true);
        await enhanceBidMessageStream(bidMessage, job.title, contextLanguage, (text) => setBidMessage(text));
        setIsEnhancingBid(false);
        contextIncrementAiUsage();
    };

    // Get current job for reference
    const job = jobs.find(j => j.id === jobId);

    // Check if user already has a bid on this job
    const existingBid = job?.bids.find(b => b.workerId === contextUser.id);

    const handlePlaceBid = async () => {
        if (!jobId || !bidAmount) return;

        const currentJob = jobs.find(j => j.id === jobId);
        if (!currentJob) return;

        // VALIDATION 1: Check for duplicate bid
        const alreadyBid = currentJob.bids.find(b => b.workerId === contextUser.id);
        if (alreadyBid) {
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
            negotiationHistory: [{ amount: parseInt(bidAmount), by: UserRole.WORKER, timestamp: Date.now() }]
        };

        try {
            await addBid(newBid);
            // Note: DB trigger 'on_bid_created' automatically notifies the poster
            // So we don't call addNotification here - prevents duplicate notifications!
            showAlert(contextT.alertBidPlaced, 'success');
            onSuccess();
            onClose();
            // Reset state
            setBidAmount('');
            setBidMessage('');
        } catch {
            showAlert('Failed to place bid. Please try again.', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-pop relative transition-colors">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><XCircle size={24} /></button>
                <h3 className="text-xl font-bold mb-4 dark:text-white">{contextT.placeBid}</h3>
                {/* Show warning if user already bid */}
                {existingBid && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
                        <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                            {contextLanguage === 'en'
                                ? `You already bid ₹${existingBid.amount} on this job. Status: ${existingBid.status}`
                                : `आपने इस जॉब पर ₹${existingBid.amount} बोली लगाई है। स्थिति: ${existingBid.status}`}
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Job Budget Reference */}
                    {job && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3">
                            <p className="text-sm text-emerald-800 dark:text-emerald-300">
                                {contextLanguage === 'en'
                                    ? `Employer's Budget: ₹${job.budget}`
                                    : `नियोक्ता का बजट: ₹${job.budget}`}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{contextT.yourOffer}</label>
                        <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-lg text-gray-900 dark:text-white"
                            placeholder={job ? `₹${job.budget}` : "0"}
                            min="1"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{contextT.msgToEmployer}</label>
                        <textarea
                            value={bidMessage}
                            onChange={(e) => setBidMessage(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-24 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder={contextT.bidMessagePlaceholder}
                            maxLength={500}
                        ></textarea>
                        <div className="flex justify-between items-center mt-1">
                            <button onClick={handleEnhanceBid} disabled={isEnhancingBid} className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline">
                                <div className="w-4 h-4 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center"><LayoutGrid size={10} /></div> {isEnhancingBid ? (contextLanguage === 'en' ? 'Enhancing...' : 'बढ़ा रहा...') : (contextLanguage === 'en' ? 'Enhance with AI' : 'AI से बढ़ाएं')}
                            </button>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{bidMessage.length}/500</span>
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mb-2">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                            {contextLanguage === 'en'
                                ? `Bidding is FREE! If your bid is accepted, you'll pay a small connection fee to unlock chat and contact details.`
                                : `बोली लगाना मुफ्त है! यदि आपकी बोली स्वीकार की जाती है, तो चैट और संपर्क विवरण अनलॉक करने के लिए एक छोटी कनेक्शन फीस का भुगतान करना होगा।`}
                        </p>
                    </div>
                    <button
                        onClick={handlePlaceBid}
                        disabled={!!existingBid}
                        className={`w-full py-3 rounded-xl font-bold shadow-lg transition-colors ${existingBid
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                    >
                        {existingBid
                            ? (contextLanguage === 'en' ? 'Already Bid' : 'पहले से बोली लगाई')
                            : contextT.sendBid
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};
