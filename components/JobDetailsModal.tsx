import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { X, ArrowLeft, XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee, UserCircle, Users, ChevronRight, Loader2, Clock, Handshake, Trash2, Navigation, CheckCircle, Heart, MessageCircle, Phone, Sparkles, Languages, RotateCw, TrendingUp, Zap, Shield, Briefcase } from 'lucide-react';
import { Job, UserRole, JobStatus } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { supabase } from '../lib/supabase';
import { LeafletMap } from './LeafletMap';
import { translateJobDetails } from '../services/geminiService';

interface JobDetailsModalProps {
    job: Job | null;
    onClose: () => void;
    onBid: (jobId: string) => void;
    onViewBids: (job: Job) => void;
    onChat: (job: Job) => void;
    onEdit: (job: Job) => void;
    onDelete: (jobId: string) => void;
    onCancel?: (jobId: string) => void;
    onReplyToCounter?: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
    onViewProfile: (userId: string, name?: string, phoneNumber?: string) => void;
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
    onCompleteJob?: (job?: Job) => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job, onClose, onBid, onViewBids, onChat, onEdit, onDelete, onCancel, onReplyToCounter, onViewProfile, showAlert, onCompleteJob
}) => {
    const { user, role, t, language, isAuthLoading } = useUser();
    const { getJobWithFullDetails, jobs, saveJobTranslation } = useJobs();
    const [showCounterInput, setShowCounterInput] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Translation State (Transient UI state only)
    const [isTranslating, setIsTranslating] = React.useState(false);
    const [showTranslated, setShowTranslated] = React.useState(false);
    const [localTranslation, setLocalTranslation] = React.useState<{ title: string, description: string } | null>(null);
    const [hasManuallyHidden, setHasManuallyHidden] = React.useState(false);

    // Initial touch states
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

    useEffect(() => {
        if (job?.id) {
            // Use cache (10s freshness) instead of forcing a DB call every time the modal mounts
            getJobWithFullDetails(job.id);
        }
        // Reset translation state when job changes
        setShowTranslated(false);
        setLocalTranslation(null);
        setHasManuallyHidden(false);
    }, [job?.id, getJobWithFullDetails]);


    // --- REALTIME SYNC (Added for Dealer/Negotiation Speed) ---
    const realtimeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // 1. Hybrid Sync (Focus/Online - Refetch on app switch)
    useEffect(() => {
        if (!job?.id) return;

        const handleFocus = () => {
            if (!document.hidden && job?.id) {
                console.log('[JobDetails] 📱 App foregrounded - Triggering Refetch...');
                getJobWithFullDetails(job.id, true);
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);
        window.addEventListener('online', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
            window.removeEventListener('online', handleFocus);
        };
    }, [job?.id, getJobWithFullDetails]);

    // 2. Direct Realtime Subscription (Watch Bids Table)
    useEffect(() => {
        if (!job?.id) return;

        console.log('[JobDetails] Setting up realtime subscription for job:', job.id);

        const channel = supabase
            .channel(`job_details_${job.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bids',
                    filter: `job_id=eq.${job.id}`
                },
                (payload) => {
                    console.log('[JobDetails] Bid change detected via Realtime:', payload.eventType);
                    // Debounce the refetch to avoid spamming validity checks
                    if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
                    realtimeTimeoutRef.current = setTimeout(() => {
                        console.log('[JobDetails] Refetching due to change...');
                        getJobWithFullDetails(job.id, true);
                    }, 800);
                }
            )
            .subscribe();

        return () => {
            if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [job?.id, getJobWithFullDetails]);

    // Use live job data from context if available to handle real-time updates
    const liveJob = jobs.find(j => j.id === job?.id) || job;

    // Auto-show cached translation if available for user's language
    React.useEffect(() => {
        if (liveJob?.translations?.[language] && !localTranslation && !hasManuallyHidden) {
            setLocalTranslation(liveJob.translations[language]);
            setShowTranslated(true);
        }
    }, [liveJob?.translations, language, localTranslation, hasManuallyHidden]);

    if (!liveJob) return null;

    // Dynamic SEO tags for browser tab and search engines
    const seoTitle = `${liveJob.title} | Chowkar`;
    const seoDescription = liveJob.description?.substring(0, 155) + (liveJob.description && liveJob.description.length > 155 ? '...' : '') || 'Find local jobs on Chowkar';

    // Use surgically fetched summary fields if full bids array is still loading
    const myBid = liveJob.bids.find(b => b.workerId === user.id) ||
        (liveJob.myBidId ? { id: liveJob.myBidId, status: liveJob.myBidStatus, amount: liveJob.myBidAmount } as any : null);

    // Compute lastTurnBy from actual bid data if available, otherwise use precomputed field
    const fullBid = liveJob.bids.find(b => b.workerId === user.id);
    const lastNegotiationEntry = fullBid?.negotiationHistory?.length
        ? fullBid.negotiationHistory[fullBid.negotiationHistory.length - 1]
        : null;
    const lastTurnBy = lastNegotiationEntry?.by || liveJob.myBidLastNegotiationBy;
    const currentStatus = myBid?.status || liveJob.myBidStatus;

    // Worker's turn if POSTER made the last move on a PENDING bid
    const isWorkerTurn = lastTurnBy === UserRole.POSTER && currentStatus === 'PENDING';

    const acceptedBid = liveJob.acceptedBidId ? liveJob.bids.find(b => b.id === liveJob.acceptedBidId) : null;
    const myBidStatus = liveJob.myBidStatus || myBid?.status;

    const isAcceptedWorker = (
        (currentStatus === 'ACCEPTED') || // Simple check first (matches JobCard)
        (liveJob.acceptedBidId && acceptedBid && user.id === acceptedBid.workerId) ||
        (liveJob.workerId === user.id)
    );
    const isParticipant = user.id === liveJob.posterId || isAcceptedWorker;

    // Translation Logic
    const handleTranslate = async () => {
        if (showTranslated) {
            setShowTranslated(false);
            setLocalTranslation(null);
            setHasManuallyHidden(true); // User explicitly wanted original
            return;
        }

        // If we already have it in cache (global job object), just show it
        if (liveJob.translations && liveJob.translations[language]) {
            setLocalTranslation(liveJob.translations[language]);
            setShowTranslated(true);
            return;
        }

        setIsTranslating(true);
        try {
            const result = await translateJobDetails(liveJob.title, liveJob.description, language);
            if (result && result.title && result.description) {
                // Store locally for immediate display
                setLocalTranslation(result);
                setShowTranslated(true);
                // Save to Global Cache (DB + Context) - async, can fail
                saveJobTranslation(liveJob.id, language, result.title, result.description);
            } else {
                showAlert(t.translateError || 'Translation failed', 'error');
            }
        } catch (err) {
            console.error(err);
            showAlert('Translation error', 'error');
        } finally {
            setIsTranslating(false);
        }
    };

    // Use local translation (instant) or context translation (cached), fallback to original
    const displayTitle = (showTranslated && localTranslation?.title) || liveJob.title;
    const displayDescription = (showTranslated && localTranslation?.description) || liveJob.description;

    const handleSubmitCounter = async () => {
        if (!user.id || !myBid || !onReplyToCounter || !counterAmount || isProcessing) return;

        const amount = parseInt(counterAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert(t.alertInvalidAmount, 'error');
            return;
        }

        setIsProcessing(true);
        try {
            await onReplyToCounter(liveJob.id, myBid.id, 'COUNTER', amount);
            setShowCounterInput(false);
            setCounterAmount('');
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    // Minimum distance for a swipe to be registered
    const minSwipeDistance = 75;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none md:p-6">
            {/* Dynamic SEO for browser tab and search engines */}
            <Helmet>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDescription} />
            </Helmet>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg pointer-events-auto transition-opacity" onClick={onClose} />
            <div
                className="w-full h-full md:w-[95vw] md:h-[90vh] bg-white dark:bg-gray-950 md:rounded-[2.5rem] p-0 pointer-events-auto animate-in slide-in-from-right duration-300 relative overflow-hidden flex flex-col md:flex-row transition-all shadow-2xl pt-safe pb-safe md:pt-0 md:pb-0 border-0 md:border border-white/10 dark:border-gray-800/50"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Standardized Premium Header (Standard for all modals now) */}
                <div className="absolute top-0 inset-x-0 h-16 md:h-16 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-white/10 dark:border-gray-800/50 flex items-center justify-between px-4 z-[60] md:hidden pt-safe box-content">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 -ml-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-text-primary transition-all active:scale-95"
                        >
                            <ArrowLeft size={22} strokeWidth={2.5} />
                        </button>
                        <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">{language === 'en' ? 'Job Details' : 'कार्य का विवरण'}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Status Chip in Header */}
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${liveJob.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : liveJob.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-surface text-text-muted border-border'
                            }`}>
                            {String(liveJob.status || 'UNKNOWN').replace('_', ' ')}
                        </span>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-background">
                    {/* 1. HERO SECTION (Visual Impact - Typography Focused) */}
                    <div className="relative w-full bg-surface pt-20 md:pt-10 pb-6 px-6 md:px-10 border-b border-border/50">
                        {/* Category & Status */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border border-primary/20">
                                    {liveJob.category || 'General'}
                                </span>
                                {job?.posterRating && job.posterRating > 0 && (
                                    <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 text-[10px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border border-yellow-500/20">
                                        <Star size={10} fill="currentColor" /> {job.posterRating.toFixed(1)}
                                    </span>
                                )}
                            </div>
                            {/* Status Chip */}
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${liveJob.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                liveJob.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                    'bg-surface text-text-muted border-border'
                                }`}>
                                {String(liveJob.status || 'UNKNOWN').replace('_', ' ')}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-black text-text-primary leading-[1.1] tracking-tight mb-2">
                            {displayTitle}
                        </h1>

                        {/* Quick Distance/Time subtext */}
                        <div className="flex items-center gap-3 text-xs text-text-secondary font-medium">
                            <span>Posted {new Date(liveJob.createdAt).toLocaleDateString()}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span>{job?.location}</span>
                        </div>
                    </div>

                    <div className="p-6 md:p-10 space-y-8 bg-background">
                        {/* 1. KEY STATS BAR (Budget • Duration • Status) */}
                        <div className="flex items-center gap-3 overflow-x-auto pb-2 [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {/* Budget Pill */}
                            <div className="px-4 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 shrink-0">
                                <IndianRupee size={16} strokeWidth={2.5} />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{t.budget}</span>
                                    <span className="text-sm font-black">₹{liveJob.budget}</span>
                                </div>
                            </div>

                            {/* Duration Pill */}
                            <div className="px-4 py-2 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center gap-2 shrink-0">
                                <Clock size={16} strokeWidth={2.5} />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{t.duration}</span>
                                    <span className="text-sm font-black">{liveJob.duration?.replace('For ', '') || 'Flexible'}</span>
                                </div>
                            </div>

                            {/* Status Pill */}
                            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 shrink-0 ${liveJob.status === 'OPEN' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-700' :
                                'bg-surface border-border text-text-muted'
                                }`}>
                                <Sparkles size={16} strokeWidth={2.5} />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                                        {language === 'en' ? 'Status' : (language === 'hi' ? 'स्थिति' : 'ਸਥਿਤੀ')}
                                    </span>
                                    <span className="text-sm font-black">{String(liveJob.status || 'UNKNOWN').replace('_', ' ')}</span>
                                </div>
                            </div>
                        </div>

                        {/* 1.1 SMART INSIGHTS (Competition & Freshness) */}
                        <div className="flex flex-wrap gap-2">
                            {/* Competition Badge */}
                            {(liveJob.bidCount || 0) > 5 ? (
                                <div className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider border border-red-500/20 flex items-center gap-1.5 animate-pulse-subtle">
                                    <TrendingUp size={12} strokeWidth={3} />
                                    {language === 'en' ? 'In High Demand' : (language === 'hi' ? 'भारी मांग में' : 'ਬਹੁਤ ਮੰਗ ਵਿੱਚ')}
                                </div>
                            ) : (
                                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1.5">
                                    <Sparkles size={12} strokeWidth={3} />
                                    {language === 'en' ? 'Low Competition' : (language === 'hi' ? 'आसान मुकाबला' : 'ਘੱਟ ਮੁਕਾਬਲਾ')}
                                </div>
                            )}

                            {/* Freshness Badge */}
                            {(Date.now() - liveJob.createdAt) < 24 * 60 * 60 * 1000 && (
                                <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider border border-blue-500/20 flex items-center gap-1.5">
                                    <Clock size={12} strokeWidth={3} />
                                    {language === 'en' ? 'New Posting' : (language === 'hi' ? 'नई पोस्ट' : 'ਨਵੀਂ ਪੋਸਟ')}
                                </div>
                            )}

                            {/* Success Rate/Trust Badge */}
                            {job?.posterRating && job.posterRating >= 4.5 && (
                                <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/20 flex items-center gap-1.5">
                                    <CheckCircle size={12} strokeWidth={3} />
                                    {language === 'en' ? 'Trusted Employer' : (language === 'hi' ? 'भरोसेमंद मालिक' : 'ਭਰੋਸੇਮੰਦ ਮਾਲਕ')}
                                </div>
                            )}
                        </div>

                        {/* 2. DESCRIPTION (Restored & Elevated) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-4 bg-primary rounded-full px-0.5" />
                                    {language === 'en' ? 'Task Scope & Details' : (language === 'hi' ? 'कार्य का विवरण' : 'ਕੰਮ ਦਾ ਵੇਰਵਾ')}
                                </h4>
                                <button
                                    onClick={handleTranslate}
                                    disabled={isTranslating}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${showTranslated
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-surface border border-border text-text-muted hover:border-primary/50 hover:text-primary'
                                        }`}
                                >
                                    {isTranslating ? <RotateCw size={10} className="animate-spin" /> : <Languages size={10} strokeWidth={2.5} />}
                                    {isTranslating ? t.translating : (showTranslated ? t.showOriginal : t.translate)}
                                </button>
                            </div>
                            <div className="text-base text-text-primary whitespace-pre-wrap font-medium leading-[1.7] tracking-tight pl-2 border-l-2 border-border/50">
                                {displayDescription}
                            </div>
                        </div>

                        {/* 2.1 HOW IT WORKS (Process Guide) */}
                        <div className="bg-surface/50 rounded-3xl p-6 border border-border/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Shield size={16} strokeWidth={3} />
                                </div>
                                <h4 className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">
                                    {language === 'en' ? 'How it Works' : (language === 'hi' ? 'यह कैसे काम करता है' : 'ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ')}
                                </h4>
                            </div>

                            <div className="grid grid-cols-3 gap-2 relative">
                                {/* Connector Line */}
                                <div className="absolute top-4 left-[20%] right-[20%] h-0.5 bg-border/50 -z-0 hidden sm:block" />

                                <div className="flex flex-col items-center gap-3 text-center relative z-10">
                                    <div className="w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-black text-primary shadow-sm">1</div>
                                    <span className="text-[10px] font-bold text-text-secondary leading-tight">
                                        {language === 'en' ? 'Send Bid' : (language === 'hi' ? 'बोली लगायें' : 'ਬੋਲੀ ਲਗਾਓ')}
                                    </span>
                                </div>

                                <div className="flex flex-col items-center gap-3 text-center relative z-10">
                                    <div className="w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center text-xs font-black text-text-muted">2</div>
                                    <span className="text-[10px] font-bold text-text-muted leading-tight">
                                        {language === 'en' ? 'Accept & Chat' : (language === 'hi' ? 'स्वीकार और चैट' : 'ਸਵੀਕਾਰ ਕਰੋ ਅਤੇ ਚੈਟ ਕਰੋ')}
                                    </span>
                                </div>

                                <div className="flex flex-col items-center gap-3 text-center relative z-10">
                                    <div className="w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center text-xs font-black text-text-muted">3</div>
                                    <span className="text-[10px] font-bold text-text-muted leading-tight">
                                        {language === 'en' ? 'Work & Pay' : (language === 'hi' ? 'काम और पैसा' : 'ਕੰਮ ਅਤੇ ਪੈਸਾ')}
                                    </span>
                                </div>
                            </div>

                            {/* Pro Tip (For Workers) */}
                            {role === UserRole.WORKER && (
                                <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                        <Zap size={14} fill="currentColor" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Pro Tip</p>
                                        <p className="text-xs text-text-secondary font-medium leading-relaxed">
                                            {language === 'en'
                                                ? "Employers value speed. Apply fast to stay on top of the list!"
                                                : (language === 'hi' ? "मालिक गति को महत्व देते हैं। सूची में शीर्ष पर रहने के लिए जल्दी आवेदन करें!" : "ਮਾਲਕ ਗਤੀ ਨੂੰ ਮਹੱਤਵ ਦਿੰਦੇ ਹਨ। ਸੂਚੀ ਵਿੱਚ ਸਿਖਰ 'ਤੇ ਰਹਿਣ ਲਈ ਜਲਦੀ ਅਰਜ਼ੀ ਦਿਓ!")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2.2 VALUE PROP (Zero Commission) */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                            <Handshake size={14} className="text-emerald-500" strokeWidth={3} />
                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                {language === 'en'
                                    ? "Zero Commission Platform • Pay 100% to Worker"
                                    : (language === 'hi' ? "कोई कमीशन नहीं • वर्ਕਰ को सीधा पूरा भुगतान करें" : "ਜ਼ੀਰੋ ਕਮਿਸ਼ਨ ਪਲੇਟਫਾਰਮ • ਵਰਕਰ ਨੂੰ 100% ਭੁਗਤਾਨ ਕਰੋ")}
                            </p>
                        </div>

                        {/* 0. NEGOTIATION STATUS CARD (Top Priority - Kept as is) */}
                        {myBid && (
                            <div className={`p-6 md:p-8 rounded-[2rem] border-2 border-dashed relative overflow-hidden group shadow-sm w-full mx-auto ${isWorkerTurn
                                ? 'bg-amber-500/5 border-amber-500/20'
                                : 'bg-indigo-500/5 border-indigo-500/20'
                                }`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 ${isWorkerTurn ? 'text-amber-600' : 'text-indigo-600'
                                    }`}>
                                    {isWorkerTurn ? <AlertCircle size={14} /> : <Clock size={14} />}
                                    {language === 'en' ? 'Negotiation Status' : (language === 'hi' ? 'मोलभाव की स्थिति' : 'ਬਾਤਚੀਤ ਦੀ ਸਥਿਤੀ')}
                                </h4>

                                <div className="flex items-center justify-between relative z-10 max-w-3xl mx-auto">
                                    {/* Left: Original */}
                                    <div className="flex flex-col items-start">
                                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1.5 opacity-70">
                                            {language === 'en' ? 'Original' : (language === 'hi' ? 'मूल प्रस्ताव' : 'ਅਸਲ ਪੇਸ਼ਕਸ਼')}
                                        </span>
                                        <span className="text-xl md:text-3xl font-black text-text-secondary/40 line-through decoration-auto">
                                            ₹{liveJob.budget}
                                        </span>
                                    </div>

                                    {/* Middle: Arrow (Responsive) */}
                                    <div className="flex-1 px-4 md:px-12 flex flex-col items-center justify-center opacity-80">
                                        <div className={`h-0.5 w-full relative rounded-full ${isWorkerTurn ? 'bg-amber-500/30' : 'bg-indigo-500/30'
                                            }`}>
                                            <div className={`absolute right-0 -top-1 w-2.5 h-2.5 rotate-45 border-t-2 border-r-2 ${isWorkerTurn ? 'border-amber-500/50' : 'border-indigo-500/50'
                                                }`} />
                                        </div>
                                    </div>

                                    {/* Right: Current */}
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${isWorkerTurn ? 'text-amber-600' : 'text-indigo-600'
                                            }`}>
                                            {isWorkerTurn
                                                ? (language === 'en' ? 'Poster Counter' : (language === 'hi' ? 'मालिक का प्रस्ताव' : 'ਮਾਲਕ ਦੀ ਪੇਸ਼ਕਸ਼'))
                                                : (language === 'en' ? 'Your Offer' : (language === 'hi' ? 'आपका प्रस्ताव' : 'ਤੁਹਾਡੀ ਪੇਸ਼ਕਸ਼'))
                                            }
                                        </span>
                                        <div className={`px-5 py-2.5 md:py-3 md:px-6 rounded-2xl text-xl md:text-3xl font-black shadow-lg shadow-black/5 flex items-center gap-3 transform transition-all group-hover:scale-105 ${isWorkerTurn
                                            ? 'bg-amber-500 text-white shadow-amber-500/30'
                                            : 'bg-indigo-600 text-white shadow-indigo-500/30'
                                            }`}>
                                            ₹{myBid.amount}
                                            {isWorkerTurn && <AlertCircle size={20} className="animate-pulse" strokeWidth={3} />}
                                        </div>
                                    </div>
                                </div>

                                {isWorkerTurn && (
                                    <div className="mt-6 flex justify-center">
                                        <p className="inline-block text-[10px] md:text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-4 py-2 rounded-xl border border-amber-500/10 text-center animate-pulse-subtle">
                                            {language === 'en'
                                                ? "Action Required: The employer updated the price."
                                                : "मालिक ने कीमत बदल दी है। ध्यान दें!"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. POSTER CARD (Renumbered) & OTHER SECTIONS */}

                        {/* 4. PREMIUM POSTER CARD (Mobile & Desktop Unified Style) */}
                        {user.id !== liveJob.posterId && (
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                                    {language === 'en' ? 'Posted By' : 'प्रकाशक'}
                                </h4>
                                <div
                                    className="flex items-center justify-between bg-surface p-5 rounded-[2.5rem] border border-border/50 cursor-pointer hover:border-primary/50 transition-all shadow-sm group relative overflow-hidden"
                                    onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName)}
                                >
                                    {/* Decorative BG */}
                                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />

                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-16 h-16 rounded-2xl bg-background border border-border/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                            {liveJob.posterPhoto ? (
                                                <img src={liveJob.posterPhoto} alt={liveJob.posterName || 'User'} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <UserCircle size={36} className="text-text-muted" />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-black text-base text-text-primary flex items-center gap-2 group-hover:text-primary transition-colors">
                                                {liveJob.posterName || 'Partner Account'}
                                                {job?.posterRating && job.posterRating >= 4.5 && <Sparkles size={12} className="text-amber-500" fill="currentColor" />}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex gap-0.5 bg-background px-1.5 py-0.5 rounded-md border border-border/50">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} size={8} className={i < (liveJob.posterRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'} />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-text-muted">{liveJob.posterRating || 5.0}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted">
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    <span className="flex items-center gap-1 uppercase tracking-tighter">
                                                        {language === 'en' ? 'Member since 2024' : (language === 'hi' ? '2024 से सदस्य' : '2024 ਤੋਂ ਮੈਂਬਰ')}
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    <span className="flex items-center gap-1 uppercase tracking-tighter">
                                                        <Briefcase size={10} /> {language === 'en' ? 'Multiple Posts' : (language === 'hi' ? 'कई पोस्ट' : 'ਕਈ ਪੋਸਟਾਂ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-text-muted border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all relative z-10">
                                        <ChevronRight size={18} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. INTERACTIVE MAP PREVIEW */}
                        {liveJob.coordinates && (
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                    {language === 'en' ? 'Job Location' : 'कार्य का स्थान'}
                                </h4>
                                <div className="relative rounded-[2.5rem] overflow-hidden border border-border h-64 shadow-sm group/map z-0">
                                    <LeafletMap lat={liveJob.coordinates.lat} lng={liveJob.coordinates.lng} popupText={liveJob.location} />
                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none flex justify-end">
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${liveJob.coordinates.lat},${liveJob.coordinates.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-white dark:bg-gray-900 text-text-primary text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all pointer-events-auto border border-white/20"
                                        >
                                            <Navigation size={12} fill="currentColor" /> {language === 'en' ? 'Directions' : 'दिशा'}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-[10px] font-medium text-text-muted mt-2 ml-4 flex items-center gap-1.5 leading-none">
                                    <Shield size={10} className="text-emerald-500/50" />
                                    {language === 'en'
                                        ? 'Approximate location shown to protect user privacy'
                                        : (language === 'hi' ? 'उपयोगकर्ता की गोपनीयता बनाए रखने के लिए अनुमानित स्थान दिखाया गया है' : 'ਉਪਭੋਗਤਾ ਦੀ ਗੋਪਨੀਯਤਾ ਦੀ ਰੱਖਿਆ ਲਈ ਅਨੁਮਾਨਿਤ ਸਥਾਨ ਦਿਖਾਇਆ ਗਿਆ ਹੈ')}
                                </p>
                            </div>
                        )}

                        {/* 6. BIDS PREVIEW (For Poster - Quick Insight) */}
                        {role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && liveJob.bids && liveJob.bids.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-3 bg-emerald-500/50 rounded-full" />
                                    {language === 'en' ? 'Bids Received' : 'प्राप्त बोलियां'}
                                </h4>
                                <div className="grid gap-2">
                                    {liveJob.bids.slice(0, 2).map((bid) => (
                                        <div key={bid.id} className="bg-surface/50 border border-border/30 p-4 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center overflow-hidden border border-border/30">
                                                    {bid.workerPhoto ? (
                                                        <img src={bid.workerPhoto} alt={bid.workerName} className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <UserCircle size={20} className="text-text-muted" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs text-text-primary">{bid.workerName || 'Expert Partner'}</p>
                                                    <p className="text-[10px] font-black text-emerald-600">₹{bid.amount}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={6} className={i < (bid.workerRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-border'} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => onViewBids(liveJob)}
                                        className="w-full bg-surface border border-border/30 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
                                    >
                                        {language === 'en' ? `View All ${liveJob.bids.length} Bids` : `सभी ${liveJob.bids.length} बोलियां देखें`} <ChevronRight size={10} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 7. REVIEWS BREAKDOWN (For Completed Jobs) */}
                        {liveJob.status === JobStatus.COMPLETED && liveJob.reviews && liveJob.reviews.length > 0 && (
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                                    {language === 'en' ? 'Task Feedback' : 'कार्य प्रतिक्रिया'}
                                </h4>
                                <div className="grid gap-4">
                                    {liveJob.reviews.map((review) => (
                                        <div key={review.id} className="bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 p-6 rounded-[2.5rem] space-y-3 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <Star size={64} className="fill-amber-500 text-amber-500" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} size={14} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-border'} />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">Excellent</span>
                                            </div>
                                            <p className="text-sm text-text-secondary leading-relaxed font-medium italic">
                                                "{review.comment}"
                                            </p>
                                            <div className="flex items-center gap-2 pt-2 border-t border-amber-500/10">
                                                <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden border border-amber-500/20">
                                                    <UserCircle size={14} className="text-text-muted" />
                                                </div>
                                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{review.reviewerName || 'Partner'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 8. NEGOTIATION HISTORY (Worker View) */}
                        {myBid && myBid.negotiationHistory && myBid.negotiationHistory.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                                    <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                                    {language === 'en' ? 'Negotiation History' : 'बातचीत का इतिहास'}
                                </h4>
                                <div className="bg-surface border border-border/50 rounded-[2.5rem] p-6 shadow-sm space-y-6 relative overflow-hidden">
                                    {/* Vertical Line */}
                                    <div className="absolute left-[2.25rem] top-6 bottom-6 w-0.5 bg-border/50" />

                                    {myBid.negotiationHistory.map((entry: any, index: number) => {
                                        const isLast = index === myBid.negotiationHistory.length - 1;
                                        const isMe = (role === UserRole.WORKER && entry.by === 'WORKER') || (role === UserRole.POSTER && entry.by === 'POSTER');
                                        return (
                                            <div key={index} className="relative flex items-start gap-4">
                                                {/* Dot */}
                                                <div className={`w-3 h-3 rounded-full mt-1.5 z-10 shrink-0 border-2 ${isLast
                                                    ? (isMe ? 'bg-primary border-primary shadow-lg shadow-primary/30 scale-125' : 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/30 scale-125')
                                                    : 'bg-surface border-border'
                                                    }`} />

                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isMe ? 'text-primary' : 'text-orange-600'}`}>
                                                            {entry.by === 'WORKER' ? (language === 'en' ? 'Worker Offer' : 'वर्कर का प्रस्ताव') : (language === 'en' ? 'Poster Counter' : 'मालिक का प्रस्ताव')}
                                                        </span>
                                                        <span className="text-[9px] text-text-muted font-bold opacity-60">
                                                            {new Date(entry.at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className={`p-3 rounded-2xl border ${isMe ? 'bg-primary/5 border-primary/10' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                                        <p className="text-lg font-black text-text-primary tracking-tight">₹{entry.amount}</p>
                                                        {entry.message && <p className="text-xs text-text-secondary mt-1">"{entry.message}"</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 9. PLATFORM COMMITMENTS */}
                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <div className="p-3 bg-surface border border-border/30 rounded-2xl flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <Shield size={16} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">
                                        {language === 'en' ? 'Safety' : (language === 'hi' ? 'सुरक्षा' : 'ਸੁਰੱਖਿਆ')}
                                    </p>
                                    <p className="text-[10px] font-bold text-text-primary">
                                        {language === 'en' ? 'Verified Users' : (language === 'hi' ? 'सत्यापित उपयोगकर्ता' : 'ਤਸਦੀਕਸ਼ੁਦਾ ਉਪਭੋਗਤਾ')}
                                    </p>
                                </div>
                            </div>
                            <div className="p-3 bg-surface border border-border/30 rounded-2xl flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <Handshake size={16} strokeWidth={3} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">
                                        {language === 'en' ? 'Payment' : (language === 'hi' ? 'भुगतान' : 'ਭੁਗਤਾਨ')}
                                    </p>
                                    <p className="text-[10px] font-bold text-text-primary">
                                        {language === 'en' ? 'Direct & 0% Fees' : (language === 'hi' ? 'सीधा और 0% शुल्क' : 'ਸਿੱਧਾ ਅਤੇ 0% ਫੀਸ')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Spacer to avoid sticky footer overlap */}
                        <div className="h-24 md:hidden" />
                    </div>
                </div>

                {/* 6. MOBILE ACTION ISLAND (Sticky Footer) */}
                <div className="md:hidden fixed bottom-6 inset-x-4 z-50 mb-safe">
                    <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 shadow-2xl shadow-indigo-500/20 flex items-center gap-3">
                        {!myBid && liveJob.status === JobStatus.OPEN && role === UserRole.WORKER && (
                            <div className="pl-4 pr-2 border-r border-white/10 shrink-0">
                                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">{t.budget}</p>
                                <p className="text-lg font-black text-white tracking-tighter leading-none">₹{liveJob.budget}</p>
                            </div>
                        )}

                        <div className="flex-1 flex gap-2">
                            {/* Worker: Bid Action */}
                            {!isAuthLoading && role === UserRole.WORKER && liveJob.status === JobStatus.OPEN && liveJob.posterId !== user.id && !myBid && (
                                <button
                                    onClick={() => onBid(liveJob.id)}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {t.bidNow} <ChevronRight size={16} strokeWidth={4} />
                                </button>
                            )}

                            {/* Worker: Negotiation */}
                            {myBid && liveJob.status === JobStatus.OPEN && (
                                isWorkerTurn ? (
                                    <div className="flex w-full gap-2">
                                        <button
                                            onClick={() => { if (onReplyToCounter) onReplyToCounter(liveJob.id, myBid.id, 'ACCEPT'); onClose(); }}
                                            className="flex-1 bg-emerald-500 text-white h-14 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle size={16} /> {t.accept || 'Accept'}
                                        </button>
                                        <button
                                            onClick={() => setShowCounterInput(true)}
                                            className="flex-1 bg-white/10 text-white h-14 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-white/10"
                                        >
                                            <Handshake size={16} /> {t.counter || 'Counter'}
                                        </button>
                                        <button
                                            onClick={() => { if (confirm(t.withdrawConfirm)) onCancel?.(liveJob.id); onClose(); }}
                                            className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20"
                                        >
                                            <X size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full bg-indigo-500/10 text-indigo-300 h-14 rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 border border-indigo-500/20">
                                        <Clock size={16} /> {language === 'en' ? 'Offer Pending' : 'प्रस्ताव लंबित'}: ₹{myBid.amount}
                                    </div>
                                )
                            )}

                            {/* Poster: View Bids */}
                            {!isAuthLoading && role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.OPEN && (
                                <button
                                    onClick={() => onViewBids(liveJob)}
                                    className="w-full bg-indigo-600 text-white h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {t.viewBids} ({liveJob.bids.length}) <ChevronRight size={16} />
                                </button>
                            )}

                            {/* Poster: Mark Complete (Mobile) */}
                            {!isAuthLoading && role === UserRole.POSTER && liveJob.posterId === user.id && liveJob.status === JobStatus.IN_PROGRESS && (
                                <button
                                    onClick={() => { if (confirm(language === 'en' ? 'Mark job as completed?' : 'काम पूरा हो गया?')) onCompleteJob?.(liveJob); }}
                                    className="w-full bg-emerald-500 text-white h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} strokeWidth={3} /> {language === 'en' ? 'Mark Completed' : 'काम पूरा हुआ'}
                                </button>
                            )}

                            {/* Participant: Chat & Call */}
                            {isParticipant && (liveJob.status === JobStatus.IN_PROGRESS || liveJob.status === JobStatus.COMPLETED) && (
                                <div className="flex w-full gap-2">
                                    <button
                                        onClick={() => onChat(liveJob)}
                                        className="flex-1 bg-indigo-600 text-white h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={18} strokeWidth={3} /> {t.chat}
                                    </button>
                                    {isAcceptedWorker && liveJob.posterPhone && (
                                        <button
                                            onClick={() => window.open(`tel:${liveJob.posterPhone}`)}
                                            className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                        >
                                            <Phone size={18} strokeWidth={3} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 7. DESKTOP SIDEBAR */}
                <div className="hidden md:flex w-[450px] bg-surface border-l border-border flex-col p-10 overflow-y-auto shrink-0 z-20 h-full space-y-8">
                    {/* Poster Info Card */}
                    {user.id !== liveJob.posterId && (
                        <div
                            className="bg-background p-6 rounded-[2.5rem] border border-border cursor-pointer group hover:border-primary/50 transition-all shadow-sm flex items-center gap-4"
                            onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName, isAcceptedWorker ? liveJob.posterPhone : undefined)}
                        >
                            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center overflow-hidden shrink-0 border border-border/50 shadow-inner group-hover:scale-105 transition-transform">
                                {liveJob.posterPhoto ? (
                                    <img src={liveJob.posterPhoto} alt={liveJob.posterName} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <UserCircle size={32} className="text-text-muted" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-text-primary group-hover:text-primary transition-colors truncate">{liveJob.posterName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={8} className={i < (liveJob.posterRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-border'} />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none">Verified</p>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-muted border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                                <ExternalLink size={16} />
                            </div>
                        </div>
                    )}

                    {/* Shared Desktop Actions Area */}
                    <div className="flex-1 space-y-6">
                        {/* Budget Card (Desktop) */}
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 md:p-8 rounded-[2.5rem] flex flex-col items-center text-center group hover:bg-emerald-500/10 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                                <IndianRupee size={24} strokeWidth={3} />
                            </div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-1">{t.budget}</p>
                            <p className="text-3xl md:text-4xl font-black text-text-primary tracking-tighter">₹{liveJob.budget.toLocaleString()}</p>
                        </div>

                        {/* Status Message */}
                        <div className={`p-4 md:p-5 rounded-[2rem] border-2 border-dashed flex flex-col items-center text-center gap-2 ${liveJob.status === JobStatus.OPEN ? 'bg-blue-500/5 border-blue-500/20 text-blue-600' :
                            liveJob.status === JobStatus.IN_PROGRESS ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-600' :
                                'bg-background border-border text-text-muted'
                            }`}>
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                                {liveJob.status === JobStatus.OPEN ? <Sparkles size={20} /> : <Clock size={20} />}
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-[0.2em] text-[10px] mb-0.5">
                                    {language === 'en' ? 'Job Status' : (language === 'hi' ? 'कार्य की स्थिति' : 'ਕੰਮ ਦੀ ਸਥਿਤੀ')}
                                </h3>
                                <p className="text-lg font-black tracking-tight">{String(liveJob.status).replace('_', ' ')}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {role === UserRole.WORKER && liveJob.status === JobStatus.OPEN && !myBid && liveJob.posterId !== user.id && (
                                <button
                                    onClick={() => onBid(liveJob.id)}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {t.bidNow} <ChevronRight size={20} strokeWidth={3} />
                                </button>
                            )}

                            {/* Worker Negotiation Actions (Desktop) */}
                            {myBid && liveJob.status === JobStatus.OPEN && (
                                isWorkerTurn ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { if (onReplyToCounter) onReplyToCounter(liveJob.id, myBid.id, 'ACCEPT'); onClose(); }}
                                                className="flex-1 bg-emerald-500 text-white py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={18} /> {t.accept || 'Accept'}
                                            </button>
                                            <button
                                                onClick={() => { if (confirm(t.withdrawConfirm)) onCancel?.(liveJob.id); onClose(); }}
                                                className="w-14 bg-red-500/10 text-red-500 rounded-[1.5rem] flex items-center justify-center border border-red-500/20 hover:bg-red-500/20 transition-all"
                                                title="Withdraw Bid"
                                            >
                                                <X size={20} strokeWidth={3} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowCounterInput(true)}
                                            className="w-full bg-surface border-2 border-dashed border-border text-text-primary py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:border-primary/50 hover:text-primary active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Handshake size={18} /> {t.counter || 'Counter Offer'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full bg-indigo-500/5 text-indigo-400 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 border border-indigo-500/10 cursor-not-allowed opacity-80">
                                        <Clock size={18} /> {language === 'en' ? 'Offer Pending' : 'प्रस्ताव लंबित'}
                                    </div>
                                )
                            )}

                            {isParticipant && (liveJob.status === JobStatus.IN_PROGRESS || liveJob.status === JobStatus.COMPLETED) && (
                                <button
                                    onClick={() => onChat(liveJob)}
                                    className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <MessageCircle size={22} strokeWidth={3} /> {t.chat}
                                </button>
                            )}

                            {/* Explicit Close Button for Desktop */}
                            <button
                                onClick={onClose}
                                className="w-full bg-surface border border-border text-text-muted hover:text-text-primary py-4 rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                <X size={18} /> {language === 'en' ? 'Close Details' : 'बंद करें'}
                            </button>

                            {isAcceptedWorker && liveJob.posterPhone && (
                                <button
                                    onClick={() => window.open(`tel:${liveJob.posterPhone}`)}
                                    className="w-full bg-surface border border-border text-text-primary py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all flex items-center justify-center gap-3"
                                >
                                    <Phone size={20} strokeWidth={3} /> {t.call || 'Call Poster'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Meta Info (Poster actions) */}
                    {!isAuthLoading && liveJob.posterId === user.id && (
                        <div className="bg-background p-6 rounded-[2rem] border border-border space-y-4">
                            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Administrative Actions</h4>
                            <div className="flex flex-col gap-3">
                                {liveJob.status === JobStatus.IN_PROGRESS && (
                                    <button
                                        onClick={() => { if (confirm(language === 'en' ? 'Mark job as completed?' : 'काम पूरा हो गया?')) onCompleteJob?.(liveJob); }}
                                        className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={16} strokeWidth={3} /> {language === 'en' ? 'Mark Completed' : 'काम पूरा हुआ'}
                                    </button>
                                )}
                                <div className="flex gap-3">
                                    {liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && (
                                        <>
                                            <button onClick={() => onEdit(liveJob)} className="flex-1 bg-blue-500/10 text-blue-600 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-blue-500/20 active:scale-95 transition-all">Edit</button>
                                            <button onClick={() => onDelete(liveJob.id)} className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">Delete</button>
                                        </>
                                    )}
                                    {(liveJob.status === JobStatus.IN_PROGRESS || (liveJob.status === JobStatus.OPEN && liveJob.bids.length > 0)) && onCancel && (
                                        <button onClick={() => { if (confirm(language === 'en' ? 'Cancel job?' : 'काम रद्द करें?')) onCancel(liveJob.id); }} className={`flex-1 bg-red-500/10 text-red-600 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-red-500/20 active:scale-95 transition-all ${liveJob.status === JobStatus.IN_PROGRESS ? '' : 'w-full'}`}>Cancel Job</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Overlays */}
                {showCounterInput && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4 pb-safe" onClick={() => setShowCounterInput(false)}>
                        <div className="w-full max-w-lg bg-background rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 relative border border-border" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-black text-2xl text-text-primary tracking-tight">Propose New Offer</h3>
                                    <p className="text-text-muted text-sm font-medium mt-1">Set a fair amount for both parties</p>
                                </div>
                                <button onClick={() => setShowCounterInput(false)} className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="relative">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <IndianRupee size={22} strokeWidth={3} />
                                    </div>
                                    <input
                                        type="number"
                                        value={counterAmount}
                                        onChange={(e) => setCounterAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-surface border-2 border-border/50 rounded-3xl py-6 pl-20 pr-8 font-black text-3xl text-text-primary focus:border-primary focus:ring-0 transition-all placeholder:text-text-muted/30"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleSubmitCounter}
                                    disabled={!counterAmount || isProcessing}
                                    className="w-full bg-primary text-white h-16 rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" /> : <>Send Offer <ChevronRight size={20} strokeWidth={3} /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
