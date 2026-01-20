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
            <div className="bg-white dark:bg-gray-950 w-full max-w-sm rounded-[3.5rem] p-8 pointer-events-auto relative shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] transition-all animate-slide-up pt-safe pb-safe border-4 border-white dark:border-gray-800">

                <div className="flex items-center gap-5 mb-10">
                    <button onClick={onClose} className="p-4 rounded-3xl bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                        <ArrowLeft size={24} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1">{t.negotiate || 'Negotiate'}</h3>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{t.counterOffer}</h3>
                    </div>
                </div>

                <div className="space-y-6 mb-10">
                    <div className="relative group">
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-transform group-focus-within:scale-110">
                            <span className="text-3xl font-black text-emerald-500">₹</span>
                        </div>
                        <input
                            type="number"
                            value={counterInputAmount}
                            onChange={(e) => setCounterInputAmount(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-4 border-gray-100 dark:border-gray-800 rounded-[2.5rem] pl-20 pr-8 py-8 h-24 text-4xl font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500/50 transition-all text-center placeholder:text-gray-200 dark:placeholder:text-gray-800"
                            placeholder="0"
                            min="1"
                        />
                        <div className="absolute top-6 right-8 w-1 h-3 bg-emerald-500 rounded-full group-focus-within:animate-bounce" />
                    </div>

                    <p className="text-[10px] text-center font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                        {language === 'en' ? 'Enter your best offer amount' : 'अपनी सर्वश्रेष्ठ राशि दर्ज करें'}
                    </p>
                </div>

                <button
                    onClick={handleSendCounter}
                    disabled={isSubmitting}
                    className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all flex items-center justify-center gap-4 group/btn ${isSubmitting
                        ? 'bg-gray-100 text-gray-400 grayscale'
                        : 'bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95 hover:-translate-y-1'}`}
                >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            {t.sendCounter}
                            <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
