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
    const { t, language } = useUser();
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

        // Validate amount
        if (isNaN(newAmount) || newAmount <= 0) {
            showAlert(language === 'en'
                ? 'Please enter a valid amount greater than ₹0'
                : 'कृपया ₹0 से अधिक वैध राशि दर्ज करें', 'error');
            return;
        }

        // Try getting from context first
        const job = jobs.find(j => j.id === jobId);
        let bid = job?.bids.find(b => b.id === bidId);

        try {
            // Fallback: If bid not in context (e.g. realtime update), fetch securely
            if (!bid) {
                const { data, error } = await supabase
                    .from('bids')
                    .select('*, negotiation_history')
                    .eq('id', bidId)
                    .single();

                if (error || !data) throw new Error("Bid not found");

                bid = {
                    id: data.id,
                    jobId: data.job_id,
                    workerId: data.worker_id,
                    workerName: '', // Not needed for update
                    workerPhone: '',
                    workerRating: 0,
                    workerLocation: '',
                    amount: data.amount,
                    message: data.message,
                    status: data.status,
                    negotiationHistory: data.negotiation_history || [],
                    createdAt: new Date(data.created_at).getTime()
                };
            }

            const updatedBid = {
                ...bid,
                amount: newAmount,
                negotiationHistory: [...(bid.negotiationHistory || []), { amount: newAmount, by: UserRole.POSTER, timestamp: Date.now() }]
            };

            await updateBid(updatedBid);

            showAlert("Counter offer sent!", "success");
            onClose();
            setCounterInputAmount('');
        } catch (err) {
            console.error(err);
            showAlert("Failed to send counter", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 relative z-10 animate-pop">
                <h3 className="font-bold text-lg mb-4 dark:text-white">{t.counterOffer}</h3>
                <input
                    type="number"
                    value={counterInputAmount}
                    onChange={(e) => setCounterInputAmount(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-2xl mb-4 text-center text-gray-900 dark:text-white"
                    placeholder="₹"
                    min="1"
                />
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
