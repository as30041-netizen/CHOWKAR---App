import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
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

    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSendCounter = async () => {
        if (!jobId || !bidId || !counterInputAmount || isSubmitting) return;

        const newAmount = parseInt(counterInputAmount);

        // Validate amount
        if (isNaN(newAmount) || newAmount <= 0) {
            showAlert(language === 'en'
                ? 'Please enter a valid amount greater than ₹0'
                : 'कृपया ₹0 से अधिक वैध राशि दर्ज करें', 'error');
            return;
        }

        setIsSubmitting(true);

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
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] p-8 pointer-events-auto relative shadow-[0_-8px_32px_rgba(0,0,0,0.1)] transition-all animate-slide-up pb-safe">

                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onClose} className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-90 shadow-sm group">
                        <ArrowLeft size={22} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t.counterOffer}</h3>
                </div>

                <div className="relative group mb-8">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-3xl group-focus-within:scale-110 transition-transform">₹</span>
                    <input
                        type="number"
                        value={counterInputAmount}
                        onChange={(e) => setCounterInputAmount(e.target.value)}
                        className="input-base !pl-14 !py-6 !text-2xl font-black text-emerald-600 dark:text-emerald-400 !bg-gray-50 dark:!bg-gray-800/50 !rounded-3xl border-transparent focus:!border-emerald-500/50 focus:!shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all text-center"
                        placeholder="0"
                        min="1"
                    />
                </div>

                <button
                    onClick={handleSendCounter}
                    disabled={isSubmitting}
                    className="btn btn-primary w-full !py-5 !rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] hover:-translate-y-1 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>Sending...</>
                    ) : (
                        t.sendCounter
                    )}
                </button>
            </div>
        </div>
    );
};
