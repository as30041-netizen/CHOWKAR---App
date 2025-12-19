// Razorpay Payment Service
// This service handles payment initiation and verification

import { supabase } from '../lib/supabase';

// Admin-configurable pricing (fetched from database)
let cachedConfig: { job_posting_fee: number; connection_fee: number } | null = null;

export const getAppConfig = async () => {
    if (cachedConfig) return cachedConfig;

    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['job_posting_fee', 'connection_fee']);

    if (error) {
        console.error('Failed to fetch app config:', error);
        return { job_posting_fee: 10, connection_fee: 20 }; // Fallback defaults
    }

    cachedConfig = {
        job_posting_fee: parseInt(data.find(c => c.key === 'job_posting_fee')?.value || '10'),
        connection_fee: parseInt(data.find(c => c.key === 'connection_fee')?.value || '20')
    };

    return cachedConfig;
};

// Clear cache (call when admin changes pricing)
export const clearConfigCache = () => {
    cachedConfig = null;
};

interface PaymentOptions {
    amount: number;
    currency?: string;
    description: string;
    userId: string;
    paymentType: 'JOB_POSTING' | 'CONNECTION';
    relatedJobId?: string;
    relatedBidId?: string;
}

interface PaymentResult {
    success: boolean;
    paymentId?: string;
    orderId?: string;
    error?: string;
}

// Create a payment record in the database
export const createPaymentRecord = async (options: PaymentOptions): Promise<{ paymentId: string | null; error: string | null }> => {
    const { data, error } = await supabase
        .from('payments')
        .insert({
            user_id: options.userId,
            amount: options.amount,
            currency: options.currency || 'INR',
            payment_type: options.paymentType,
            related_job_id: options.relatedJobId,
            related_bid_id: options.relatedBidId,
            status: 'PENDING'
        })
        .select('id')
        .single();

    if (error) {
        console.error('Failed to create payment record:', error);
        return { paymentId: null, error: error.message };
    }

    return { paymentId: data.id, error: null };
};

// Update payment record after Razorpay callback
export const updatePaymentStatus = async (
    paymentId: string,
    status: 'SUCCESS' | 'FAILED',
    razorpayPaymentId?: string,
    razorpayOrderId?: string
): Promise<{ success: boolean; error: string | null }> => {
    const { error } = await supabase
        .from('payments')
        .update({
            status,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_order_id: razorpayOrderId,
            completed_at: new Date().toISOString()
        })
        .eq('id', paymentId);

    if (error) {
        console.error('Failed to update payment status:', error);
        return { success: false, error: error.message };
    }

    return { success: true, error: null };
};

// Open Razorpay payment window
// Note: This requires Razorpay SDK to be loaded in the HTML
declare global {
    interface Window {
        Razorpay: any;
    }
}

export const initiateRazorpayPayment = (
    options: {
        amount: number; // in INR (will be converted to paise)
        currency?: string;
        name: string;
        description: string;
        orderId: string;
        prefillName?: string;
        prefillEmail?: string;
        prefillPhone?: string;
    },
    onSuccess: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void,
    onError: (error: any) => void
) => {
    // Razorpay Key ID - should be in environment variable
    const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE';

    const razorpayOptions = {
        key: RAZORPAY_KEY_ID,
        amount: options.amount * 100, // Convert to paise
        currency: options.currency || 'INR',
        name: options.name,
        description: options.description,
        order_id: options.orderId,
        handler: onSuccess,
        prefill: {
            name: options.prefillName,
            email: options.prefillEmail,
            contact: options.prefillPhone
        },
        theme: {
            color: '#10B981' // Emerald green to match app theme
        },
        modal: {
            ondismiss: () => {
                onError({ message: 'Payment cancelled by user' });
            }
        }
    };

    if (typeof window.Razorpay === 'undefined') {
        onError({ message: 'Payment gateway not loaded. Please try again.' });
        return;
    }

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.on('payment.failed', (response: any) => {
        onError(response.error);
    });
    rzp.open();
};

// For mobile apps, use UPI Intent
export const initiateUPIPayment = async (
    amount: number,
    transactionId: string,
    merchantName: string = 'CHOWKAR'
): Promise<string> => {
    // Generate UPI payment URL
    const upiUrl = `upi://pay?pa=merchant@upi&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=${encodeURIComponent(transactionId)}&cu=INR`;
    return upiUrl;
};

// ============= WALLET FUNCTIONS =============

// Deduct amount from user's wallet using secure RPC
export const deductFromWallet = async (
    userId: string,
    amount: number,
    description: string,
    paymentType: 'JOB_POSTING' | 'CONNECTION',
    relatedJobId?: string
): Promise<{ success: boolean; newBalance: number; error: string | null }> => {
    try {
        // Use the secure RPC to process transaction (negative amount for debit)
        const { data, error } = await supabase.rpc('process_transaction', {
            p_amount: amount,
            p_type: 'DEBIT',
            p_description: description
        });

        if (error) throw error;

        const newBalance = data?.new_balance ?? 0;

        // Also record in payments table for tracking
        await supabase.from('payments').insert({
            user_id: userId,
            amount: amount,
            payment_type: paymentType,
            related_job_id: relatedJobId,
            status: 'SUCCESS',
            completed_at: new Date().toISOString()
        });

        return { success: true, newBalance, error: null };
    } catch (error: any) {
        console.error('Wallet deduction failed:', error);
        if (error.message?.includes('Insufficient')) {
            return { success: false, newBalance: 0, error: 'Insufficient wallet balance' };
        }
        return { success: false, newBalance: 0, error: error.message };
    }
};

// Credit amount to user's wallet (for refunds)
export const creditToWallet = async (
    userId: string,
    amount: number,
    description: string = 'Refund',
    relatedJobId?: string
): Promise<{ success: boolean; newBalance: number; error: string | null }> => {
    try {
        // Use the secure RPC to process transaction
        const { data, error } = await supabase.rpc('process_transaction', {
            p_amount: amount,
            p_type: 'CREDIT',
            p_description: description
        });

        if (error) throw error;

        const newBalance = data?.new_balance ?? 0;

        // Also record in payments table for tracking
        await supabase.from('payments').insert({
            user_id: userId,
            amount: amount,
            payment_type: 'REFUND',
            related_job_id: relatedJobId,
            status: 'SUCCESS',
            completed_at: new Date().toISOString()
        });

        return { success: true, newBalance, error: null };
    } catch (error: any) {
        console.error('Wallet credit failed:', error);
        return { success: false, newBalance: 0, error: error.message };
    }
};

// Check if user has sufficient wallet balance
export const checkWalletBalance = async (userId: string, requiredAmount: number): Promise<{ sufficient: boolean; balance: number }> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', userId)
            .single();

        if (error) throw error;

        const balance = data?.wallet_balance || 0;
        return { sufficient: balance >= requiredAmount, balance };
    } catch (error) {
        console.error('Balance check failed:', error);
        return { sufficient: false, balance: 0 };
    }
};
