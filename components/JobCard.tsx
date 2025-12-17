import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, Bid } from '../types';
import { MapPin, IndianRupee, Clock, CheckCircle2 as CheckCircle, User as UserIcon, Calendar, Hourglass, XCircle, AlertCircle, ChevronRight, Ban, Pencil, ExternalLink, Navigation, Volume2, Square, TrendingUp, Handshake, CornerDownRight } from 'lucide-react';
import { TRANSLATIONS, CATEGORY_TRANSLATIONS } from '../constants';

interface JobCardProps {
  job: Job;
  currentUserId: string;
  userRole: UserRole;
  distance?: number; // Optional distance in km
  language: 'en' | 'hi';
  onBid: (jobId: string) => void;
  onViewBids: (job: Job) => void;
  onChat: (job: Job) => void;
  onEdit: (job: Job) => void;
  onClick: () => void; // New prop for card click
  onReplyToCounter?: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
  onWithdrawBid?: (jobId: string, bidId: string) => void;
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

export const JobCard: React.FC<JobCardProps> = ({
  job,
  currentUserId,
  userRole,
  distance,
  language,
  onBid,
  onViewBids,
  onChat,
  onEdit,
  onClick,
  onReplyToCounter,
  onWithdrawBid
}) => {
  const isPoster = job.posterId === currentUserId;
  const myBid = job.bids.find(b => b.workerId === currentUserId);
  const acceptedBid = job.acceptedBidId ? job.bids.find(b => b.id === job.acceptedBidId) : null;
  const t = TRANSLATIONS[language];
  const catT = CATEGORY_TRANSLATIONS[job.category] ? CATEGORY_TRANSLATIONS[job.category][language] : job.category;

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
    onReplyToCounter(job.id, myBid.id, 'COUNTER', parseInt(counterAmount));
    setShowCounterInput(false);
  };

