import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, Bid } from '../types';
import { MapPin, IndianRupee, Clock, CheckCircle2 as CheckCircle, User as UserIcon, Calendar, Hourglass, XCircle, AlertCircle, ChevronRight, Ban, Pencil, ExternalLink, Navigation, Volume2, Square, TrendingUp, Handshake, CornerDownRight, Star, Trash2, Sparkles } from 'lucide-react';
import { TRANSLATIONS, CATEGORY_TRANSLATIONS } from '../constants';

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
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500 dark:border-emerald-400 py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 animate-pulse-subtle shadow-lg shadow-emerald-500/10">
            <CheckCircle size={14} strokeWidth={3} /> {language === 'en' ? 'Worker Agreed - Ready to Hire!' : 'मज़दूर सहमत - नियुक्त करें'}
          </div>
        );
      }
      if (job.myBidLastNegotiationBy === UserRole.WORKER) {
        return (
          <div className="badge badge-warning animate-pulse-subtle">
            <Handshake size={12} className="mr-1" /> {language === 'en' ? 'Worker countered - Your turn' : 'मज़दूर ने काउंटर किया - आपकी बारी'}
          </div>
        );
      }
      if (job.hasNewBid) {
        return (
          <div className="badge badge-success">
            <AlertCircle size={12} className="mr-1" /> {language === 'en' ? 'New Bid Received!' : 'नई बोली प्राप्त हुई!'}
          </div>
        );
      }
    }

    if (!myBid) return null;

    if (myBid.status === 'ACCEPTED') {
      return (
        <div className="bg-emerald-500 text-white py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20">
          <CheckCircle size={14} strokeWidth={3} /> {t.hired}: ₹{myBid.amount}
        </div>
      );
    }
    if (myBid.status === 'REJECTED') {
      return (
        <div className="flex items-center gap-2">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-100 dark:border-red-800/50 py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
            <XCircle size={14} strokeWidth={3} /> {t.declined}
          </div>
          {onHide && (
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(language === 'en' ? 'Remove this card from history?' : 'इस कार्ड को इतिहास से हटाएं?')) onHide(job.id); }}
              className="bg-red-50 dark:bg-red-900/10 text-red-500 p-3 rounded-2xl hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
              title={language === 'en' ? 'Remove from history' : 'इतिहास से हटाएं'}
            >
              <Trash2 size={16} strokeWidth={3} />
            </button>
          )}
        </div>
      );
    }
    if (job.status !== JobStatus.OPEN && myBid.status === 'PENDING') {
      return (
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-2 border-gray-200 dark:border-gray-700 py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 opacity-60">
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
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 animate-pulse-subtle">
            <Handshake size={14} strokeWidth={3} /> {t.posterCountered}: ₹{myBid.amount}
          </div>
          {showCounterInput ? (
            <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl p-2 shadow-xl" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                className="flex-1 text-sm font-black p-2 bg-transparent outline-none text-gray-900 dark:text-white"
                placeholder="₹"
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                autoFocus
                min="1"
              />
              <button onClick={submitCounter} className="w-10 h-10 bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform">✓</button>
              <button onClick={(e) => { e.stopPropagation(); setShowCounterInput(false) }} className="w-10 h-10 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-xl font-black flex items-center justify-center active:scale-90 transition-transform">✕</button>
            </div>
          ) : (
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'ACCEPT')} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 active:scale-95 transition-all">{t.acceptCounter}</button>
              <button onClick={() => setShowCounterInput(true)} className="flex-1 bg-white dark:bg-gray-800 text-emerald-600 border-2 border-emerald-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">{t.counterOffer}</button>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'REJECT')} className="bg-red-50 dark:bg-red-900/20 text-red-500 p-3 rounded-2xl border-2 border-red-100 dark:border-red-800/50 active:scale-95 transition-all"><XCircle size={16} strokeWidth={2.5} /></button>
            </div>
          )}
        </div>
      );
    }

    if (isPosterTurn) {
      return (
        <div className={`border-2 py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 ${isAgreed
          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'}`}>
          {isAgreed ? (
            <><Handshake size={14} strokeWidth={3} /> {t.waitingForPosterFinalize || 'Waiting for Finalization'}</>
          ) : (
            <><Clock size={14} strokeWidth={3} /> {t.waitingForResponse}: ₹{myBid.amount}</>
          )}
        </div>
      );
    }

    // Default Pending
    return (
      <div className="bg-blue-500 text-white py-3 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex justify-between items-center w-full max-w-[260px] shadow-lg shadow-blue-500/20">
        <span className="flex items-center"><Clock size={14} className="mr-2" strokeWidth={3} /> {t.pending}: ₹{myBid.amount}</span>
        {onWithdrawBid && (
          <button
            onClick={(e) => { e.stopPropagation(); onWithdrawBid(job.id, myBid.id); }}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
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
      className="relative p-7 rounded-[2.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] transition-all duration-500 group overflow-hidden"
    >
      {/* Category Pill & Time */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <span className="px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-800/30">
            {catT}
          </span>
          {userRole === UserRole.WORKER && !isPoster && job.status === JobStatus.OPEN && (
            isPremium ? (
              matchLoading ? (
                <div className="w-24 h-6 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
              ) : matchData ? (
                <div className="flex items-center gap-2 group/match relative cursor-default">
                  <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-500/20 flex items-center gap-1.5 border border-white/10">
                    <TrendingUp size={10} strokeWidth={4} />
                    {matchData.score}% Match
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 text-white p-3 rounded-xl text-[10px] opacity-0 group-hover/match:opacity-100 translate-y-2 group-hover/match:translate-y-0 transition-all pointer-events-none shadow-2xl z-50 border border-white/10 backdrop-blur-xl">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-violet-400">
                      <Sparkles size={10} /> AI ANALYSIS
                    </p>
                    {matchData.reason}
                  </div>
                </div>
              ) : null
            ) : (
              <div className="px-3 py-1.5 rounded-full bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 text-[9px] font-black uppercase tracking-widest border border-dashed border-gray-200 dark:border-gray-700 flex items-center gap-1.5 opacity-60">
                <TrendingUp size={10} strokeWidth={3} />
                AI Insight
                <span className="w-1 h-1 rounded-full bg-amber-500" />
              </div>
            )
          )}
          {job.hasNewBid && (
            <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-lg animate-bounce uppercase tracking-tighter">NEW BID</span>
          )}
          {job.hasNewCounter && (
            <span className="bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded-lg animate-pulse uppercase tracking-tighter">UPDATED</span>
          )}
        </div>
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
          {getTimeAgo(job.createdAt)}
        </span>
      </div>

      {/* Title & Budget Section */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="flex-1">
          <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight group-hover:text-emerald-600 transition-colors line-clamp-2 tracking-tight">
            {job.title}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> {posterName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t.budget}</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
            ₹{job.budget}
          </p>
        </div>
      </div>

      {/* Meta Info Row */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/80 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
          <MapPin size={14} className="mr-2 text-emerald-500" strokeWidth={2.5} />
          {distance !== undefined && distance < 100 ? `${distance.toFixed(1)} km` : job.location}
        </div>
        <div className="flex items-center text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/80 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
          <Calendar size={14} className="mr-2 text-emerald-500" strokeWidth={2.5} />
          {dateDisplay}
        </div>
      </div>

      {/* Description Snippet (Small) */}
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8 line-clamp-2 leading-relaxed">
        {job.description}
      </p>

      {/* Action Area */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-50 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleSpeak}
          className={`w-11 h-11 rounded-xl transition-all flex items-center justify-center ${isSpeaking ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
        >
          {isSpeaking ? <Square size={18} fill="currentColor" /> : <Volume2 size={18} />}
        </button>

        <div className="flex-1 flex justify-end">
          {userRole === UserRole.WORKER && !isPoster && (
            !myBid && job.status === JobStatus.OPEN ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Minimal local protection: if parent is slow, at least show pulse
                  const btn = e.currentTarget;
                  btn.classList.add('opacity-70', 'cursor-wait');
                  onBid(job.id);
                }}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {t.bidNow} <ChevronRight size={16} strokeWidth={3} />
              </button>
            ) : (
              getStatusUI()
            )
          )}

          {userRole === UserRole.POSTER && isPoster && job.status === JobStatus.OPEN && (
            (job.bidCount ?? job.bids.length) === 0 ? (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(job); }}
                className="w-full sm:w-auto bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                <Pencil size={14} strokeWidth={3} /> {t.editJob}
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {t.viewBids} ({(job.bidCount ?? job.bids.length)})
                </button>
              </div>
            )
          )}

          {job.status === JobStatus.IN_PROGRESS && (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
            <button
              onClick={(e) => { e.stopPropagation(); onChat(job); }}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <UserIcon size={16} strokeWidth={3} /> {t.chat}
            </button>
          )}

          {job.status === JobStatus.COMPLETED && (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => onClick()}
                className="flex-1 bg-amber-500 text-white px-4 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Star size={14} className="fill-white" /> {t.rateExperience}
              </button>
              <button
                onClick={() => onChat(job)}
                className="bg-gray-100 dark:bg-gray-800 text-gray-500 p-3.5 rounded-2xl hover:bg-gray-200 transition-all"
              >
                <UserIcon size={16} strokeWidth={3} />
              </button>
              {onHide && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(language === 'en' ? 'Remove this card from history?' : 'इस कार्ड को इतिहास से हटाएं?')) onHide(job.id); }}
                  className="bg-red-50 dark:bg-red-900/10 text-red-500 p-3.5 rounded-2xl hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
                >
                  <Trash2 size={16} strokeWidth={3} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div >
  );
});