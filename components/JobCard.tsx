import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, Bid, Language } from '../types';
import { MapPin, IndianRupee, Clock, CheckCircle2 as CheckCircle, User as UserIcon, Users, Calendar, Hourglass, XCircle, AlertCircle, ChevronRight, Ban, Pencil, ExternalLink, Navigation, Volume2, Square, TrendingUp, Handshake, CornerDownRight, Star, Trash2, Sparkles, Heart, Zap, Briefcase, Languages } from 'lucide-react';
import { TRANSLATIONS, CATEGORY_TRANSLATIONS, CATEGORY_CONFIG } from '../constants';
import { matchJobToWorker, translateJobDetails } from '../services/geminiService';
import { saveJobTranslation } from '../services/jobService';

interface JobCardProps {
  job: Job;
  currentUserId: string;
  userRole: UserRole;
  distance?: number; // Optional distance in km
  language: Language;
  hasUnreadBids?: boolean; // Whether there are unread bid notifications for this job
  onBid: (jobId: string) => void;
  onViewBids: (job: Job) => void;
  onChat: (job: Job) => void;
  onEdit: (job: Job) => void;
  onClick: () => void; // New prop for card click
  onReplyToCounter?: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
  onWithdrawBid?: (jobId: string, bidId: string) => void;
  onHide?: (jobId: string) => void;
  isPremium?: boolean;
  userSkills?: string[];
  userBio?: string;
}

