import React, { useState } from 'react';
import { ArrowLeft, Star, X, MessageSquare, ShieldCheck, Sparkles, Heart, Tag } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { REVIEW_TAGS, REVIEW_TAGS_TRANSLATIONS } from '../constants';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string, tags: string[]) => void;
    revieweeName: string;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSubmit, revieweeName }) => {
    const { language } = useUser();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [hover, setHover] = useState(0);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (rating === 0) return;
        onSubmit(rating, comment, tags);
        // Reset state after submit
        setRating(0);
        setComment('');
        setTags([]);
    };

    const toggleTag = (tag: string) => {
        if (tags.includes(tag)) {
            setTags(tags.filter(t => t !== tag));
        } else {
            if (tags.length < 3) {
                setTags([...tags, tag]);
            }
        }
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto transition-opacity" onClick={onClose} />

            {/* Main Container */}
            <div className="bg-white dark:bg-gray-950 rounded-2xl sm:rounded-[2rem] w-full max-w-md shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] animate-slide-up relative pointer-events-auto border border-gray-100 dark:border-gray-800 transition-all max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

                {/* Header - Fixed */}
                <div className="flex items-start sm:items-center gap-3 p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-md z-10 shrink-0">
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 rotate-3 group shrink-0">
                            <Star size={20} fill="currentColor" className="group-hover:rotate-12 transition-transform sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight truncate">
                                {language === 'en' ? 'How was the service?' : 'सेवा कैसी रही?'}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-medium mb-1 truncate">
                                {language === 'en' ? 'Tap stars to rate your experience' : 'अनुभव को रेट करने के लिए स्टार टैप करें'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                <div className="p-0.5 px-1.5 bg-emerald-50 dark:bg-emerald-950 rounded-full border border-emerald-100 dark:border-emerald-800 flex items-center gap-1 font-bold text-[8px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <ShieldCheck size={9} strokeWidth={3} /> Verified
                                </div>
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 break-words line-clamp-2 leading-tight">{revieweeName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 overscroll-contain">
                    <div className="text-center mb-8 relative">
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500 mb-2">
                                {language === 'en' ? getMoodText().en : getMoodText().hi}
                            </p>
                        </div>

                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHover(star)}
                                    onMouseLeave={() => setHover(0)}
                                    onClick={() => setRating(star)}
                                    className="transition-all transform hover:scale-110 focus:outline-none p-1 group"
                                >
                                    <Star
                                        size={42}
                                        className={`${star <= (rating || hover)
                                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                            : 'text-gray-300 dark:text-gray-800 fill-gray-100 dark:fill-gray-900/30'
                                            } transition-all duration-300 animate-in zoom-in-50`}
                                        strokeWidth={star <= (rating || hover) ? 0 : 1.5}
                                    />
                                </button>
                            ))}
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500 mt-4 min-h-[1.5em] animate-pulse">
                            {language === 'en' ? getMoodText().en : getMoodText().hi}
                        </p>
                    </div>

                    <div className="mb-8">
                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                            {language === 'en' ? 'What went well?' : 'क्या अच्छा रहा? (3 तक चुनें)'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {REVIEW_TAGS.map((tag) => {
                                const isSelected = tags.includes(tag);
                                const label = REVIEW_TAGS_TRANSLATIONS[tag]?.[language] || tag;
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${isSelected
                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                            : 'bg-white dark:bg-gray-50 border-gray-200 dark:border-gray-100 text-gray-600 dark:text-gray-500 hover:border-emerald-200 hover:text-emerald-600'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 ml-1">
                            <MessageSquare size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest">
                                {language === 'en' ? 'Tell us more (Optional)' : 'हमें और बताएं (वैकल्पिक)'}
                            </span>
                        </div>
                        <div className="relative group">
                            <textarea
                                className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 h-32 resize-none font-medium text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500/50 transition-all custom-scrollbar placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                placeholder={language === 'en'
                                    ? 'Describe the work quality, punctuality, and behavior...'
                                    : 'काम की गुणवत्ता, समय की पाबंदी और व्यवहार का वर्णन करें...'
                                }
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                maxLength={500}
                            />
                            <div className="absolute top-4 right-4 w-1 h-3 bg-emerald-500 rounded-full group-focus-within:animate-bounce" />
                            <div className="absolute bottom-4 right-4 text-[9px] font-black text-gray-300 dark:text-gray-600 bg-white dark:bg-gray-950 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-800">
                                {comment.length} / 500
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0 z-20">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-100 dark:bg-gray-900 text-gray-500 py-3.5 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-gray-200 transition-all active:scale-95"
                        >
                            Skip
                        </button>
                        <button
                            disabled={rating === 0}
                            onClick={handleSubmit}
                            className={`flex-[2] py-3.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-lg transition-all flex items-center justify-center gap-2 group/btn ${rating === 0
                                ? 'bg-gray-200 text-gray-400 grayscale cursor-not-allowed'
                                : 'bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95 hover:-translate-y-1'}`}
                        >
                            {language === 'en' ? 'Submit' : 'समीक्षा भेजें'}
                            <Sparkles size={14} className="group-hover/btn:rotate-45 transition-transform" />
                        </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-300/60 dark:text-gray-700 animate-fade-in hidden sm:flex">
                        <Heart size={10} className="text-red-400/60 fill-red-400/60" />
                        Fair reviews build trust
                    </div>
                </div>
            </div>
        </div>
    );
};
