import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useWallet } from '../contexts/WalletContext';
import { useLoading } from '../contexts/LoadingContext';
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
    const [isVerifying, setIsVerifying] = useState(false);
    const { showLoading, hideLoading } = useLoading();

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
        showLoading('Processing Payment...');
        try {
            const result = await initiatePayment(packId, user.id) as any;
            if (result.success) {
                // If verification was instant, we can skip the long polling
                if (result.isInstant) {
                    console.log('[Wallet] Instant Verification! Refreshing once.');
                    await refreshWallet();
                    setIsVerifying(false);
                } else {
                    setIsVerifying(true);
                    // Refresh balance immediately and retry for webhook lag
                    await refreshWallet();

                    // Polling retry (10 times over 20 seconds) to catch webhook updates
                    let attempts = 0;
                    const pollInterval = setInterval(async () => {
                        attempts++;
                        console.log(`[Wallet] Polling refresh (${attempts}/10)...`);
                        await refreshWallet();
                        if (attempts >= 10) {
                            clearInterval(pollInterval);
                            setIsVerifying(false);
                        }
                    }, 2000);
                }

                // Check if we need to return to a job bid
                const pendingJobId = sessionStorage.getItem('pendingBidJobId');
                if (pendingJobId) {
                    sessionStorage.removeItem('pendingBidJobId');
                    navigate(`/job/${pendingJobId}`, { state: { openBid: pendingJobId } });
                }
            } else {
                alert(result.error || 'Payment Failed');
            }
        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setProcessingPack(null);
            hideLoading();
        }
    };

    // Group transactions by date
    const groupedTransactions = transactions.reduce((acc, tx) => {
        const dateStr = new Date(tx.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const displayDate = dateStr === today ? (language === 'en' ? 'Today' : 'आज') : dateStr;

        if (!acc[displayDate]) acc[displayDate] = [];
        acc[displayDate].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    return (
        <div className="min-h-screen bg-background flex flex-col transition-colors duration-500">
            {/* 1. HEADER (Compact) - Standardized Premium Style */}
            <div className="bg-surface/95 backdrop-blur-xl px-4 py-3 shadow-sm border-b border-border flex items-center justify-between z-40 sticky top-0 pt-safe transition-all duration-300 md:hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-1 rounded-full hover:bg-background text-text-secondary transition-colors"
                    >
                        <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-black tracking-tight text-text-primary uppercase">{language === 'en' ? 'My Wallet' : 'मेरा वॉलेट'}</h1>
                </div>
                <button className="p-2 -mr-1 text-text-muted hover:text-text-primary transition-colors">
                    <HelpCircle size={22} strokeWidth={2} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-safe">
                <div className="p-4 space-y-6">

                    {/* 2. FUNCTIONAL PREMIUM BALANCE DASHBOARD */}
                    <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 shadow-2xl shadow-indigo-500/10 transition-all duration-500 hover:shadow-indigo-500/20 active:scale-[0.98] group">
                        {/* Background Accents */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-emerald-500/5" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />

                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">
                                        <Zap size={10} className="fill-indigo-400 text-indigo-400" />
                                        Verified Account
                                    </span>
                                    <div className="space-y-1">
                                        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest pl-1">Available Balance</p>
                                        <div className="flex items-baseline gap-2">
                                            <h2 className="text-5xl font-black tracking-tighter text-white tabular-nums leading-none">
                                                {walletBalance}
                                            </h2>
                                            <span className="text-xl font-bold text-white/40 tracking-tight">COINS</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform duration-500">
                                    <Wallet size={28} className="text-white" />
                                </div>
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="flex flex-col gap-1">
                                    <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">Account Holder</p>
                                    <p className="text-sm font-bold text-white tracking-wide uppercase">{user.name || 'Partner Account'}</p>
                                </div>
                                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                                    <p className="text-[10px] font-black text-white/60 tracking-widest">**** 8842</p>
                                </div>
                            </div>
                        </div>

                        {/* Metallic Scanline Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                    </div>

                    {/* 3. COMPACT PACKS (Horizontal Chips) */}
                    <div>
                        <div className="flex items-end justify-between mb-4 px-1">
                            <h3 className="text-[11px] font-black text-text-primary uppercase tracking-[0.15em] flex items-center gap-2">
                                <IndianRupee size={12} className="text-emerald-500" />
                                {language === 'en' ? 'Quick Top Up' : 'त्वरित रीचार्ज'}
                            </h3>
                            <button className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline transition-all">View All Offers</button>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 snap-x">
                            {COIN_PACKS.map(pack => (
                                <button
                                    key={pack.id}
                                    disabled={!!processingPack}
                                    onClick={() => handleBuy(pack.id)}
                                    className="snap-start flex-shrink-0 relative group bg-surface border border-border hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 p-4 rounded-[2rem] transition-all shadow-sm active:scale-95 min-w-[120px] flex flex-col items-center justify-center gap-2 overflow-hidden"
                                >
                                    {pack.save > 0 && (
                                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-2xl shadow-lg">
                                            -{pack.save}%
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-2xl font-black text-text-primary tabular-nums tracking-tighter">{pack.coins}</span>
                                        <span className="text-[9px] font-black uppercase text-text-muted mt-1.5">Coins</span>
                                    </div>
                                    <div className="w-full text-center py-2 px-3 text-xs font-black text-white bg-emerald-500 rounded-2xl shadow-md group-hover:bg-emerald-600 transition-colors">
                                        ₹{pack.price}
                                    </div>

                                    {processingPack === pack.id && (
                                        <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm flex items-center justify-center z-20">
                                            <Loader2 className="animate-spin text-emerald-600" size={20} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. DYNAMIC HISTORY LIST - Grouped by Date */}
                    <div>
                        <h3 className="text-[11px] font-black text-text-primary uppercase tracking-[0.15em] mb-4 flex items-center gap-2 px-1">
                            <History size={12} className="text-indigo-500" />
                            {language === 'en' ? 'Transaction History' : 'लेनदेन का इतिहास'}
                        </h3>
                        {loadingHistory ? (
                            <div className="bg-surface border border-border rounded-[2rem] p-8 flex justify-center shadow-sm">
                                <Loader2 className="animate-spin text-text-muted" size={24} />
                            </div>
                        ) : Object.keys(groupedTransactions).length === 0 ? (
                            <div className="bg-surface border border-border rounded-[2rem] p-12 text-center shadow-sm">
                                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                    <History size={32} className="text-text-muted opacity-30" />
                                </div>
                                <p className="text-sm font-bold text-text-secondary">{language === 'en' ? 'No transactions yet' : 'अभी तक कोई लेनदेन नहीं'}</p>
                                <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{language === 'en' ? 'Top up to start bidding' : 'बोली लगाने के लिए टॉप अप करें'}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(groupedTransactions).map(([date, txs]) => (
                                    <div key={date} className="space-y-3">
                                        <div className="px-2 items-center flex gap-3">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{date}</span>
                                            <div className="flex-1 h-px bg-border/50" />
                                        </div>
                                        <div className="bg-surface border border-border rounded-[2rem] shadow-sm overflow-hidden divide-y divide-border/50">
                                            {txs.map(tx => (
                                                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-background/50 transition-all group active:bg-background/80">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-base transition-all group-hover:scale-110 ${tx.amount > 0
                                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                                                            : 'bg-slate-50 dark:bg-slate-500/10 text-slate-500'
                                                            }`}>
                                                            {tx.amount > 0 ? <Plus size={20} strokeWidth={3} /> : <Zap size={20} className="fill-current opacity-40 text-slate-400" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-text-primary text-sm mb-0.5 tracking-tight">{tx.description}</div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">
                                                                    {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${tx.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                                                    }`}>
                                                                    {tx.type}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`text-lg font-black tracking-tighter tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-text-primary'
                                                        }`}>
                                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* 5. VERIFYING PAYMENT OVERLAY */}
            {isVerifying && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="text-center space-y-6 max-w-xs px-6">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                            <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="text-emerald-500 fill-emerald-500 animate-pulse" size={32} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-text-primary tracking-tight">Verifying Payment...</h3>
                            <p className="text-sm font-medium text-text-secondary leading-relaxed">
                                Please wait while we confirm your transaction and update your balance.
                            </p>
                        </div>

                        {/* Manual Refresh Option (Shows after 10s) */}
                        <div className="pt-4 flex flex-col gap-3">
                            <div className="flex justify-center gap-2 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                            </div>

                            <button
                                onClick={async () => {
                                    showLoading('Refreshing...');
                                    await refreshWallet();
                                    hideLoading();
                                }}
                                className="px-6 py-3 bg-surface border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-primary hover:bg-background transition-all active:scale-95"
                            >
                                {language === 'en' ? 'Check Balance Again' : 'बैलेंस फिर से जांचें'}
                            </button>

                            <button
                                onClick={() => setIsVerifying(false)}
                                className="text-[10px] font-bold text-text-muted hover:text-text-primary underline uppercase tracking-widest"
                            >
                                {language === 'en' ? 'Close Overlay' : 'बंद करें'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
