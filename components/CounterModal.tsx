import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface CounterModalProps {
    isOpen: boolean;
    onClose: () => void;
    bidId: string | null;
    jobId: string | null;
    initialAmount: string;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const CounterModal: React.FC<CounterModalProps> = ({ isOpen, onClose, bidId, jobId, initialAmount, showAlert }) => {
    const { t } = useUser();
    const { jobs, updateBid } = useJobs();
    const [counterInputAmount, setCounterInputAmount] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCounterInputAmount(initialAmount);
        }
    }, [isOpen, initialAmount]);

    if (!isOpen) return null;

    const handleSendCounter = async () => {
        if (!jobId || !bidId || !counterInputAmount) return;
        const newAmount = parseInt(counterInputAmount);
        const job = jobs.find(j => j.id === jobId);

        if (job) {
            try {
                const bid = job.bids.find(b => b.id === bidId);
                if (bid) {
                    const updatedBid = {
                        ...bid,
                        amount: newAmount,
                        negotiationHistory: [...(bid.negotiationHistory || []), { amount: newAmount, by: UserRole.POSTER, timestamp: Date.now() }]
                    };
                    await updateBid(updatedBid);

                    // Send PUSH notification to worker (DB trigger handles in-app notification)
                    // This ensures worker gets push even when app is closed
                    const workerId = bid.workerId;
                    if (workerId) {
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.access_token) {
                                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                                await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${session.access_token}`
                                    },
                                    body: JSON.stringify({
                                        userId: workerId,
                                        title: 'Counter Offer',
                                        body: `New offer of ₹${newAmount} for "${job.title}"`,
                                        data: { jobId: job.id, type: 'counter_offer' }
                                    })
                                });
                                console.log('[Push] Counter offer push sent to worker:', workerId);
                            }
                        } catch (pushError) {
                            console.warn('[Push] Failed to send counter push:', pushError);
                        }
                    }
                }

                showAlert("Counter offer sent!", "success");
                onClose();
                setCounterInputAmount('');
            } catch {
                showAlert("Failed to send counter", "error");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-pop">
                <h3 className="font-bold text-lg mb-4">{t.counterOffer}</h3>
                <input type="number" value={counterInputAmount} onChange={(e) => setCounterInputAmount(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-2xl mb-4 text-center" />
                <button
                    onClick={handleSendCounter}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg"
                >
                    {t.sendCounter}
                </button>
            </div>
        </div>
    );
};
