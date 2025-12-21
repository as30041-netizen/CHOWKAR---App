import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
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

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (rating === 0) return;
        onSubmit(rating, comment);
        // Reset state after submit
        setRating(0);
        setComment('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-pop">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        {language === 'en' ? 'Rate' : 'रेटिंग दें'} {revieweeName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="flex justify-center gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                            aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        >
                            <Star
                                size={36}
                                className={`${star <= rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-gray-200 dark:text-gray-700 fill-gray-50 dark:fill-gray-800'
                                    } transition-colors`}
                                strokeWidth={1.5}
                            />
                        </button>
                    ))}
                </div>

                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'en' ? 'Comments (Optional)' : 'टिप्पणी (वैकल्पिक)'}
                </label>
                <textarea
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 h-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 resize-none font-medium text-gray-900 dark:text-white"
                    placeholder={language === 'en'
                        ? 'How was your experience working with them?'
                        : 'उनके साथ काम करने का आपका अनुभव कैसा रहा?'
                    }
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    maxLength={500}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 text-right -mt-5 mb-4">
                    {comment.length}/500
                </p>

                <button
                    disabled={rating === 0}
                    onClick={handleSubmit}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    {language === 'en' ? 'Submit Review' : 'समीक्षा भेजें'}
                </button>
            </div>
        </div>
    );
};
