import React, { useState } from 'react';
import { X, Check, Zap, Crown, Shield, Star, Loader2 } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useAdminConfig } from '../contexts/AdminConfigContext';
import { supabase } from '../lib/supabase';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
    const { user, t, language } = useUser();
    const { config } = useAdminConfig(); // Future: Fetch dynamic prices
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    if (!isOpen) return null;

    const PLANS = [
        {
            id: 'FREE',
            name: { en: 'Free Starter', hi: 'मुफ़्त शुरुआत' },
            price: 0,
            features: [
                { en: '3 Free Job Posts / Month', hi: '3 मुफ़्त काम पोस्ट / महीना' },
                { en: '5 Free Bids / Week', hi: '5 मुफ़्त बोली / सप्ताह' },
                { en: 'Standard Support', hi: 'साधारण सहायता' }
            ],
            color: 'bg-slate-100 dark:bg-slate-800',
            textColor: 'text-slate-700 dark:text-slate-300',
            icon: Shield
        },
        {
            id: 'WORKER_PLUS',
            name: { en: 'Worker Plus', hi: 'वर्कर प्लस' },
            price: 49,
            period: { en: '/ month', hi: '/ महीना' },
            features: [
                { en: 'Unlimited Bids', hi: 'असीमित बोलियां' },
                { en: 'Priority Support', hi: 'प्राथमिकता सहायता' },
                { en: 'Zero Commission', hi: 'शून्य कमीशन' }
            ],
            color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
            textColor: 'text-white',
            highlight: true,
            icon: Zap
        },
        {
            id: 'SUPER',
            name: { en: 'SUPER', hi: 'सुपर' },
            price: 129,
            period: { en: '/ month', hi: '/ महीना' },
            features: [
                { en: 'Unlimited Job Posts', hi: 'असीमित काम पोस्ट' },
                { en: 'Unlimited Bids', hi: 'असीमित बोलियां' },
                { en: 'AI Job Enhancer', hi: 'AI काम विवरण सुधार' },
                { en: 'AI Wage Estimator', hi: 'AI सही दाम अनुमान' },
                { en: 'Priority Support', hi: 'प्राथमिकता सहायता' }
            ],
            color: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600',
            textColor: 'text-white',
            highlight: true,
            mostPopular: true,
            icon: Star
        },
        {
            id: 'PRO_POSTER',
            name: { en: 'Pro Poster', hi: 'प्रो पोस्टर' },
            price: 99,
            period: { en: '/ month', hi: '/ महीना' },
            features: [
                { en: 'Unlimited Job Posts', hi: 'असीमित काम पोस्ट करें' },
                { en: 'AI Job Enhancer', hi: 'AI काम विवरण सुधार' },
                { en: 'AI Wage Estimator', hi: 'AI सही दाम अनुमान' },
                { en: 'Priority Support', hi: 'प्राथमिकता सहायता' }
            ],
            color: 'bg-gradient-to-br from-amber-400 to-orange-500',
            textColor: 'text-black',
            icon: Crown
        }
    ];

    // Filter plans based on User Role? 
    // Ideally show relevant one first. For now, show all but highlight relevant.
    // Show all plans so users can choose (Super App flexibility)
    const relevantPlans = PLANS;

    // Load Razorpay Script Dynamically
    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleSubscribe = async (planId: string) => {
        if (planId === 'FREE') return;
        setLoadingPlan(planId);

        const res = await loadRazorpay();
        if (!res) {
            alert('Razorpay SDK failed to load. Are you online?');
            setLoadingPlan(null);
            return;
        }

        try {
            const selectedPlan = PLANS.find(plan => plan.id === planId);
            if (!selectedPlan) {
                throw new Error('Selected plan not found');
            }

            // 2. Create Order via Edge Function (Real Razorpay)
            // This securely calls Razorpay API to generate a verifiable order_id
            const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
                body: {
                    amount: selectedPlan.price,
                    currency: 'INR',
                    userId: user.id,
                    type: 'premium', // Signals the webhook to use 'admin_activate_premium'
                    coins: 0, // No coins for subscription
                    planId: selectedPlan.id, // CRITICAL: Send Plan ID for webhook
                    receipt: `sub_${selectedPlan.id}_${Date.now()}`
                }
            });

            if (error) throw error;
            if (!data || !data.id) throw new Error('Invalid response from payment server');

            const order_id = data.id; // Real Razorpay Order ID (starts with order_...)
            // FIX: Use the key returned by the server to ensure Signature Match
            const key = data.key || import.meta.env.VITE_RAZORPAY_KEY_ID;

            // 3. Open Razorpay Checkout with REAL Order ID
            const options = {
                key: key, // "rzp_test_..."
                amount: selectedPlan.price * 100, // Razorpay expects amount in paisa
                currency: "INR",
                name: "Chowkar Services",
                description: `Upgrade to ${planId}`,
                order_id: order_id, // Use the order_id obtained from the edge function
                handler: async (response: any) => {
                    setLoadingPlan(planId); // Use setLoadingPlan with planId
                    try {
                        // 4. Verify Payment on Backend (Secure Webhook)
                        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                            body: {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                userId: user.id
                            }
                        });

                        if (verifyError) throw verifyError;

                        if (verifyData && verifyData.success) {
                            alert(`Success! Welcome to ${planId}`);
                            window.location.reload(); // Refresh to see new plan immediately
                            onClose();
                        } else {
                            alert('Payment Verification Failed');
                        }
                    } catch (err) {
                        console.error("Payment verification error:", err);
                        alert('Payment verification failed due to an unexpected error.');
                    } finally {
                        setLoadingPlan(null);
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email || 'user@example.com',
                    contact: user.phone
                },
                theme: {
                    color: planId === 'WORKER_PLUS' ? '#8B5CF6' : '#F59E0B'
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();

        } catch (err) {
            console.error(err);
            alert('Payment flow error');
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-6 pb-2 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter italic">
                            {language === 'en' ? 'Upgrade Plan' : 'प्लान अपग्रेड करें'}
                        </h2>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                            {language === 'en' ? 'Unlock Premium Features' : 'प्रीमियम सुविधाओं के लिए'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 overflow-y-auto no-scrollbar pb-safe">
                    {relevantPlans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative rounded-[2rem] p-6 transition-transform active:scale-[0.98] border-2 border-transparent ${plan.highlight
                                ? 'shadow-xl shadow-indigo-500/20 ' + plan.color
                                : 'bg-surface border-border hover:border-indigo-500/50'
                                }`}
                        >
                            {plan.highlight && (
                                <div className="absolute top-0 right-0 bg-black/20 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-2xl">
                                    Recommended
                                </div>
                            )}

                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-2xl ${plan.highlight ? 'bg-white/20' : 'bg-background'}`}>
                                    <plan.icon size={24} className={plan.highlight ? 'text-white' : 'text-text-primary'} />
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-black ${plan.textColor}`}>
                                        {plan.price === 0 ? 'FREE' : `₹${plan.price}`}
                                    </div>
                                    {plan.price > 0 && (
                                        <div className={`text-[10px] font-bold uppercase ${plan.highlight ? 'text-white/80' : 'text-text-muted'}`}>
                                            {plan.period?.[language as 'en' | 'hi'] || plan.period?.en}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3 className={`text-lg font-black uppercase tracking-tight mb-4 ${plan.textColor}`}>
                                {plan.name[language as 'en' | 'hi'] || plan.name.en}
                            </h3>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feat, i) => (
                                    <li key={i} className={`flex items-center gap-3 text-xs font-bold ${plan.highlight ? 'text-white/90' : 'text-text-secondary'}`}>
                                        <Check size={14} strokeWidth={4} className={plan.highlight ? 'text-white' : 'text-emerald-500'} />
                                        {feat[language as 'en' | 'hi'] || feat.en}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleSubscribe(plan.id)}
                                disabled={!!loadingPlan || (user.subscription_plan === plan.id || (!user.subscription_plan && plan.id === 'FREE'))}
                                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${plan.highlight
                                    ? 'bg-white text-indigo-600 hover:bg-white/90'
                                    : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-80'
                                    }`}
                            >
                                {loadingPlan === plan.id ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    language === 'en'
                                        ? ((user.subscription_plan === plan.id || (!user.subscription_plan && plan.id === 'FREE')) ? 'Current Plan' : 'Subscribe Now')
                                        : ((user.subscription_plan === plan.id || (!user.subscription_plan && plan.id === 'FREE')) ? 'वर्तमान प्लान' : 'अभी लें')
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
