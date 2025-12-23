import React, { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { getAppConfig, initiateRazorpayPayment, createPaymentRecord, updatePaymentStatus } from '../services/paymentService';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    paymentType: 'JOB_POSTING' | 'CONNECTION' | 'WALLET_REFILL';
    relatedJobId?: string;
    relatedBidId?: string;
    initialAmount?: number;
    onPaymentSuccess: (paymentId: string, amount: number) => void;
    onPaymentFailure?: (error: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    paymentType,
    relatedJobId,
    relatedBidId,
    initialAmount,
    onPaymentSuccess,
    onPaymentFailure
}) => {
    const { user, t, language } = useUser();
    const [amount, setAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadPricing();
        }
    }, [isOpen, paymentType]);

    const loadPricing = async () => {
        setIsLoading(true);
        try {
            if (paymentType === 'WALLET_REFILL') {
                setAmount(initialAmount || 100);
            } else {
                const config = await getAppConfig();
                const fee = paymentType === 'JOB_POSTING' ? config.job_posting_fee : config.connection_fee;
                setAmount(fee);
            }
        } catch (error) {
            console.error('Failed to load pricing:', error);
            setAmount(paymentType === 'JOB_POSTING' ? 10 : 20); // Fallback
        }
        setIsLoading(false);
    };

    const handlePayment = async () => {
        setIsProcessing(true);
        setStatus('processing');
        setErrorMessage('');

        try {
            // 1. Create payment record in database
            const { paymentId, error: createError } = await createPaymentRecord({
                amount,
                userId: user.id,
                paymentType,
                relatedJobId,
                relatedBidId,
                description: paymentType === 'JOB_POSTING' ? 'Job Posting Fee' : (paymentType === 'CONNECTION' ? 'Connection Fee' : 'Wallet Refill')
            });

            if (createError || !paymentId) {
                throw new Error(createError || 'Failed to initialize payment');
            }

            // 2. Initiate Razorpay payment
            initiateRazorpayPayment(
                {
                    amount,
                    name: 'CHOWKAR',
                    description: paymentType === 'JOB_POSTING'
                        ? 'Job Posting Fee'
                        : (paymentType === 'CONNECTION' ? 'Unlock Chat - Connection Fee' : 'Wallet Refill'),
                    orderId: paymentId, // Using our payment ID as order reference
                    prefillName: user.name,
                    prefillPhone: user.phone || ''
                },
                async (response) => {
                    // Success callback
                    await updatePaymentStatus(
                        paymentId,
                        'SUCCESS',
                        response.razorpay_payment_id,
                        response.razorpay_order_id
                    );

                    // 2.5 SPECIAL: If Wallet Refill, actually CREDIT the user balance via RPC
                    if (paymentType === 'WALLET_REFILL') {
                        await supabase.rpc('process_transaction', {
                            p_amount: amount,
                            p_type: 'CREDIT',
                            p_description: 'Wallet Refill Payment'
                        });
                    }

                    setStatus('success');
                    setTimeout(() => {
                        onPaymentSuccess(paymentId, amount);
                        onClose();
                    }, 1500);
                },
                async (error) => {
                    // Error callback
                    await updatePaymentStatus(paymentId, 'FAILED');
                    setStatus('error');
                    setErrorMessage(error.message || 'Payment failed');
                    onPaymentFailure?.(error.message);
                }
            );
        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'Something went wrong');
            onPaymentFailure?.(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden transition-colors">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">
                            {paymentType === 'JOB_POSTING'
                                ? (language === 'en' ? 'Post Your Job' : 'जॉब पोस्ट करें')
                                : (paymentType === 'CONNECTION'
                                    ? (language === 'en' ? 'Unlock Chat' : 'चैट अनलॉक करें')
                                    : (language === 'en' ? 'Add Money to Wallet' : 'वॉलेट में पैसे जोड़ें')
                                )}
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-emerald-100 mt-2 text-sm">
                        {paymentType === 'JOB_POSTING'
                            ? (language === 'en' ? 'Complete payment to publish your job' : 'जॉब प्रकाशित करने के लिए भुगतान करें')
                            : (paymentType === 'CONNECTION'
                                ? (language === 'en' ? 'Pay to unlock chat and contact details' : 'चैट और संपर्क विवरण अनलॉक करने के लिए भुगतान करें')
                                : (language === 'en' ? 'Increase your wallet balance instantly' : 'अपना वॉलेट बैलेंस तुरंत बढ़ाएं')
                            )}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-emerald-500" size={32} />
                        </div>
                    ) : status === 'success' ? (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                {language === 'en' ? 'Payment Successful!' : 'भुगतान सफल!'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                                {language === 'en' ? 'Redirecting...' : 'रीडायरेक्ट हो रहा है...'}
                            </p>
                        </div>
                    ) : status === 'error' ? (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="text-red-600 dark:text-red-400" size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                {language === 'en' ? 'Payment Failed' : 'भुगतान विफल'}
                            </h3>
                            <p className="text-red-500 dark:text-red-400 text-sm mt-2">{errorMessage}</p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                {language === 'en' ? 'Try Again' : 'पुनः प्रयास करें'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Amount Selection for Wallet Refill */}
                            {paymentType === 'WALLET_REFILL' && (
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {[100, 200, 500, 1000].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val)}
                                            className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${amount === val
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200'
                                                }`}
                                        >
                                            ₹{val}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Amount Display */}
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-6">
                                <div className="text-center">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                                        {language === 'en' ? 'Amount to Pay' : 'भुगतान राशि'}
                                    </p>
                                    <p className="text-4xl font-bold text-gray-800 dark:text-white transition-all transform duration-300">₹{amount}</p>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-3 p-3 border rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                                    <Smartphone className="text-emerald-600 dark:text-emerald-400" size={24} />
                                    <div>
                                        <p className="font-medium text-gray-800 dark:text-white">UPI / GPay / PhonePe</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {language === 'en' ? 'Pay using any UPI app' : 'किसी भी UPI ऐप से भुगतान करें'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 border rounded-xl opacity-60 dark:border-gray-700">
                                    <CreditCard className="text-gray-400 dark:text-gray-500" size={24} />
                                    <div>
                                        <p className="font-medium text-gray-600 dark:text-gray-400">
                                            {language === 'en' ? 'Credit/Debit Card' : 'क्रेडिट/डेबिट कार्ड'}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {language === 'en' ? 'All major cards accepted' : 'सभी प्रमुख कार्ड स्वीकार'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Pay Button */}
                            <button
                                onClick={handlePayment}
                                disabled={isProcessing}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        {language === 'en' ? 'Processing...' : 'प्रोसेसिंग...'}
                                    </>
                                ) : (
                                    <>
                                        {language === 'en' ? 'Pay' : 'भुगतान करें'} ₹{amount}
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                                {language === 'en' ? 'Secure payment powered by Razorpay' : 'Razorpay द्वारा सुरक्षित भुगतान'}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
