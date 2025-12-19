import React, { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { getAppConfig, initiateRazorpayPayment, createPaymentRecord, updatePaymentStatus } from '../services/paymentService';
import { useUser } from '../contexts/UserContextDB';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    paymentType: 'JOB_POSTING' | 'CONNECTION';
    relatedJobId?: string;
    relatedBidId?: string;
    onPaymentSuccess: (paymentId: string) => void;
    onPaymentFailure?: (error: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    paymentType,
    relatedJobId,
    relatedBidId,
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
            const config = await getAppConfig();
            const fee = paymentType === 'JOB_POSTING' ? config.job_posting_fee : config.connection_fee;
            setAmount(fee);
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
                description: paymentType === 'JOB_POSTING' ? 'Job Posting Fee' : 'Connection Fee'
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
                        : 'Unlock Chat - Connection Fee',
                    orderId: paymentId, // Using our payment ID as order reference
                    prefillName: user.name,
                    prefillPhone: user.phone
                },
                async (response) => {
                    // Success callback
                    await updatePaymentStatus(
                        paymentId,
                        'SUCCESS',
                        response.razorpay_payment_id,
                        response.razorpay_order_id
                    );
                    setStatus('success');
                    setTimeout(() => {
                        onPaymentSuccess(paymentId);
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
            <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">
                            {paymentType === 'JOB_POSTING' ? 'Post Your Job' : 'Unlock Chat'}
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-emerald-100 mt-2 text-sm">
                        {paymentType === 'JOB_POSTING'
                            ? 'Complete payment to publish your job'
                            : 'Pay to unlock chat and contact details'}
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
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="text-emerald-600" size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Payment Successful!</h3>
                            <p className="text-gray-500 text-sm mt-2">Redirecting...</p>
                        </div>
                    ) : status === 'error' ? (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="text-red-600" size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Payment Failed</h3>
                            <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="mt-4 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Amount Display */}
                            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                                <div className="text-center">
                                    <p className="text-gray-500 text-sm mb-1">Amount to Pay</p>
                                    <p className="text-4xl font-bold text-gray-800">₹{amount}</p>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-3 p-3 border rounded-xl bg-emerald-50 border-emerald-200">
                                    <Smartphone className="text-emerald-600" size={24} />
                                    <div>
                                        <p className="font-medium text-gray-800">UPI / GPay / PhonePe</p>
                                        <p className="text-xs text-gray-500">Pay using any UPI app</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 border rounded-xl opacity-60">
                                    <CreditCard className="text-gray-400" size={24} />
                                    <div>
                                        <p className="font-medium text-gray-600">Credit/Debit Card</p>
                                        <p className="text-xs text-gray-400">All major cards accepted</p>
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
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Pay ₹{amount}
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs text-gray-400 mt-4">
                                Secure payment powered by Razorpay
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
