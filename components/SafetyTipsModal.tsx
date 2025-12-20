import React from 'react';
import { ShieldCheck, X, AlertTriangle, CreditCard, UserCheck, MessageCircle } from 'lucide-react';

interface SafetyTipsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SafetyTipsModal: React.FC<SafetyTipsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const tips = [
        {
            icon: <CreditCard className="text-emerald-600" size={24} />,
            title: "Keep Payments on Chowkar",
            description: "Always pay and receive money through the official app. Transactions outside the app are not protected."
        },
        {
            icon: <UserCheck className="text-blue-600" size={24} />,
            title: "Verify Identity",
            description: "Ensure the person you meet matches their profile photo. If something feels off, cancel the job."
        },
        {
            icon: <MessageCircle className="text-purple-600" size={24} />,
            title: "Keep Chat in App",
            description: "Use the in-app chat for all communication. This provides a record in case of disputes."
        },
        {
            icon: <AlertTriangle className="text-amber-600" size={24} />,
            title: "Report Suspicious Activity",
            description: "If a user asks for OTPs, passwords, or upfront fees outside the app, report them immediately."
        }
    ];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-pop relative z-10">

                {/* Header */}
                <div className="bg-emerald-50 p-6 text-center border-b border-emerald-100">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <ShieldCheck size={32} className="text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Safety First</h2>
                    <p className="text-sm text-gray-600 mt-1">Simple rules to stay safe on Chowkar</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {tips.map((tip, index) => (
                        <div key={index} className="flex gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                            <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                {tip.icon}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">{tip.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tip.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-all active:scale-95"
                    >
                        I Understand
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full text-gray-400 hover:text-gray-900 transition-all"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