  // Determine Worker Status UI
  const getWorkerStatusUI = () => {
    if (!myBid) return null;

    if (myBid.status === 'ACCEPTED') {
      return (
        <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-2 rounded-lg flex items-center shadow-sm border border-emerald-200">
          <CheckCircle size={14} className="mr-1.5" /> {t.hired}: ₹{myBid.amount}
        </div>
      );
    }
    if (myBid.status === 'REJECTED') {
      return (
        <div className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-lg flex items-center border border-red-100 opacity-80">
          <XCircle size={14} className="mr-1.5" /> {t.declined}
        </div>
      );
    }
    if (job.status !== JobStatus.OPEN && myBid.status === 'PENDING') {
      return (
        <div className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-2 rounded-lg flex items-center border border-gray-200">
          <Ban size={14} className="mr-1.5" /> {t.closed}
        </div>
      );
    }

    // Negotiation Logic
    const lastNegotiation = myBid.negotiationHistory?.[myBid.negotiationHistory.length - 1];
    const isPosterTurn = lastNegotiation?.by === UserRole.WORKER;
    const isWorkerTurn = lastNegotiation?.by === UserRole.POSTER;

    if (isWorkerTurn) {
      return (
        <div className="flex flex-col gap-2 w-full max-w-[240px]">
          <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-2 rounded-lg flex items-center border border-amber-200 shadow-sm animate-pulse-slow">
            <Handshake size={14} className="mr-1.5" /> {t.posterCountered}: ₹{myBid.amount}
          </div>
          {showCounterInput ? (
            <div className="flex gap-1 items-center bg-white border rounded-lg p-1 shadow-md" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                className="w-16 text-xs p-1 border rounded"
                placeholder="₹"
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                autoFocus
              />
              <button onClick={submitCounter} className="bg-emerald-600 text-white text-xs px-2 py-1 rounded font-bold">✓</button>
              <button onClick={(e) => { e.stopPropagation(); setShowCounterInput(false) }} className="text-gray-400 text-xs px-1">✕</button>
            </div>
          ) : (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'ACCEPT')} className="flex-1 bg-emerald-600 text-white text-xs py-1.5 rounded-lg font-bold shadow-sm">{t.acceptCounter}</button>
              <button onClick={() => setShowCounterInput(true)} className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-1.5 rounded-lg font-bold hover:bg-gray-50">{t.counterOffer}</button>
              <button onClick={() => onReplyToCounter?.(job.id, myBid.id, 'REJECT')} className="bg-red-50 text-red-600 border border-red-100 px-2 rounded-lg"><XCircle size={14} /></button>
            </div>
          )}
        </div>
      );
    }

    if (isPosterTurn) {
      return (
        <div className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center border border-blue-100">
          <Clock size={14} className="mr-1.5" /> {t.waitingForResponse}: ₹{myBid.amount}
        </div>
      );
    }

    // Default Pending (should cover standard flow)
    return (
      <div className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-2 rounded-lg flex justify-between items-center border border-blue-100">
        <span className="flex items-center"><Clock size={14} className="mr-1.5" /> {t.pending}: ₹{myBid.amount}</span>
        {onWithdrawBid && (
          <button
            onClick={(e) => { e.stopPropagation(); onWithdrawBid(job.id, myBid.id); }}
            className="bg-white/50 hover:bg-white text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-transparent hover:border-red-100 transition-all text-[10px]"
          >
            {language === 'en' ? 'Withdraw' : 'वापस लें'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 sm:p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-emerald-100 hover:scale-[1.01] relative overflow-hidden group cursor-pointer"
    >

      {/* Top Header Row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          {/* Poster Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 font-bold text-lg border border-gray-100 shadow-sm overflow-hidden">
            {job.posterPhoto ? (
              <img src={job.posterPhoto} alt={job.posterName} className="w-full h-full object-cover" />
            ) : (
              job.posterName.charAt(0)
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight text-lg group-hover:text-emerald-800 transition-colors">{job.title}</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
              {job.posterName}
              {isPoster && <span className="ml-1 bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-bold">YOU</span>}
              <span className="mx-1 w-0.5 h-0.5 bg-gray-300 rounded-full"></span>
              {getTimeAgo(job.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 uppercase tracking-wide">
            {catT}
          </span>
          {/* Read Aloud Button */}
          <button
            onClick={handleSpeak}
            className={`p-1.5 rounded-full transition-all border ${isSpeaking ? 'bg-red-50 text-red-500 border-red-100 animate-pulse' : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-emerald-600 hover:bg-emerald-50'}`}
            title="Read Aloud"
          >
            {isSpeaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {/* Info Chips Row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Location / Distance */}
        <div className={`inline-flex items-center bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100 text-xs font-medium text-gray-600 ${job.coordinates ? 'pr-1' : 'px-2.5'}`}>
          <MapPin size={12} className="mr-1.5 text-emerald-600" />
          {distance !== undefined && distance < 100
            ? <span className="mr-1 font-bold text-gray-800">{distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}</span>
            : null
          }
          <span className={`${distance !== undefined && distance < 100 ? 'text-gray-400 pl-1 border-l border-gray-300' : ''} ml-1 mr-1`}>
            {job.location}
          </span>
          {job.coordinates && (
            <div className="flex items-center gap-1 border-l border-gray-200 pl-1 ml-1">
              <button onClick={(e) => openMaps(e, 'search')} className="p-1 hover:bg-emerald-100 rounded-md text-gray-500 hover:text-emerald-600 transition-colors" title="View Map">
                <ExternalLink size={12} />
              </button>
              <button onClick={(e) => openMaps(e, 'dir')} className="p-1 hover:bg-emerald-100 rounded-md text-emerald-600 hover:text-emerald-700 transition-colors" title="Get Directions">
                <Navigation size={12} fill="currentColor" />
              </button>
            </div>
          )}
        </div>

        {/* Date */}
        <div className="inline-flex items-center bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-medium text-gray-600">
          <Calendar size={12} className="mr-1.5 text-emerald-600" />
          {dateDisplay}
        </div>

        {/* Duration */}
        <div className="inline-flex items-center bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 text-xs font-medium text-gray-600">
          <Hourglass size={12} className="mr-1.5 text-emerald-600" />
          {job.duration}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-5 leading-relaxed line-clamp-2">
        {job.description}
      </p>

      {/* Job Image Thumbnail (New) */}
      {job.image && (
        <div className="mb-5 h-32 w-full rounded-xl overflow-hidden relative">
          <img src={job.image} alt="Job Context" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      )}

      {/* Footer Area */}
      <div className="flex items-end justify-between pt-4 border-t border-dashed border-gray-200">

        {/* Budget Section */}
        <div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{t.budget}</p>
          <p className="text-2xl font-extrabold text-emerald-700 flex items-center leading-none">
            <span className="text-lg mr-0.5">₹</span>{job.budget}
          </p>
        </div>

        {/* Actions Section */}
        <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>

          {/* Worker Actions */}
          {userRole === UserRole.WORKER && !isPoster && (
            !myBid && job.status === JobStatus.OPEN ? (
              <button
                onClick={() => onBid(job.id)}
                className="bg-emerald-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-200 transition-all flex items-center"
              >
                {t.bidNow} <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              getWorkerStatusUI()
            )
          )}

          {/* Poster Actions */}
          {userRole === UserRole.POSTER && isPoster && job.status === JobStatus.OPEN && (
            job.bids.length === 0 ? (
              <button
                onClick={() => onEdit(job)}
                className="bg-white border-2 border-emerald-100 text-emerald-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-colors flex items-center gap-1.5"
              >
                <Pencil size={14} />
                {t.editJob}
              </button>
            ) : (
              <button
                onClick={() => onViewBids(job)}
                className="relative bg-white border-2 border-emerald-100 text-emerald-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              >
                {t.viewBids}
                {job.bids.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[20px] text-center border-2 border-white">
                    {job.bids.length}
                  </span>
                )}
              </button>
            )
          )}

          {/* Contact Button */}
          {(job.status === JobStatus.IN_PROGRESS || job.status === JobStatus.COMPLETED) &&
            (isPoster || (acceptedBid && acceptedBid.workerId === currentUserId)) && (
              <button
                onClick={() => onChat(job)}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all"
              >
                <UserIcon size={16} className="mr-2" />
                {t.chat}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};