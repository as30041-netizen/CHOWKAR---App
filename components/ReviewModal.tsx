import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => void;
    revieweeName: string;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSubmit, revieweeName }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-pop">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Rate {revieweeName}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                </div>

                <div className="flex justify-center gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                        >
                            <Star
                                size={36}
                                className={`${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-50'} transition-colors`}
                                strokeWidth={1.5}
                            />
                        </button>
                    ))}
                </div>

                <label className="block text-sm font-bold text-gray-700 mb-2">Comments (Optional)</label>
                <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 h-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-gray-400 resize-none font-medium"
                    placeholder="How was your experience working with them?"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                />

                <button
                    disabled={rating === 0}
                    onClick={() => onSubmit(rating, comment)}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    Submit Review
                </button>
            </div>
        </div>
    );
};
