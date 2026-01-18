import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, Bid } from '../types';
import { MapPin, IndianRupee, Clock, CheckCircle2 as CheckCircle, User as UserIcon, Calendar, Hourglass, XCircle, AlertCircle, ChevronRight, Ban, Pencil, ExternalLink, Navigation, Volume2, Square, TrendingUp, Handshake, CornerDownRight, Star, Trash2, Sparkles, Heart, Zap } from 'lucide-react';
import { TRANSLATIONS, CATEGORY_TRANSLATIONS, CATEGORY_CONFIG } from '../constants';

interface JobCardProps {
  job: Job;
  currentUserId: string;
  userRole: UserRole;
  distance?: number; // Optional distance in km
  language: 'en' | 'hi';
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

import { matchJobToWorker } from '../services/geminiService';

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
    if (userRole === UserRole.WORKER && !isPoster && isPremium && job.status === JobStatus.OPEN && !matchData && !matchLoading) {
      const getMatch = async () => {
        setMatchLoading(true);
        const result = await matchJobToWorker(
          userSkills || [],
          userBio || '',
          job.title,
          job.description
        );
        setMatchData(result);
        setMatchLoading(false);
      };
      getMatch();
    }
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
  const dateDisplay = isToday ? (language === 'hi' ? 'आज' : 'Today') : startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

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
    // 1. Poster specific status (whose turn is it in general for this job's bids)
    if (userRole === UserRole.POSTER && isPoster && job.status === JobStatus.OPEN) {
      if (job.hasAgreement) {
        return (
          <div className="bg-emerald-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-emerald-500/30 shadow-lg animate-pulse-subtle">
            <CheckCircle size={14} strokeWidth={3} /> {language === 'en' ? 'Ready to Hire' : 'नियुक्त करें'}
          </div>
        );
      }
      if (job.myBidLastNegotiationBy === UserRole.WORKER) {
        return (
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 py-2 px-4 rounded-full font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 border border-amber-200 dark:border-amber-800/50">
            <Handshake size={12} strokeWidth={2.5} /> {language === 'en' ? 'Your Turn' : 'आपकी बारी'}
          </div>
        );
      }
      if (job.hasNewBid) {
        return (
          <div className="bg-blue-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 animate-bounce-subtle">
            <AlertCircle size={12} strokeWidth={3} /> {language === 'en' ? 'New Bid!' : 'नई बोली!'}
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
        <div className="flex flex-col gap-3 w-full max-w-[260px]">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 animate-pulse-subtle">
            <Handshake size={12} strokeWidth={3} /> {t.posterCountered}: ₹{myBid.amount}
          </div>
          {showCounterInput ? (
            <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-1.5 shadow-xl" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                className="flex-1 text-sm font-black p-2 bg-transparent outline-none text-gray-900 dark:text-white"
                placeholder="₹"
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                autoFocus
                min="1"
              />
              <button onClick={submitCounter} className="w-8 h-8 bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform">✓</button>
              <button onClick={(e) => { e.stopPropagation(); setShowCounterInput(false) }} className="w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform">✕</button>
            </div>
          ) : (
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'ACCEPT')} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 active:scale-95 transition-all">{t.acceptCounter}</button>
              <button onClick={() => setShowCounterInput(true)} className="flex-1 bg-white dark:bg-gray-800 text-emerald-600 border border-emerald-500/30 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/10">{t.counterOffer}</button>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'REJECT')} className="bg-red-50 dark:bg-red-900/10 text-red-500 p-2.5 rounded-xl border border-red-100 dark:border-red-800/50 active:scale-95 transition-all hover:bg-red-100"><XCircle size={16} strokeWidth={2.5} /></button>
            </div>
          )}
        </div>
      );
    }

    if (isPosterTurn) {
      return (
        <div className={`py-2 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border ${isAgreed
          ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30'
          : 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30'}`}>
          {isAgreed ? (
            <><Handshake size={12} strokeWidth={3} /> {t.waitingForPosterFinalize || 'Finalizing...'}</>
          ) : (
            <><Clock size={12} strokeWidth={3} /> {t.waitingForResponse}: ₹{myBid.amount}</>
          )}
        </div>
      );
    }

    // Default Pending
    return (
      <div className="bg-blue-500 text-white py-2.5 px-4 rounded-full font-black text-[10px] uppercase tracking-widest flex justify-between items-center w-full max-w-[260px] shadow-lg shadow-blue-500/20">
        <span className="flex items-center"><Clock size={12} className="mr-2" strokeWidth={3} /> {t.pending}: ₹{myBid.amount}</span>
        {onWithdrawBid && (
          <button
            onClick={(e) => { e.stopPropagation(); onWithdrawBid(job.id, myBid.id); }}
            className="bg-black/20 hover:bg-black/30 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors backdrop-blur-sm"
          >
            {t.withdraw}
          </button>
        )}
      </div>
    );

  };

  return (
    <div
      onClick={onClick}
      className="relative p-6 rounded-[2rem] bg-white dark:bg-gray-950 border border-gray-50 dark:border-gray-800/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:scale-[1.01] transition-all duration-300 group overflow-hidden cursor-pointer"
    >
      {/* ULTRA-COMPACT HEADER: Title & Budget in one line */}
      {/* ULTRA-COMPACT HEADER: Title & Badges */}
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="flex-1">
          {/* Badges Row */}
          <div className="flex gap-2 mb-2">
            {(job.description.toLowerCase().includes('urgent') || job.title.toLowerCase().includes('urgent')) && (
              <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                <Zap size={10} fill="currentColor" /> Urgent
              </span>
            )}
            {isPremium && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                <Sparkles size={10} /> Premium
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight group-hover:text-emerald-600 transition-colors line-clamp-2 tracking-tight">
            {job.title}
          </h3>
        </div>

        {/* PRICE TAG - SHOPPABLE STYLE */}
        <div className="flex flex-col items-end">
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter leading-none">
            ₹{job.budget}
          </span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Fixed Price</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-5">
        {(() => {
          const catConfig = CATEGORY_CONFIG.find(c => c.id === job.category);
          const CatIcon = catConfig?.icon;
          return (
            <span className={`px-2 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 ${catConfig ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}>
              {CatIcon && <CatIcon size={12} />}
              {catT}
            </span>
          );
        })()}

        <span className="flex items-center gap-1 truncate max-w-[120px]">
          <MapPin size={12} />
          {distance !== undefined && distance < 100 ? `${distance.toFixed(1)} km` : job.location}
        </span>

        <span>{getTimeAgo(job.createdAt)}</span>

        {/* Poster Rating Inline */}
        {job.posterRating && job.posterRating > 0 && (
          <span className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-900/10 px-1.5 py-0.5 rounded-md">
            <Star size={10} fill="currentColor" strokeWidth={0} /> {job.posterRating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Description Snippet (Small) */}
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 leading-relaxed">
        {job.description}
      </p>

      {/* Action Area */}
      <div className="flex items-center justify-between gap-4 pt-5 border-t border-dashed border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleSpeak}
          className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${isSpeaking ? 'bg-emerald-500 text-white animate-pulse shadow-lg shadow-emerald-500/30' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
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
                className="w-full sm:w-auto bg-gray-900 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-gray-900 hover:text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-gray-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
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
                className="w-full sm:w-auto bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-transparent px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <Pencil size={12} strokeWidth={3} /> {t.editJob}
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2 w-full">
                {getStatusUI()}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[JobCard] View Bids Clicked', job.id);
                    onViewBids(job);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {t.viewBids} ({(job.bidCount ?? job.bids.length)})
                </button>
              </div>
            )
          )}

          {job.status === JobStatus.IN_PROGRESS && (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
            <button
              onClick={(e) => { e.stopPropagation(); onChat(job); }}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
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
                  className="flex-1 bg-amber-400 text-amber-950 px-4 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Star size={12} className="fill-current" /> {t.rateExperience}
                </button>
              )}
              {onHide && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(language === 'en' ? 'Remove this card from history?' : 'इस कार्ड को इतिहास से हटाएं?')) onHide(job.id); }}
                  className="bg-gray-100 dark:bg-gray-800 text-gray-400 p-2.5 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
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
