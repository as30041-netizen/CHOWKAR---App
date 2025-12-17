import React, { useState } from 'react';
import { XCircle, LayoutGrid } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { WORKER_COMMISSION_RATE } from '../constants';
import { Bid, UserRole } from '../types';
import { enhanceBidMessageStream } from '../services/geminiService';

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

    const handlePlaceBid = async () => {
        if (!jobId || !bidAmount) return;

        // Commission calculation for display/logic (deduction happens on acceptance/completion typically)
        // We allow bidding even with low balance, but they must top up before effective acceptance if required.

        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        const newBid: Bid = {
            id: `b${Date.now()}`,
            jobId: job.id,
            posterId: job.posterId,
            workerId: contextUser.id,
            workerName: contextUser.name,
            workerPhone: contextUser.phone,
            workerRating: contextUser.rating,
            workerLocation: contextUser.location,
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
            // We need to notify the poster. `addNotification` is from useUser context.
            await contextAddNotification(job.posterId, contextT.notifBidReceived, `${contextUser.name}: ₹${bidAmount}`, "INFO", job.id);
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
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-slide-up relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                <h3 className="text-xl font-bold mb-4">{contextT.placeBid}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{contextT.yourOffer}</label>
                        <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-lg" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">{contextT.msgToEmployer}</label>
                        <textarea value={bidMessage} onChange={(e) => setBidMessage(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-24" placeholder={contextT.bidMessagePlaceholder}></textarea>
                        <button onClick={handleEnhanceBid} disabled={isEnhancingBid} className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1 hover:underline">
                            <div className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center"><LayoutGrid size={10} /></div> {isEnhancingBid ? 'Enhancing...' : 'Enhance with AI'}
                        </button>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2">
                        <p className="text-xs text-orange-800">
                            {contextLanguage === 'en'
                                ? `Note: A ${(WORKER_COMMISSION_RATE * 100)}% platform fee (₹${Math.ceil(Number(bidAmount || 0) * WORKER_COMMISSION_RATE)}) will be deducted from your wallet when your bid is accepted.`
                                : `ध्यान दें: आपकी बोली स्वीकार होने पर आपके वॉलेट से ${(WORKER_COMMISSION_RATE * 100)}% प्लेटफॉर्म फीस (₹${Math.ceil(Number(bidAmount || 0) * WORKER_COMMISSION_RATE)}) काट ली जाएगी।`}
                        </p>
                    </div>
                    <button onClick={handlePlaceBid} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700">{contextT.sendBid}</button>
                </div>
            </div>
        </div>
    );
};