// Helper for relative time
const getTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const JobCard = React.memo<JobCardProps>(({
  job,
  currentUserId,
  userRole,
  distance,
  language,
  hasUnreadBids = false,
  onBid,
  onViewBids,
  onChat,
  onEdit,
  onClick,
  onReplyToCounter,
  onWithdrawBid,
  onHide,
  isPremium,
  userSkills,
  userBio
}) => {
  const isPoster = job.posterId === currentUserId;

  const [matchData, setMatchData] = useState<{ score: number; reason: string } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    // DISABLED: Auto-match was causing rate limit errors (20 jobs x 1 API call = 20 calls at once)
    // The Magic Match feature should be triggered manually (via button) or with a queue/throttle system.
    // if (userRole === UserRole.WORKER && !isPoster && isPremium && job.status === JobStatus.OPEN && !matchData && !matchLoading) {
    //   const getMatch = async () => {
    //     setMatchLoading(true);
    //     const result = await matchJobToWorker(
    //       userSkills || [],
    //       userBio || '',
    //       job.title,
    //       job.description
    //     );
    //     setMatchData(result);
    //     setMatchLoading(false);
    //   };
    //   getMatch();
    // }
  }, [isPremium, userRole, isPoster, job.id]);

  // OPTIMIZATION: Use pre-computed bid info if available (from optimized feeds)
  // Fallback to searching the bids array if they were eager-loaded
  const myBidFromList = job.bids.find(b => b.workerId === currentUserId);
  const myBid: Partial<Bid> | undefined = myBidFromList || (job.myBidId ? {
    id: job.myBidId,
    workerId: currentUserId,
    status: job.myBidStatus,
    amount: job.myBidAmount,
    negotiationHistory: job.myBidLastNegotiationBy ? [{ amount: job.myBidAmount || 0, by: job.myBidLastNegotiationBy, timestamp: Date.now() }] : []
  } : undefined);

  const acceptedBidId = job.acceptedBidId;
  const acceptedBid = acceptedBidId ? (job.bids.find(b => b.id === acceptedBidId) || (job.myBidId === acceptedBidId ? myBid : null)) : null;
  const t = TRANSLATIONS[language];
  const posterName = job.posterName || 'User';
  const catT = job.category ? (CATEGORY_TRANSLATIONS[job.category] ? CATEGORY_TRANSLATIONS[job.category][language] : job.category) : '';

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [localTranslation, setLocalTranslation] = useState<{ title: string; description: string } | null>(null);

  // SMART TRANSLATION LOGIC
  // If translation exists for current language, use it automatically.
  // Exception: If current language is English, default to original (unless translated content exists and original is implicitly not english, but we assume original is untagged).
  // Actually, simpler logic: If translation exists for MY language, show it.
  const cachedTranslation = job.translations?.[language];
  const displayTitle = localTranslation?.title || cachedTranslation?.title || job.title;
  const displayDescription = localTranslation?.description || cachedTranslation?.description || job.description;
  const isTranslated = !!cachedTranslation || !!localTranslation;

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await translateJobDetails(job.title, job.description, language as any);
      if (result) {
        setLocalTranslation(result);
        await saveJobTranslation(job.id, language, result.title, result.description);
      }
    } catch (err) {
      console.error('Translation failed', err);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    // Cleanup speech when component unmounts
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isSpeaking) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    // Construct text to read
    const textToRead = `${job.title}. ${job.description}. ${t.budget} ${job.budget} rupees.`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    // Use Indian English or Hindi voice based on text content or app language
    const hasHindiChars = /[\u0900-\u097F]/.test(textToRead);
    utterance.lang = hasHindiChars ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Format Date for job start
  const startDate = new Date(job.jobDate);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const dateDisplay = isToday ? (language === 'hi' ? 'आज' : language === 'pa' ? 'ਅੱਜ' : 'Today') : startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // Open Maps
  const openMaps = (e: React.MouseEvent, type: 'search' | 'dir' = 'search') => {
    e.stopPropagation();
    if (job.coordinates) {
      if (type === 'dir') {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${job.coordinates.lat},${job.coordinates.lng}`, '_blank');
      }
    }
  };

  const submitCounter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!myBid || !onReplyToCounter || !counterAmount) return;

    const amount = parseInt(counterAmount);
    if (isNaN(amount) || amount <= 0) return; // Silent validation - inline input

    onReplyToCounter(job.id, myBid.id, 'COUNTER', amount);
    setShowCounterInput(false);
  };

  // Determine Status UI (Worker or Poster)
  const getStatusUI = () => {
    // 1. Poster specific status (Prioritized Dashboard Logic)
    if (userRole === UserRole.POSTER && isPoster && job.status === JobStatus.OPEN) {
      // Priority 1: Hire Ready
      if (job.hasAgreement) {
        return (
          <div className="bg-emerald-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-emerald-500/30 shadow-lg animate-pulse-subtle border border-white/20">
            <CheckCircle size={14} strokeWidth={3} /> {language === 'en' ? 'Agreement Reached' : 'सहमति बन गई'}
          </div>
        );
      }

      // Priority 2: Action Required (Worker Countered)
      if (job.myBidLastNegotiationBy === UserRole.WORKER) {
        return (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 animate-pulse border border-white/10">
            <Handshake size={14} strokeWidth={3} /> {language === 'en' ? 'Worker Countered' : 'वर्कर का जवाब'}
          </div>
        );
      }

      // Priority 3: Waiting for Worker (Poster Countered)
      // We infer this: if negotiation exists (implied by hasNewBid=false but bids>0 maybe?) 
      // Actually, if 'myBidLastNegotiationBy' is POSTER, it means we are waiting.
      if (job.myBidLastNegotiationBy === UserRole.POSTER) {
        return (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 py-2 px-4 rounded-full font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 border border-indigo-100 dark:border-indigo-800/30">
            <Clock size={14} strokeWidth={2.5} /> {language === 'en' ? 'Counter Sent' : 'प्रस्ताव भेजा'}
          </div>
        );
      }

      // Priority 4: Fresh Bids
      if (job.hasNewBid) {
        return (
          <div className="bg-blue-600 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 animate-bounce-subtle flex items-center gap-2">
            <Sparkles size={14} strokeWidth={3} /> {language === 'en' ? 'Fresh Bids' : 'नई बोलियां'}
          </div>
        );
      }

      // Priority 5: Generic Active (Bids exist but no specific status)
      if ((job.bidCount ?? job.bids.length) > 0) {
        return (
          <div className="bg-surface border border-border text-text-muted py-2 px-4 rounded-full font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            <Users size={14} strokeWidth={2.5} /> {language === 'en' ? 'Active' : 'सक्रिय'}
          </div>
        );
      }
    }

    if (!myBid) return null;

    if (myBid.status === 'ACCEPTED') {
      return (
        <div className="bg-emerald-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20">
          <CheckCircle size={14} strokeWidth={3} /> {t.hired}: ₹{myBid.amount}
        </div>
      );
    }
    if (myBid.status === 'REJECTED') {
      return (
        <div className="flex items-center gap-2">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border border-red-100 dark:border-red-900/50">
            <XCircle size={14} strokeWidth={3} /> {t.declined}
          </div>
          {onHide && (
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(language === 'en' ? 'Remove this card from history?' : 'इस कार्ड को इतिहास से हटाएं?')) onHide(job.id); }}
              className="bg-gray-100 dark:bg-gray-800 text-gray-400 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
              title={language === 'en' ? 'Remove from history' : 'इतिहास से हटाएं'}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      );
    }
    if (job.status !== JobStatus.OPEN && myBid.status === 'PENDING') {
      return (
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-2 px-4 rounded-full font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 opacity-70">
          <Ban size={14} strokeWidth={3} /> {t.closed}
        </div>
      );
    }


    // Negotiation Logic - requires full bid history
    // If we only have pre-computed info, and it says PENDING, we display as Pending.
    // Full counter-offer UI will appear in JobDetailsModal where we lazy-load full details.
    const lastNegotiation = myBid instanceof Object && 'negotiationHistory' in myBid
      ? (myBid.negotiationHistory as any[])?.[(myBid.negotiationHistory as any[]).length - 1]
      : null;
    const lastTurn = job.myBidLastNegotiationBy || lastNegotiation?.by;
    const isAgreed = lastNegotiation?.agreed === true;

    // Case-insensitive comparison since DB may have lowercase
    const lastTurnUpper = lastTurn?.toString().toUpperCase();
    const isWorkerTurn = lastTurnUpper === UserRole.POSTER;
    const isPosterTurn = lastTurnUpper === UserRole.WORKER;

    if (isWorkerTurn) {
      return (
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 animate-pulse border border-white/10">
            <AlertCircle size={14} strokeWidth={3} /> {language === 'en' ? 'Action Required' : 'कारवाई आवश्यक'}
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3 flex flex-col gap-2 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t.posterCountered}</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-500">₹{myBid.amount}</span>
            </div>

            {showCounterInput ? (
              <div className="flex gap-2 items-center mt-1 animate-in slide-in-from-right duration-200">
                <input
                  type="number"
                  className="flex-1 text-sm font-black p-2 bg-white dark:bg-black/20 border border-amber-300 dark:border-amber-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="₹"
                  value={counterAmount}
                  onChange={e => setCounterAmount(e.target.value)}
                  autoFocus
                  min="1"
                />
                <button onClick={submitCounter} className="w-9 h-9 bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform shadow-sm">✓</button>
                <button onClick={(e) => { e.stopPropagation(); setShowCounterInput(false) }} className="w-9 h-9 bg-surface text-text-muted border border-border rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform">✕</button>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'ACCEPT')} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-700">{t.accept || 'Accept'}</button>
                <button onClick={() => setShowCounterInput(true)} className="flex-1 bg-white dark:bg-gray-800 text-amber-600 border border-amber-500/30 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20">{t.counter || 'Counter'}</button>
                <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'REJECT')} className="w-9 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl border border-red-100 dark:border-red-800/50 flex items-center justify-center active:scale-95 transition-all hover:bg-red-100"><XCircle size={14} /></button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isPosterTurn) {
      return (
        <div className={`py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border shadow-sm ${isAgreed
          ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
          : 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/30'}`}>
          {isAgreed ? (
            <><Sparkles size={14} fill="currentColor" /> {t.waitingForPosterFinalize || 'Finalizing Deal...'}</>
          ) : (
            <><Clock size={14} strokeWidth={2.5} /> {language === 'en' ? 'Offer Sent - Waiting' : 'प्रस्ताव भेजा - प्रतीक्षा करें'}</>
          )}
        </div>
      );
    }

    // Default Pending (Standard Bid)
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="bg-white dark:bg-surface border border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex justify-between items-center gap-3 shadow-sm">
          <span className="flex items-center"><Clock size={14} className="mr-1.5" strokeWidth={2.5} /> {language === 'en' ? 'Bid Sent' : 'बोली भेजी गई'}</span>
          <span className="font-bold">₹{myBid.amount}</span>
        </div>
        {onWithdrawBid && (
          <button
            onClick={(e) => { e.stopPropagation(); onWithdrawBid(job.id, myBid.id); }}
            className="text-[9px] font-bold text-red-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-1 opacity-60 hover:opacity-100 transition-all px-2"
          >
            <Trash2 size={10} /> {t.withdraw}
          </button>
        )}
      </div>
    );

  };

  return (
    <div
      onClick={onClick}
      className={`card p-5 md:p-6 cursor-pointer group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/10 active:scale-[0.98] ${isPremium ? 'ring-2 ring-amber-500/20 dark:ring-amber-500/30' : ''}`}
    >
      {/* FUNCTIONAL PREMIUM HEADER */}
      <div className="flex justify-between items-start gap-3 mb-3">
        {/* Left: Category Icon (The "Logo") */}
        <div className="shrink-0">
          {(() => {
            const catConfig = CATEGORY_CONFIG.find(c => c.id === job.category);
            const CatIcon = catConfig?.icon || Briefcase;
            return (
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${catConfig?.color || 'bg-gray-100'} text-white shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                <CatIcon size={22} strokeWidth={2.5} className="relative z-10" />
              </div>
            );
          })()}
        </div>

        {/* Middle: Title & Badges */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {/* Match Badge (AI) */}
            {(matchData?.score && matchData.score > 80) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-500/20">
                <Sparkles size={10} fill="currentColor" /> {matchData.score}% Match
              </span>
            )}
            {isPremium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Star size={10} fill="currentColor" /> Premium
              </span>
            )}
            {/* Recommended Badge */}
            {job.isRecommended && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                <Sparkles size={10} fill="currentColor" /> {language === 'en' ? 'For You' : 'आपके लिए'}
              </span>
            )}
            {(job.description.toLowerCase().includes('urgent') || job.title.toLowerCase().includes('urgent')) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse">
                <Zap size={10} fill="currentColor" /> Urgent
              </span>
            )}
            {/* Translation Badge */}
            {/* Translation Badge or Trigger */}
            {isTranslated ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                <Languages size={10} /> {language.toUpperCase()}
              </span>
            ) : (language !== 'en' && (
              <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-surface border border-border text-text-muted hover:border-primary hover:text-primary transition-colors z-10 relative"
              >
                {isTranslating ? <div className="animate-spin w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full" /> : <Languages size={10} />}
                {isTranslating ? (language === 'hi' ? '...' : language === 'pa' ? '...' : '...') : (language === 'hi' ? 'अनुवाद करें' : language === 'pa' ? 'ਅਨੁਵਾਦ ਕਰੋ' : 'Translate')}
              </button>
            ))}
          </div>
          <h3 className="text-lg font-bold text-text-primary leading-tight line-clamp-2">
            {displayTitle}
          </h3>
        </div>

        {/* Right: Price Pill (The "Hook") */}
        <div className="shrink-0">
          <div className="bg-emerald-600 dark:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 flex flex-col items-center leading-none">
            <span className="text-[9px] opacity-80 uppercase font-bold tracking-widest mb-0.5">Pay</span>
            <span>₹{job.budget}</span>
          </div>
        </div>
      </div>
      {/* Description Snippet */}
      {/* Description Snippet */}
      <p className="text-sm text-text-secondary mb-6 line-clamp-2 leading-relaxed">
        {displayDescription}
      </p>

      {/* Action Area - Remove stopPropagation from container so clicking empty space opens details */}
      <div className="flex items-center justify-between gap-4 pt-5 border-t border-border">
        <button
          onClick={handleSpeak}
          className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${isSpeaking ? 'bg-primary text-white animate-pulse' : 'bg-surface border border-border text-text-muted hover:text-primary hover:border-primary'}`}
        >
          {isSpeaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}
        </button>

        <div className="flex-1 flex justify-end">
          {userRole === UserRole.WORKER && !isPoster && (
            !myBid && job.status === JobStatus.OPEN ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const btn = e.currentTarget;
                  btn.classList.add('opacity-70', 'cursor-wait');
                  onBid(job.id);
                }}
                className="btn btn-primary rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 group/btn transition-all active:scale-95"
              >
                {t.bidNow} <ChevronRight size={14} strokeWidth={3} className="group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              getStatusUI()
            )
          )}

          {userRole === UserRole.POSTER && isPoster && job.status === JobStatus.OPEN && (
            (job.bidCount ?? job.bids.length) === 0 ? (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(job); }}
                className="btn btn-secondary rounded-full text-xs font-bold uppercase tracking-widest"
              >
                <Pencil size={14} /> {t.editJob}
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2 w-full">
                {/* Status Chips only if essential, otherwise the button does the heavy lifting */}
                {getStatusUI()}

                {/* Primary Action Button - Opens Modal */}
                <button
                  onClick={(e) => {
                    // We allow this button to propagate or call onClick directly if it helps, 
                    // but usually specific buttons stop propagation. 
                    // However, for "View Bids" it opens the SAME modal as card click, so it's fine.
                    // Actually, let's keep it specific but make it look distinct.
                    e.stopPropagation();
                    onViewBids(job);
                  }}
                  className={`btn w-full rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${job.hasNewBid
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 animate-pulse-subtle'
                    : 'btn-primary'
                    }`}
                >
                  {job.hasNewBid ? <AlertCircle size={16} className="animate-bounce" /> : <Users size={16} />}
                  {job.hasNewBid ? (language === 'en' ? 'New Bids Review' : 'नई बोलियां देखें') : t.viewBids}
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] min-w-[20px] text-center">
                    {job.bidCount ?? job.bids.length}
                  </span>
                </button>
              </div>
            )
          )}

          {job.status === JobStatus.IN_PROGRESS && (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
            <button
              onClick={(e) => { e.stopPropagation(); onChat(job); }}
              className="btn btn-primary bg-blue-600 hover:bg-blue-700 w-full sm:w-auto rounded-full text-xs font-bold uppercase tracking-widest"
            >
              <UserIcon size={14} strokeWidth={3} /> {t.chat}
            </button>
          )}

          {job.status === JobStatus.COMPLETED && (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
            <div className="flex gap-2 w-full sm:w-auto">
              {job.hasMyReview ? (
                <div className="flex-1 bg-green-500/10 text-green-600 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-green-500/20">
                  <Heart size={12} fill="currentColor" /> Reviewed
                </div>
              ) : (
                <button
                  onClick={() => onClick()}
                  className="btn bg-amber-400 text-amber-950 hover:bg-amber-500 rounded-full text-xs font-bold uppercase tracking-widest"
                >
                  <Star size={14} className="fill-current" /> {t.rateExperience}
                </button>
              )}
              {onHide && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(language === 'en' ? 'Remove this card from history?' : language === 'hi' ? 'इस कार्ड को इतिहास से हटाएं?' : 'ਇਸ ਕਾਰਡ ਨੂੰ ਇਤਿਹਾਸ ਤੋਂ ਹਟਾਓ?')) onHide(job.id); }}
                  className="p-2.5 rounded-full hover:bg-red-50 hover:text-red-500 text-text-muted transition-all"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div >
  );
});
