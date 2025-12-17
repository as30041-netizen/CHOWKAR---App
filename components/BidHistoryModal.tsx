import React, { useEffect, useState } from 'react';
import { XCircle, Clock, CheckCircle, XOctagon, Loader2, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';
import { Bid, Job } from '../types';

interface BidHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface BidWithJob extends Bid {
    jobTitle?: string;
    jobLocation?: string;
}

export const BidHistoryModal: React.FC<BidHistoryModalProps> = ({ isOpen, onClose }) => {
    const { user, t } = useUser();
    const [bids, setBids] = useState<BidWithJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchBids();
        }
    }, [isOpen]);

    const fetchBids = async () => {
        setLoading(true);
        try {
            // Fetch bids for this user
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

            // Transform data to include job details
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
        } catch (error) {
            console.error('Error fetching bid history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 pointer-events-auto animate-slide-up relative max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">{t.bidHistory}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 size={32} className="text-emerald-600 animate-spin" />
                        </div>
                    ) : bids.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <p>{t.noBidsFound}</p>
                        </div>
                    ) : (
                        bids.map(bid => (
                            <div key={bid.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{bid.jobTitle}</h4>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            {bid.jobLocation}
                                        </p>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${bid.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                                        bid.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {bid.status === 'ACCEPTED' && <CheckCircle size={12} />}
                                        {bid.status === 'REJECTED' && <XOctagon size={12} />}
                                        {bid.status === 'PENDING' && <Clock size={12} />}
                                        {bid.status}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                                    <span className="text-sm font-bold text-gray-500">{t.yourOfferLabel}</span>
                                    <span className="text-lg font-bold text-emerald-700">₹{bid.amount}</span>
                                </div>
                                <div className="text-xs text-gray-400 text-right">
                                    {new Date(bid.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
