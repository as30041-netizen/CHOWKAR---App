import React, { useState } from 'react';
import { XCircle, UserCircle, Star } from 'lucide-react';
import { Job, UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { POSTER_FEE } from '../constants';
import { supabase } from '../lib/supabase'; // Direct supabase usage as per original App.tsx
import { useJobs } from '../contexts/JobContextDB'; // Need context to refresh wallet if needed, though props might suffice

interface ViewBidsModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job | null;
    onCounter: (bidId: string, amount: number) => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ViewBidsModal: React.FC<ViewBidsModalProps> = ({ isOpen, onClose, job, onCounter, showAlert }) => {
    const { user, t, addNotification, refreshUser } = useUser();
    const [isAcceptingBid, setIsAcceptingBid] = useState(false);

    if (!isOpen || !job) return null;

    const handleAcceptBid = async (jobId: string, bidId: string, bidAmount: number, workerId: string) => {
        if (user.walletBalance < POSTER_FEE) {
            showAlert(`${t.alertInsufficientBalance}${POSTER_FEE}`, 'error');
            return;
        }

        setIsAcceptingBid(true);
        try {
            const { error } = await supabase.rpc('accept_bid', {
                p_job_id: jobId, p_bid_id: bidId, p_poster_id: user.id, p_worker_id: workerId, p_amount: bidAmount, p_poster_fee: POSTER_FEE
            });
            if (error) throw error;

            // Refresh user wallet immediately to show new balance
            await refreshUser();

            onClose();
            await addNotification(workerId, t.notifBidAccepted, t.notifBidAcceptedBody, "SUCCESS", jobId);
            showAlert(t.contactUnlocked, 'success');
        } catch (error: any) {
            console.error("Bid accept error:", error);
            showAlert(`Failed to accept bid: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            setIsAcceptingBid(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-lg rounded-3xl p-0 relative z-10 max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg">Bids for {job.title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={24} className="text-gray-500" /></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {job.bids && job.bids.length > 0 ? (
                        job.bids.map(bid => (
                            <div key={bid.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden">
                                        {bid.workerPhoto ? <img src={bid.workerPhoto} className="w-full h-full object-cover" /> : <UserCircle size={40} className="text-gray-400" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{bid.workerName}</h4>
                                        <div className="flex items-center gap-1 text-xs text-yellow-600 font-bold"><Star size={12} fill="currentColor" /> {bid.workerRating}</div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-xl font-black text-emerald-600">₹{bid.amount}</div>
                                        <div className="text-[10px] text-gray-400">{new Date(bid.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-3 italic">"{bid.message}"</p>

                                {/* Negotiation History */}
                                {bid.negotiationHistory && bid.negotiationHistory.length > 1 && (
                                    <div className="mb-3 pl-3 border-l-2 border-gray-200 space-y-2">
                                        {bid.negotiationHistory.map((h, i) => (
                                            <div key={i} className="text-xs">
                                                <span className={h.by === UserRole.WORKER ? "text-blue-600 font-bold" : "text-emerald-600 font-bold"}>{h.by}: </span>
                                                <span className="text-gray-700">₹{h.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {user.id === job?.posterId && bid.status === 'PENDING' && (
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => handleAcceptBid(job!.id, bid.id, bid.amount, bid.workerId)} disabled={isAcceptingBid} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold text-sm shadow-md hover:bg-emerald-700">
                                            {isAcceptingBid ? 'Accepting...' : 'Accept Bid'}
                                        </button>
                                        <button onClick={() => onCounter(bid.id, bid.amount)} className="flex-1 bg-white border border-emerald-600 text-emerald-600 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50">
                                            Counter
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : <p className="text-center text-gray-400 py-8">No bids yet.</p>}
                </div>
            </div>
        </div>
    );
};
