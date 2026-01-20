import React from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { Job, Bid } from '../../types';

interface JobNegotiationCardProps {
    myBid: Partial<Bid>;
    liveJob: Job;
    isWorkerTurn: boolean;
    language: string;
}

export const JobNegotiationCard: React.FC<JobNegotiationCardProps> = ({ myBid, liveJob, isWorkerTurn, language }) => {
    if (!myBid) return null;

    return (
        <div className={`p-6 md:p-8 rounded-[2rem] border-2 border-dashed relative overflow-hidden group shadow-sm w-full mx-auto ${isWorkerTurn
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-indigo-500/5 border-indigo-500/20'
            }`}>
            <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 ${isWorkerTurn ? 'text-amber-600' : 'text-indigo-600'
                }`}>
                {isWorkerTurn ? <AlertCircle size={14} /> : <Clock size={14} />}
                {language === 'en' ? 'Negotiation Status' : 'मोलभाव की स्थिति'}
            </h4>

            <div className="flex items-center justify-between relative z-10 max-w-3xl mx-auto">
                {/* Left: Original */}
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1.5 opacity-70">
                        {language === 'en' ? 'Original' : 'मूल प्रस्ताव'}
                    </span>
                    <span className="text-xl md:text-3xl font-black text-text-secondary/40 line-through decoration-auto">
                        ₹{liveJob.budget}
                    </span>
                </div>

                {/* Middle: Arrow (Responsive) */}
                <div className="flex-1 px-4 md:px-12 flex flex-col items-center justify-center opacity-80">
                    <div className={`h-0.5 w-full relative rounded-full ${isWorkerTurn ? 'bg-amber-500/30' : 'bg-indigo-500/30'
                        }`}>
                        <div className={`absolute right-0 -top-1 w-2.5 h-2.5 rotate-45 border-t-2 border-r-2 ${isWorkerTurn ? 'border-amber-500/50' : 'border-indigo-500/50'
                            }`} />
                    </div>
                </div>

                {/* Right: Current */}
                <div className="flex flex-col items-end">
                    <span className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${isWorkerTurn ? 'text-amber-600' : 'text-indigo-600'
                        }`}>
                        {isWorkerTurn
                            ? (language === 'en' ? 'Poster Counter' : 'मालिक का प्रस्ताव')
                            : (language === 'en' ? 'Your Offer' : 'आपका प्रस्ताव')
                        }
                    </span>
                    <div className={`px-5 py-2.5 md:py-3 md:px-6 rounded-2xl text-xl md:text-3xl font-black shadow-lg shadow-black/5 flex items-center gap-3 transform transition-all group-hover:scale-105 ${isWorkerTurn
                        ? 'bg-amber-500 text-white shadow-amber-500/30'
                        : 'bg-indigo-600 text-white shadow-indigo-500/30'
                        }`}>
                        ₹{myBid.amount}
                        {isWorkerTurn && <AlertCircle size={20} className="animate-pulse" strokeWidth={3} />}
                    </div>
                </div>
            </div>

            {isWorkerTurn && (
                <div className="mt-6 flex justify-center">
                    <p className="inline-block text-[10px] md:text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-4 py-2 rounded-xl border border-amber-500/10 text-center animate-pulse-subtle">
                        {language === 'en'
                            ? "Action Required: The employer updated the price."
                            : "मालिक ने कीमत बदल दी है। ध्यान दें!"}
                    </p>
                </div>
            )}
        </div>
    );
};
