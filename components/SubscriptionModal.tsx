import React, { useState } from 'react';
import { X, Crown, CheckCircle2, Zap, BrainCircuit, ShieldCheck, Star } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { PREMIUM_PRICE } from '../constants';
import { initiatePremiumPayment } from '../services/paymentService';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
    const { user, t, language, showAlert, refreshUser } = useUser();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const result = await initiatePremiumPayment(user.id, user.email || '', user.phone || '');
            if (result.success) {
                await refreshUser();
                showAlert(language === 'en' ? 'Welcome to Premium!' : 'प्रीमियम में आपका स्वागत है!', 'success');
                onClose();
            } else if (result.error !== 'Payment Cancelled') {
                showAlert(result.error || 'Upgrade failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Something went wrong', 'error');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        {
            icon: <BrainCircuit className="text-indigo-500" />,
            title: t.featUnlimitedAI,
            desc: language === 'en' ? 'Use AI to enhance descriptions and estimate wages' : 'AI का इस्तेमाल करें काम को बेहतर बनाने के लिए'
        },
        {
            icon: <ShieldCheck className="text-emerald-500" />,
            title: t.featVerified,
            desc: language === 'en' ? 'Get a gold checkmark on your profile' : 'अपनी प्रोफाइल पर सोने का सही निशान पाएं'
        },
        {
            icon: <Zap className="text-amber-500" />,
            title: t.featPriority,
            desc: language === 'en' ? 'Your bids and jobs appear at the top' : 'आपकी बोलियां और काम सबसे ऊपर दिखेंगे'
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl animate-scale-up border-4 border-amber-500/20">
                {/* Header Gradient */}
                <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-8 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                            <Crown size={40} strokeWidth={2.5} className="text-white drop-shadow-lg" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-2 italic">CHOWKAR PREMIUM</h2>
                        <p className="text-amber-50 font-bold text-sm uppercase tracking-widest opacity-90">Unlock Your Full Potential</p>
                    </div>
                </div>

                <div className="p-8">
                    <div className="space-y-6 mb-8">
                        {features.map((f, i) => (
                            <div key={i} className="flex gap-5 items-start">
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-sm">
                                    {f.icon}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-gray-900 dark:text-white leading-none mb-1">{f.title}</h4>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] p-6 text-center border-2 border-amber-100 dark:border-amber-800/30 mb-8">
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] mb-1">Lifetime Access</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-4xl font-black text-gray-900 dark:text-white">₹{PREMIUM_PRICE}</span>
                            <div className="text-left">
                                <p className="text-[10px] line-through text-gray-400 font-bold decoration-2">₹499</p>
                                <p className="text-[10px] text-emerald-600 font-black tracking-tighter uppercase leading-none">60% OFF</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Zap size={18} fill="currentColor" />
                                {t.upgradePremium}
                            </>
                        )}
                    </button>

                    <p className="mt-4 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                        One-time payment • Secure Checkout
                    </p>
                </div>
            </div>
        </div>
    );
};
