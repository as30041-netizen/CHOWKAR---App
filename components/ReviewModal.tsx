import React, { useState } from 'react';
import { ArrowLeft, Star, X, MessageSquare, ShieldCheck, Sparkles, Heart } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => void;
    revieweeName: string;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSubmit, revieweeName }) => {
    const { language } = useUser();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [hover, setHover] = useState(0);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (rating === 0) return;
        onSubmit(rating, comment);
        // Reset state after submit
        setRating(0);
        setComment('');
    };

    const getMoodText = () => {
        const r = rating || hover;
        if (r === 5) return { en: "Excellent Skill!", hi: "शानदार हुनर!" };
        if (r === 4) return { en: "Very Good Work", hi: "बहुत अच्छा काम" };
        if (r === 3) return { en: "Good Service", hi: "अच्छा रहा" };
        if (r === 2) return { en: "Average Experience", hi: "सामान्य रहा" };
        if (r === 1) return { en: "Needs Improvement", hi: "सुधार की ज़रूरत है" };
        return { en: "Your Experience Matters", hi: "आपका अनुभव मायने रखता है" };
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto transition-opacity" onClick={onClose} />

            {/* Main Container */}
            <div className="bg-white dark:bg-gray-950 rounded-[3.5rem] w-full max-w-xl p-8 sm:p-12 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] animate-slide-up relative pointer-events-auto border-4 border-white dark:border-gray-800 transition-all">

                <div className="flex items-center gap-6 mb-10 border-b border-gray-100 dark:border-gray-800 pb-8">
                    <button
                        onClick={onClose}
                        className="p-4 rounded-3xl bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 group"
                    >
                        <ArrowLeft size={24} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 rotate-3 group">
                            <Star size={32} fill="currentColor" className="group-hover:rotate-12 transition-transform" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight tracking-tighter">
                                {language === 'en' ? 'Rate Service' : 'रेटिंग दें'}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="p-1 px-3 bg-emerald-50 dark:bg-emerald-950 rounded-full border border-emerald-100 dark:border-emerald-800 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                    <ShieldCheck size={12} strokeWidth={3} /> Verified Job
                                </div>
                                <span className="text-sm font-bold text-gray-400">{revieweeName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center mb-12 relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2">
                            {language === 'en' ? getMoodText().en : getMoodText().hi}
                        </p>
                    </div>

                    <div className="flex justify-center gap-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onMouseEnter={() => setHover(star)}
                                onMouseLeave={() => setHover(0)}
                                onClick={() => setRating(star)}
                                className="transition-all transform hover:scale-125 focus:outline-none p-2 group"
                            >
                                <Star
                                    size={56}
                                    className={`${star <= (rating || hover)
                                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                                        : 'text-gray-100 dark:text-gray-800 fill-gray-50 dark:fill-gray-900/30'
                                        } transition-all duration-300 animate-in zoom-in-50`}
                                    strokeWidth={star <= (rating || hover) ? 0 : 2}
                                />
                            </button>
                        ))}
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-500 mt-6 min-h-[1.5em] animate-pulse">
                        {language === 'en' ? getMoodText().en : getMoodText().hi}
                    </p>
                </div>

                <div className="space-y-4 mb-12">
                    <div className="flex items-center gap-3 ml-2">
                        <MessageSquare size={18} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {language === 'en' ? 'Tell us more (Optional)' : 'हमें और बताएं (वैकल्पिक)'}
                        </span>
                    </div>
                    <div className="relative group">
                        <textarea
                            className="w-full bg-gray-50 dark:bg-gray-900 border-4 border-gray-100 dark:border-gray-800 rounded-[2.5rem] p-8 h-40 resize-none font-medium text-lg text-gray-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all custom-scrollbar placeholder:text-gray-300 dark:placeholder:text-gray-700"
                            placeholder={language === 'en'
                                ? 'Describe the work quality, punctuality, and behavior...'
                                : 'काम की गुणवत्ता, समय की पाबंदी और व्यवहार का वर्णन करें...'
                            }
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            maxLength={500}
                        />
                        <div className="absolute top-6 right-8 w-1 h-3 bg-emerald-500 rounded-full group-focus-within:animate-bounce" />
                        <div className="absolute bottom-6 right-8 text-[10px] font-black text-gray-300 dark:text-gray-600 bg-white dark:bg-gray-950 px-4 py-2 rounded-2xl border-2 border-gray-100 dark:border-gray-800">
                            {comment.length} / 500
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-100 dark:bg-gray-900 text-gray-500 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-200 transition-all active:scale-95"
                    >
                        Skip for now
                    </button>
                    <button
                        disabled={rating === 0}
                        onClick={handleSubmit}
                        className={`flex-[2] py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all flex items-center justify-center gap-4 group/btn ${rating === 0
                            ? 'bg-gray-200 text-gray-400 grayscale cursor-not-allowed'
                            : 'bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95 hover:-translate-y-1'}`}
                    >
                        {language === 'en' ? 'Post Review' : 'समीक्षा भेजें'}
                        <Sparkles size={18} className="group-hover/btn:rotate-45 transition-transform" />
                    </button>
                </div>

                <div className="mt-8 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400 animate-fade-in">
                    <Heart size={14} className="text-red-500 fill-red-500" />
                    Help others build trust
                </div>
            </div>
        </div>
    );
};
