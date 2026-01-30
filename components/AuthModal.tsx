import React, { useState, useEffect } from 'react';
import {
    X, Smartphone, Mail, ArrowRight, Loader2,
    CheckCircle, AlertCircle, Phone, Lock
} from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useAdminConfig } from '../contexts/AdminConfigContext';
import { signInWithPhone, verifyOTP, signInWithGoogle } from '../services/authService';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { t, language, showAlert } = useUser();
    const { config } = useAdminConfig();
    const [step, setStep] = useState<0 | 1>(0); // 0: Select/Phone, 1: OTP
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Resend OTP Countdown
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        const result = await signInWithGoogle();
        if (!result.success) {
            showAlert(result.error || 'Google login failed', 'error');
            setIsLoading(false);
        }
        // Redirect will happen automatically on success
    };

    const handleSendOTP = async () => {
        if (!phone || phone.length < 10) {
            showAlert('Please enter a valid phone number', 'error');
            return;
        }

        setIsLoading(true);
        // Ensure format is E.164 (e.g., +919999999999)
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

        const result = await signInWithPhone(formattedPhone);
        setIsLoading(false);

        if (result.success) {
            setStep(1);
            setCountdown(60);
        } else {
            showAlert(result.error || 'Failed to send OTP', 'error');
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length < 6) {
            showAlert('Please enter the 6-digit code', 'error');
            return;
        }

        setIsLoading(true);
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        const result = await verifyOTP(formattedPhone, otp);

        if (result.success) {
            onClose();
            // UserContext will detect the new session
        } else {
            setIsLoading(false);
            showAlert(result.error || 'Invalid OTP', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-md bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] border border-white/20 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Close Button - Absolute to the card frame */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors z-20"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="p-8 sm:p-10 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/50 relative">
                            {step === 0 ? <Smartphone size={32} /> : <Lock size={32} />}

                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            {step === 0
                                ? (language === 'hi' ? 'लॉगिन करें' : language === 'pa' ? 'ਲੌਗਇਨ ਕਰੋ' : 'Welcome Back')
                                : (language === 'hi' ? 'OTP दर्ज करें' : language === 'pa' ? 'OTP ਦਰਜ ਕਰੋ' : 'Verify Phone')
                            }
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">
                            {step === 0
                                ? (language === 'hi' ? 'जारी रखने के लिए लॉगिन करें' : 'Sign in to continue to Chowkar')
                                : (language === 'hi' ? `हमने ${phone} पर कोड भेजा है` : `We sent a code to ${phone}`)
                            }
                        </p>
                    </div>

                    {step === 0 ? (
                        <div className="space-y-6">
                            {/* Google Button */}
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl font-bold text-gray-700 dark:text-gray-200 hover:border-emerald-500/30 hover:bg-emerald-50/10 transition-all group active:scale-[0.98]"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                                <span>Continue with Google</span>
                            </button>

                            {/* TEMPORARILY DISABLED: Phone Authentication - Re-enable when SMS costs are acceptable
                            {/* Separator */}
                            {/*
                            <div className="flex items-center gap-4 text-gray-300 dark:text-gray-800">
                                <div className="h-px flex-1 bg-current" />
                                <span className="text-xs font-black uppercase tracking-widest text-gray-400">OR</span>
                                <div className="h-px flex-1 bg-current" />
                            </div>
                            */}

                            {/* Phone Input - DISABLED */}
                            {/*
                            <div className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                                        <div className="flex items-center gap-2 border-r border-gray-200 dark:border-gray-800 pr-3 mr-1">
                                            <span className="text-sm font-bold text-gray-600">+91</span>
                                        </div>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="Mobile Number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="w-full pl-20 pr-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500/50 rounded-2xl outline-none font-bold text-gray-900 dark:text-white transition-all"
                                    />
                                </div>

                                <button
                                    onClick={handleSendOTP}
                                    disabled={isLoading || phone.length < 10}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-400 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : <><Smartphone size={20} /> Get OTP</>}
                                </button>
                            </div>
                            */}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* OTP Input */}
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="6-digit OTP"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500/50 rounded-2xl outline-none font-bold text-center text-3xl tracking-[1em] text-gray-900 dark:text-white transition-all pl-[1.5em]"
                                        autoFocus
                                    />
                                </div>

                                <button
                                    onClick={handleVerifyOTP}
                                    disabled={isLoading || otp.length < 6}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-400 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> Verify & Login</>}
                                </button>

                                <div className="text-center">
                                    {countdown > 0 ? (
                                        <p className="text-sm text-gray-500 transition-all">
                                            Resend code in <span className="font-bold text-emerald-500">{countdown}s</span>
                                        </p>
                                    ) : (
                                        <button
                                            onClick={handleSendOTP}
                                            className="text-sm font-bold text-emerald-500 hover:text-emerald-600 transition-colors"
                                        >
                                            Resend OTP
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => setStep(0)}
                                    className="w-full text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all mt-4"
                                >
                                    Change Phone Number
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Note */}
                    <p className="mt-8 text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-relaxed">
                        By continuing, you agree to our <br />
                        <span className="text-emerald-500">Terms of Service</span> & <span className="text-emerald-500">Privacy Policy</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
