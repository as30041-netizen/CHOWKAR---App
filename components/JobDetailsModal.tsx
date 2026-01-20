import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { X, ArrowLeft, XCircle, Star, Pencil, ExternalLink, UserCircle, Users, ChevronRight, Loader2, Handshake, Trash2, CheckCircle, Heart, MessageCircle, Phone, Sparkles, Languages, RotateCw, Share2, Clock, IndianRupee } from 'lucide-react';
import { Job, UserRole, JobStatus } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { supabase } from '../lib/supabase';
import { translateJobDetails } from '../services/geminiService';
import { JobNegotiationCard } from './job-details/JobNegotiationCard';
import { JobInfoCards } from './job-details/JobInfoCards';
import { JobMapSection } from './job-details/JobMapSection';

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
    const { user, role: currentRole, t, language, isAuthLoading } = useUser();
    const { getJobWithFullDetails, jobs, saveJobTranslation } = useJobs();

    // Derived State
    const isOwner = job?.posterId === user.id;
    // Allow bidding if user is NOT owner (regardless of current dashboard mode)
    // This fixes shared link UX where a worker might be in "Poster Mode"
    const canBid = !isOwner && job?.status === 'OPEN';
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

    // --- SHARE LOGIC ---
    const handleShare = async () => {
        const shareUrl = `https://chowkar.in/job/${liveJob.id}`;
        const shareText = language === 'en'
            ? `Check out this job on Chowkar: ${liveJob.title}`
            : `चौकर पर यह काम देखें: ${liveJob.title}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: liveJob.title,
                    text: shareText,
                    url: shareUrl,
                });
            } catch (err) {
                // User cancelled or share failed
                console.warn('Share cancelled or failed', err);
            }
        } else {
            // Fallback to Clipboard
            try {
                await navigator.clipboard.writeText(shareUrl);
                showAlert(language === 'en' ? 'Link copied to clipboard!' : 'लिंक कॉपी किया गया!', 'success');
            } catch (err) {
                console.error('Failed to copy', err);
                showAlert('Failed to share', 'error');
            }
        }
    };

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
                        {/* Share Button (Mobile Header) */}
                        <button
                            onClick={handleShare}
                            className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-primary active:scale-95 transition-all"
                        >
                            <Share2 size={16} />
                        </button>
                        {/* Status Chip in Header */}
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${liveJob.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : liveJob.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-surface text-text-muted border-border'
                            }`}>
                            {String(liveJob.status || 'UNKNOWN').replace('_', ' ')}
                        </span>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-background">
                    {/* 1. HERO SECTION (Visual Impact) */}
                    <div className="relative w-full h-64 md:h-96 overflow-hidden bg-slate-900 group">
                        {liveJob.image ? (
                            <img src={liveJob.image} alt={liveJob.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                                <Handshake size={64} className="text-white/10" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

                        {/* Category Floating Badge */}
                        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                            <span className="w-fit bg-primary/20 backdrop-blur-md text-primary text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-primary/20">
                                {liveJob.category || 'General'}
                            </span>
                            <h1 className="text-2xl md:text-4xl font-black text-text-primary leading-tight tracking-tight drop-shadow-sm">{displayTitle}</h1>
                        </div>
                    </div>

                    <div className="p-6 md:p-10 space-y-10">
                        {/* 0. NEGOTIATION STATUS CARD (Top Priority) */}
                        {myBid && (
                            <JobNegotiationCard
                                myBid={myBid}
                                liveJob={liveJob}
                                isWorkerTurn={isWorkerTurn}
                                language={language}
                            />
                        )}

                        {/* 2. PREMIUM METADATA CHIPS (High Scannability) */}
                        <JobInfoCards liveJob={liveJob} t={t} />

                        {/* 3. PREMIUM DESCRIPTION CARD */}
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3">
                                <div className="w-1.5 h-4 bg-primary rounded-full" />
                                {t.description}
                                <button
                                    onClick={handleTranslate}
                                    disabled={isTranslating}
                                    className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${showTranslated
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-surface border border-border text-text-muted hover:border-primary/50 hover:text-primary'
                                        }`}
                                >
                                    {isTranslating ? <RotateCw size={10} className="animate-spin" /> : <Languages size={10} strokeWidth={2.5} />}
                                    {isTranslating ? t.translating : (showTranslated ? t.showOriginal : t.translate)}
                                </button>
                            </h4>
                            <div className="bg-surface border border-border/50 rounded-[2.5rem] p-8 shadow-sm group hover:border-primary/20 transition-all">
                                <p className="text-base text-text-secondary whitespace-pre-wrap font-medium leading-[1.8] tracking-tight">
                                    {displayDescription}
                                </p>
                            </div>
                        </div>

                        {/* 4. PREMIUM POSTER CARD (Mobile) */}
                        {user.id !== liveJob.posterId && (
                            <div
                                className="md:hidden flex items-center justify-between bg-surface p-6 rounded-[2.5rem] border border-border/50 cursor-pointer hover:border-primary/50 transition-all shadow-sm group"
                                onClick={() => onViewProfile(liveJob.posterId, liveJob.posterName)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-background border border-border/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                        {liveJob.posterPhoto ? (
                                            <img src={liveJob.posterPhoto} alt={liveJob.posterName || 'User'} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <UserCircle size={32} className="text-text-muted" />
                                        )}
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-black text-sm text-text-primary flex items-center gap-2 group-hover:text-primary transition-colors">
                                            {liveJob.posterName || 'Partner Account'}
                                            <ExternalLink size={12} className="text-text-muted opacity-50" />
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={8} className={i < (liveJob.posterRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-border'} />
                                                ))}
                                            </div>
                                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest leading-none mt-0.5">Verified</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-text-muted border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                                    <ChevronRight size={18} strokeWidth={3} />
                                </div>
                            </div>
                        )}

                        {/* 5. INTERACTIVE MAP PREVIEW */}
                        {/* 5. INTERACTIVE MAP PREVIEW */}
                        <JobMapSection liveJob={liveJob} language={language} />

                        {/* 6. BIDS PREVIEW (For Poster - Quick Insight) */}
                        {/* 1.1 VIEW BIDS (Owner Only - Role Agnostic) */}
                        {isOwner && liveJob.status === JobStatus.OPEN && liveJob.bids && liveJob.bids.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3">
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
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3">
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
                                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3">
                                    <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                                    {language === 'en' ? 'Negotiation History' : 'बातचीत का इतिहास'}
                                </h4>
                                <div className="bg-surface border border-border/50 rounded-[2.5rem] p-6 shadow-sm space-y-6 relative overflow-hidden">
                                    {/* Vertical Line */}
                                    <div className="absolute left-[2.25rem] top-6 bottom-6 w-0.5 bg-border/50" />

                                    {myBid.negotiationHistory.map((entry: any, index: number) => {
                                        const isLast = index === myBid.negotiationHistory.length - 1;
                                        // Chat bubble alignment logic
                                        const isMe = (currentRole === UserRole.WORKER && entry.by === 'WORKER') || (currentRole === UserRole.POSTER && entry.by === 'POSTER');
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

                        {/* Spacer to avoid sticky footer overlap */}
                        <div className="h-24 md:hidden" />
                    </div>
                </div>

                {/* 6. MOBILE ACTION ISLAND (Sticky Footer) */}
                <div className="md:hidden fixed bottom-6 inset-x-4 z-50">
                    <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 shadow-2xl shadow-indigo-500/20 flex items-center gap-3">
                        {/* 2. BIDDING SECTION (Non-Owners) */}
                        {!myBid && liveJob.status === JobStatus.OPEN && !isOwner && (
                            <div className="pl-4 pr-2 border-r border-white/10 shrink-0">
                                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">{t.budget}</p>
                                <p className="text-lg font-black text-white tracking-tighter leading-none">₹{liveJob.budget}</p>
                            </div>
                        )}

                        <div className="flex-1 flex gap-2">
                            {/* Worker: Bid Action */}
                            {!isAuthLoading && !isOwner && liveJob.status === JobStatus.OPEN && !myBid && (
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
                            {!isAuthLoading && isOwner && liveJob.status === JobStatus.OPEN && (
                                <button
                                    onClick={() => onViewBids(liveJob)}
                                    className="w-full bg-indigo-600 text-white h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {t.viewBids} ({liveJob.bids.length}) <ChevronRight size={16} />
                                </button>
                            )}

                            {/* Poster: Mark Complete (Mobile) */}
                            {!isAuthLoading && isOwner && liveJob.status === JobStatus.IN_PROGRESS && (
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
                                    {language === 'en' ? 'Job Status' : 'कार्य की स्थिति'}
                                </h3>
                                <p className="text-lg font-black tracking-tight">{String(liveJob.status).replace('_', ' ')}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {!isOwner && liveJob.status === JobStatus.OPEN && !myBid && (
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
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4" onClick={() => setShowCounterInput(false)}>
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
