import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useWallet } from '../contexts/WalletContext';
import { supabase } from '../lib/supabase';
import { COIN_PACKS, initiatePayment } from '../services/paymentService';
import { ArrowLeft, Wallet, History, Plus, AlertCircle, CheckCircle2, Loader2, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Transaction {
    id: string;
    amount: number;
    type: 'BONUS' | 'PURCHASE' | 'BID_FEE' | 'REFUND' | 'ADJUSTMENT';
    description: string;
    created_at: string;
}

export const WalletPage: React.FC = () => {
    const { user, t, language } = useUser();
    const { walletBalance, refreshWallet } = useWallet();
    const navigate = useNavigate();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [processingPack, setProcessingPack] = useState<string | null>(null);

    // Fetch History
    useEffect(() => {
        if (!user.id) return;
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('wallet_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) setTransactions(data as Transaction[]);
            setLoadingHistory(false);
        };
        fetchHistory();
    }, [user.id, walletBalance]); // Refresh history when balance changes

    const handleBuy = async (packId: string) => {
        setProcessingPack(packId);
        try {
            const result = await initiatePayment(packId, user.id);
            if (result.success) {
                // Refresh balance immediately
                await refreshWallet();
                alert(language === 'en' ? 'Payment Successful! Coins added.' : 'भुगतान सफल! सिक्के जुड़ गए।');
            } else {
                alert(result.error || 'Payment Failed');
            }
        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setProcessingPack(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 pt-safe">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 sticky top-0 z-30 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center gap-4 shadow-sm">
                <button onClick={() => navigate(-1)} className="btn-ghost !p-2 -ml-2 text-gray-600 dark:text-gray-400">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Wallet</h1>
            </div>

            <div className="p-6 max-w-lg mx-auto space-y-8">

                {/* Balance Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-emerald-900 dark:to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>

                    <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">Available Balance</p>
                        <div className="flex items-end gap-2">
                            <span className="text-5xl font-black">{walletBalance}</span>
                            <span className="text-2xl font-bold mb-1 opacity-80">Coins</span>
                        </div>
                    </div>
                </div>

                {/* Top Up Section */}
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Plus size={16} strokeWidth={3} />
                        </div>
                        Add Coins
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        {COIN_PACKS.map(pack => (
                            <button
                                key={pack.id}
                                disabled={!!processingPack}
                                onClick={() => handleBuy(pack.id)}
                                className="relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group text-left shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {pack.save > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                        SAVE {pack.save}%
                                    </span>
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-2xl font-black text-gray-900 dark:text-white">{pack.coins}</span>
                                    <span className="text-2xl">🪙</span>
                                </div>
                                <div className="text-sm font-bold text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    ₹{pack.price}
                                </div>

                                {processingPack === pack.id && (
                                    <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                        <Loader2 className="animate-spin text-emerald-600" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* History Section */}
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                            <History size={16} strokeWidth={3} />
                        </div>
                        Transaction History
                    </h2>

                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                        {loadingHistory ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div>
                        ) : transactions.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm font-medium">No transactions yet</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                                }`}>
                                                {tx.amount > 0 ? <Plus size={18} /> : <IndianRupee size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{tx.description}</p>
                                                <p className="text-[10px] font-medium text-gray-400">
                                                    {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
