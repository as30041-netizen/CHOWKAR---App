import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useWallet } from '../contexts/WalletContext';
import { supabase } from '../lib/supabase';
import { COIN_PACKS, initiatePayment } from '../services/paymentService';
import { ArrowLeft, Wallet, History, Plus, AlertCircle, CheckCircle2, Loader2, IndianRupee, Zap, HelpCircle } from 'lucide-react';
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
            // 1. Pre-warm Payment Engine (Fire & Forget)
            supabase.functions.invoke('create-razorpay-order', { method: 'GET' })
                .then(() => console.log('[Wallet] Payment engine warmed up'))
                .catch(err => console.warn('[Wallet] Warm-up failed', err));

            // 2. Fetch History
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
                // Refresh balance immediately and retry a few times for webhook lag
                await refreshWallet();

                // Polling retry (3 times over 6 seconds) to catch webhook updates
                let attempts = 0;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    console.log(`[Wallet] Polling refresh (${attempts}/3)...`);
                    await refreshWallet();
                    if (attempts >= 3) clearInterval(pollInterval);
                }, 2000);

                // Check if we need to return to a job bid
                const pendingJobId = sessionStorage.getItem('pendingBidJobId');
                if (pendingJobId) {
                    navigate('/');
                } else {
                    alert(language === 'en' ? 'Payment Successful! Coins will be added shortly.' : 'भुगतान सफल! सिक्के शीघ्र ही जुड़ जाएंगे।');
                }
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pt-safe transition-colors duration-500">
            {/* 1. HEADER (Compact) - Hidden on desktop as main header is visible */}
            <div className="px-6 py-3 flex md:hidden items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1.5 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>
                <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Wallet</h1>
                <button className="p-1.5 -mr-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <HelpCircle size={20} strokeWidth={2} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-safe">
                <div className="p-4 space-y-6">

                    {/* 2. COMPACT HOLOGRAPHIC CARD */}
                    <div className="relative w-full h-40 rounded-3xl p-6 text-white shadow-xl transform transition-transform hover:scale-[1.01] duration-500 group overflow-hidden">
                        {/* Realistic Card Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black dark:from-gray-800 dark:via-gray-900 dark:to-black z-0" />

                        {/* Metallic Sheen/Mesh */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-50 z-0 pointer-events-none group-hover:opacity-70 transition-opacity" />
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-[60px]" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[60px]" />

                        {/* Content */}
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-gray-400 text-[9px] font-black uppercase tracking-[0.1em] mb-1">Total Balance</p>
                                    <h2 className="text-3xl font-black tracking-tighter flex items-baseline gap-1.5 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                                        {walletBalance}
                                        <span className="text-sm font-bold text-gray-500">Coins</span>
                                    </h2>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                                    <Wallet size={16} className="text-emerald-400" />
                                </div>
                            </div>

                            <div className="flex justify-between items-end opacity-80">
                                <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-gray-300 tracking-wider">
                                    **** 8842
                                </div>
                                <div className="text-[10px] font-bold tracking-widest uppercase text-white/90">{user.name}</div>
                            </div>
                        </div>
                    </div>

                    {/* 3. COMPACT PACKS (Horizontal Chips) */}
                    <div>
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
                            Top Up Actions
                        </h3>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 snap-x">
                            {COIN_PACKS.map(pack => (
                                <button
                                    key={pack.id}
                                    disabled={!!processingPack}
                                    onClick={() => handleBuy(pack.id)}
                                    className="snap-start flex-shrink-0 relative group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 p-3 rounded-2xl transition-all shadow-sm active:scale-95 min-w-[100px] flex flex-col items-center justify-center gap-1"
                                >
                                    {pack.save > 0 && (
                                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg">
                                            -{pack.save}%
                                        </div>
                                    )}

                                    <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{pack.coins}</div>
                                    <div className="text-[9px] font-black uppercase text-gray-400">Coins</div>
                                    <div className="mt-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded w-full">
                                        ₹{pack.price}
                                    </div>

                                    {processingPack === pack.id && (
                                        <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
                                            <Loader2 className="animate-spin text-emerald-600" size={16} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. COMPACT HISTORY LIST */}
                    <div>
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3 px-1">Recent</h3>
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                            {loadingHistory ? (
                                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
                            ) : transactions.length === 0 ? (
                                <div className="p-8 text-center opacity-50">
                                    <History size={24} className="mx-auto mb-2 text-gray-300" />
                                    <p className="text-xs font-bold">No transactions</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="p-3.5 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer active:bg-gray-100 dark:active:bg-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-base transition-transform group-hover:scale-105 ${tx.amount > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                    }`}>
                                                    {tx.amount > 0 ? <Plus size={16} strokeWidth={3} /> : <ArrowLeft size={16} strokeWidth={3} className="rotate-45" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white text-xs mb-0.5">{tx.description}</div>
                                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                        {new Date(tx.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-sm font-black tracking-tight ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900 dark:text-white'
                                                }`}>
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
        </div>
    );
};
