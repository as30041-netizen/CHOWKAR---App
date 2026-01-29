import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, CheckCircle, XOctagon, Loader2, IndianRupee, MapPin, ChevronRight, History } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';
import { Bid } from '../types';

interface BidHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface BidWithJob extends Bid {
    jobTitle?: string;
    jobLocation?: string;
}

export const BidHistoryModal: React.FC<BidHistoryModalProps> = ({ isOpen, onClose }) => {
    const { user, t, language, showAlert } = useUser();
    const [bids, setBids] = useState<BidWithJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchBids();
        }
    }, [isOpen]);

    const fetchBids = async () => {
        if (!user.id) return; // Guard against zombie auth

        setLoading(true);
        try {
            const { data: bidsData, error: bidsError } = await supabase
                .from('bids')
                .select(`
                    *,
                    job:jobs (
                        title,
                        location
                    )
                `)
                .eq('worker_id', user.id)
                .order('created_at', { ascending: false });

            if (bidsError) throw bidsError;

            const transformedBids: BidWithJob[] = (bidsData || []).map((b: any) => ({
                id: b.id,
                jobId: b.job_id,
                workerId: b.worker_id,
                workerName: b.worker_name,
                workerPhone: b.worker_phone,
                workerRating: b.worker_rating,
                workerLocation: b.worker_location,
                amount: b.amount,
                message: b.message,
                createdAt: new Date(b.created_at).getTime(),
                status: b.status,
                negotiationHistory: b.negotiation_history || [],
                jobTitle: b.job?.title || 'Unknown Job',
                jobLocation: b.job?.location
            }));

            setBids(transformedBids);
        } catch (error: any) {
            console.error('Error fetching bid history:', error);
            showAlert(language === 'en'
                ? 'Failed to load bid history. Please try again.'
                : 'बोली इतिहास लोड करने में विफल। कृपया पुन: प्रयास करें।',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in transition-all">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto" onClick={onClose} />

            <div className="bg-white dark:bg-gray-950 w-full max-w-lg rounded-[3.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col relative z-20 animate-slide-up sm:animate-pop border-4 border-white dark:border-gray-800 transition-all max-h-[90vh] pb-safe">

                {/* Header */}
                <div className="p-8 pb-4 flex items-center gap-6 shrink-0 border-b border-gray-100 dark:border-gray-800">
                    <button onClick={onClose} className="p-4 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-emerald-500 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-emerald-100 group">
                        <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                            <History size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] mb-1">{t.myApplications}</h2>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                                {t.bidHistory}
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 size={42} className="text-emerald-500 animate-spin" strokeWidth={3} />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{t.loading}</p>
                        </div>
                    ) : bids.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-gray-200">
                                <History size={48} />
                            </div>
                            <p className="text-xl font-black text-gray-900 dark:text-white mb-2">{t.noBidsFound}</p>
                            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-[200px] mx-auto text-sm">{t.noBidsDesc}</p>
                        </div>
                    ) : (
                        bids.map(bid => (
                            <div key={bid.id} className="relative group p-6 rounded-[2.5rem] bg-gray-50 dark:bg-gray-900 border-4 border-transparent hover:border-emerald-500/20 hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 shadow-sm active:scale-[0.98]">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2 line-clamp-1">{bid.jobTitle}</h4>
                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <MapPin size={10} className="text-emerald-500" /> {bid.jobLocation}
                                        </p>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-sm flex items-center gap-1.5 ${bid.status === 'ACCEPTED' ? 'bg-emerald-500 text-white' :
                                        bid.status === 'REJECTED' ? 'bg-red-500 text-white' :
                                            'bg-amber-400 text-amber-950'
                                        }`}>
                                        {bid.status === 'ACCEPTED' ? <CheckCircle size={10} strokeWidth={3} /> :
                                            bid.status === 'REJECTED' ? <XOctagon size={10} strokeWidth={3} /> :
                                                <Clock size={10} strokeWidth={3} />}
                                        {bid.status}
                                    </div>
                                </div>
                                <div className="flex items-end justify-between border-t border-gray-100 dark:border-gray-800 pt-6">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em] mb-1">{t.proposedBudget}</p>
                                        <div className="flex items-center gap-1.5 text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                            <IndianRupee size={20} strokeWidth={3} />
                                            {bid.amount}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em] mb-1">{t.appliedOn}</p>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">{new Date(bid.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>

                                {bid.message && (
                                    <div className="mt-6 p-4 bg-white/50 dark:bg-gray-950/50 rounded-2xl border-2 border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 italic font-medium line-clamp-2">
                                        "{bid.message}"
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
