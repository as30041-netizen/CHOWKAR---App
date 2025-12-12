import React, { useState } from 'react';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { Job, Bid, ChatMessage, UserRole, JobStatus, Transaction, Coordinates, Notification, Review, User } from './types';
import { CATEGORIES, POSTER_FEE, WORKER_COMMISSION_RATE, CATEGORY_TRANSLATIONS, REVIEW_TAGS, REVIEW_TAGS_TRANSLATIONS } from './constants';
import { JobCard } from './components/JobCard';
import { ChatInterface } from './components/ChatInterface';
import { JobPostingForm } from './components/JobPostingForm';
import { WalletView } from './components/WalletView';
import { LeafletMap } from './components/LeafletMap';
import { enhanceBidMessageStream, translateText } from './services/geminiService';
import { getDeviceLocation, calculateDistance } from './utils/geo';
import { sendOTP, verifyOTP, SignUpData } from './services/authService';
import { supabase } from './lib/supabase';
import { 
  MapPin, LayoutGrid, Plus, Wallet, UserCircle, Search, SlidersHorizontal, 
  ArrowLeftRight, Bell, MessageCircle, Languages, Loader2, Navigation, 
  ArrowUpRight, LogOut, Phone, Star, Award, CheckCircle2, Briefcase, 
  ArrowDownWideNarrow, Sparkles, ChevronRight, 
  ArrowDownLeft, X, IndianRupee, Hourglass, 
  Calendar, Trash2, Pencil, Check, AlertCircle, Camera,
  Mic, MicOff, Share2, ExternalLink, Copy, Map, Crown, Lock, XCircle, Calculator, Handshake
} from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn,
    transactions, setTransactions, notifications, setNotifications, messages, setMessages,
    addNotification, checkFreeLimit, incrementAiUsage, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB
  } = useUser();
  
  const { jobs, setJobs, updateJob, deleteJob } = useJobs();

  // --- Auth State ---
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [regName, setRegName] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regCoords, setRegCoords] = useState<Coordinates | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<'home' | 'post' | 'wallet' | 'profile'>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  
  // Specific Modals
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [chatOpen, setChatOpen] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [bidModalOpen, setBidModalOpen] = useState<{ isOpen: boolean; jobId: string | null }>({ isOpen: false, jobId: null });
  const [viewBidsModal, setViewBidsModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [counterModalOpen, setCounterModalOpen] = useState<{ isOpen: boolean; bidId: string | null; jobId: string | null }>({ isOpen: false, bidId: null, jobId: null });
  const [counterInputAmount, setCounterInputAmount] = useState('');

  // --- Job Editing State ---
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editBudget, setEditBudget] = useState('');

  // --- Bidding State ---
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [isEnhancingBid, setIsEnhancingBid] = useState(false);

  // --- Filter/Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterMinBudget, setFilterMinBudget] = useState('');
  const [filterMaxDistance, setFilterMaxDistance] = useState('');
  const [showMyBidsOnly, setShowMyBidsOnly] = useState(false);
  const [isSearchingVoice, setIsSearchingVoice] = useState(false);

  // --- Profile Edit State ---
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfilePhone, setEditProfilePhone] = useState('');
  const [editProfileLocation, setEditProfileLocation] = useState('');
  const [editProfileBio, setEditProfileBio] = useState('');
  const [editProfileExp, setEditProfileExp] = useState('');
  const [editProfileSkills, setEditProfileSkills] = useState('');
  const [editProfilePhoto, setEditProfilePhoto] = useState('');

  // --- Review State ---
  const [reviewTarget, setReviewTarget] = useState<{id: string, name: string} | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState<string[]>([]);

  const unreadCount = notifications.filter(n => n.userId === user.id && !n.read).length;
  const postedJobsCount = jobs.filter(j => j.posterId === user.id).length;

  // --- Handlers ---
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileNumber.length >= 10) {
      const result = await sendOTP(mobileNumber);
      if (result.success) {
        setOtpSent(true);
      } else {
        showAlert(result.error || t.alertInvalidMobile, 'error');
      }
    } else {
      showAlert(t.alertInvalidMobile, 'error');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const signUpData: SignUpData | undefined = authView === 'signup' ? {
      phone: mobileNumber,
      name: regName || 'New User',
      location: regLocation || 'India',
      coordinates: regCoords
    } : undefined;

    const result = await verifyOTP(mobileNumber, enteredOtp, signUpData);

    if (result.success && result.user) {
      setUser(result.user);
      setIsLoggedIn(true);

      if (authView === 'signup') {
        await addNotification(result.user.id, t.notifWelcome, t.notifWelcomeBody, "SUCCESS");
      }
    } else {
      showAlert(result.error || t.alertInvalidOtp, 'error');
    }
  };

  const handleLogout = () => {
      logout();
      setAuthView('signin');
      setOtpSent(false);
      setEnteredOtp('');
      setMobileNumber('');
  };

  const handleEnhanceBid = async () => {
    if (!checkFreeLimit()) return;
    if (!bidMessage.trim()) return;
    
    const job = jobs.find(j => j.id === bidModalOpen.jobId);
    if (!job) return;

    setIsEnhancingBid(true);
    // Use streaming service
    await enhanceBidMessageStream(bidMessage, job.title, language, (text) => {
        setBidMessage(text);
    });
    
    setIsEnhancingBid(false);
    incrementAiUsage();
  };

  const handlePlaceBid = async () => {
    if (!bidModalOpen.jobId || !bidAmount) return;
    const commission = Math.ceil(parseInt(bidAmount) * WORKER_COMMISSION_RATE);
    if (user.walletBalance < commission) {
        showAlert(`${t.alertInsufficientBalance}${commission}`, 'error');
        return;
    }

    const job = jobs.find(j => j.id === bidModalOpen.jobId);
    if (!job) return;

    const newBid: Bid = {
        id: `b${Date.now()}`,
        jobId: job.id,
        workerId: user.id,
        workerName: user.name,
        workerPhone: user.phone,
        workerRating: user.rating,
        workerLocation: user.location,
        workerCoordinates: user.coordinates,
        workerPhoto: user.profilePhoto,
        amount: parseInt(bidAmount),
        message: bidMessage,
        createdAt: Date.now(),
        status: 'PENDING',
        negotiationHistory: [{
            amount: parseInt(bidAmount),
            by: UserRole.WORKER,
            timestamp: Date.now()
        }]
    };

    try {
      await updateJob({ ...job, bids: [...job.bids, newBid] });
      setBidModalOpen({ isOpen: false, jobId: null });
      setBidAmount('');
      setBidMessage('');
      if (selectedJob) setSelectedJob(null);

      await addNotification(job.posterId, t.notifBidReceived, `${user.name}: ₹${bidAmount}`, "INFO", job.id);
      showAlert(t.alertBidPlaced, 'success');
    } catch (error) {
      console.error('Error placing bid:', error);
      showAlert('Failed to place bid. Please try again.', 'error');
    }
  };

  const handleAcceptBid = async (jobId: string, bidId: string, bidAmount: number, workerId: string) => {
    if (user.walletBalance < POSTER_FEE) {
        showAlert(`${t.alertInsufficientBalance}${POSTER_FEE}`, 'error');
        return;
    }

    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    try {
      const updatedBids = job.bids.map(b =>
          b.id === bidId ? { ...b, status: 'ACCEPTED' as const } : { ...b, status: 'REJECTED' as const }
      );
      await updateJob({ ...job, status: JobStatus.IN_PROGRESS, acceptedBidId: bidId, bids: updatedBids });

      const newBalance = user.walletBalance - POSTER_FEE;

      const posterTx: Transaction = { id: `tx${Date.now()}p`, userId: user.id, amount: POSTER_FEE, type: 'DEBIT', description: t.alertBookingFee, timestamp: Date.now() };
      const workerTx: Transaction = { id: `tx${Date.now()}w`, userId: workerId, amount: Math.ceil(bidAmount * WORKER_COMMISSION_RATE), type: 'DEBIT', description: 'Success Fee', timestamp: Date.now() };

      await supabase.from('transactions').insert([
        { user_id: user.id, amount: POSTER_FEE, type: 'DEBIT', description: t.alertBookingFee },
        { user_id: workerId, amount: Math.ceil(bidAmount * WORKER_COMMISSION_RATE), type: 'DEBIT', description: 'Success Fee' }
      ]);

      setUser(prev => ({ ...prev, walletBalance: newBalance }));
      setTransactions(prev => [posterTx, workerTx, ...prev]);

      setViewBidsModal({ isOpen: false, job: null });
      if(selectedJob) setSelectedJob(null);

      await addNotification(workerId, t.notifBidAccepted, t.notifBidAcceptedBody, "SUCCESS", jobId);
      showAlert(t.contactUnlocked, 'success');
    } catch (error) {
      console.error('Error accepting bid:', error);
      showAlert('Failed to accept bid. Please try again.', 'error');
    }
  };

  const handleChatOpen = (job: Job) => {
    setChatOpen({ isOpen: true, job });
    setSelectedJob(null);
    setShowChatList(false);
    
    if (!messages.some(m => m.jobId === job.id)) {
        setMessages(prev => [...prev, { id: `sys_${job.id}`, jobId: job.id, senderId: 'system', text: 'Chat started.', timestamp: Date.now() }]);
    }
  };

  const handleTranslateChat = async (messageId: string, text: string) => {
    // Translate to current user's preferred language
    const translated = await translateText(text, language);
    setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, translatedText: translated } : m
    ));
  };

  const handleCounterByPoster = async () => {
      if (!counterModalOpen.jobId || !counterModalOpen.bidId || !counterInputAmount) return;
      const newAmount = parseInt(counterInputAmount);

      const job = jobs.find(j => j.id === counterModalOpen.jobId);
      if(job) {
          try {
            const updatedBids = job.bids.map(b => {
                if(b.id === counterModalOpen.bidId) {
                    return {
                        ...b,
                        amount: newAmount,
                        negotiationHistory: [...(b.negotiationHistory || []), {
                            amount: newAmount,
                            by: UserRole.POSTER,
                            timestamp: Date.now()
                        }]
                    }
                }
                return b;
            });
            const updatedJob = { ...job, bids: updatedBids };
            await updateJob(updatedJob);

            if(viewBidsModal.isOpen) setViewBidsModal({ ...viewBidsModal, job: updatedJob });
            const workerId = job.bids.find(b => b.id === counterModalOpen.bidId)?.workerId;
            if(workerId) await addNotification(workerId, t.notifCounterOffer, `${t.posterCountered}: ₹${newAmount}`, "INFO", job.id);
          } catch (error) {
            console.error('Error making counter offer:', error);
            showAlert('Failed to send counter offer. Please try again.', 'error');
          }
      }

      setCounterModalOpen({ isOpen: false, bidId: null, jobId: null });
      setCounterInputAmount('');
  };

  const handleWorkerReplyToCounter = async (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => {
      const job = jobs.find(j => j.id === jobId);
      if(!job) return;

      try {
        let updatedBids = job.bids;
        if (action === 'ACCEPT') {
            updatedBids = job.bids.map(b => b.id === bidId ? { ...b, negotiationHistory: [...(b.negotiationHistory || []), { amount: b.amount, by: UserRole.WORKER, timestamp: Date.now(), message: "Accepted Counter Offer" }] } : b);
            await addNotification(job.posterId, "Counter Accepted", "Worker accepted your offer. Please finalize hiring.", "SUCCESS", jobId);
        } else if (action === 'REJECT') {
            updatedBids = job.bids.filter(b => b.id !== bidId);
            showAlert(t.alertJobDeleted, 'info');
        } else if (action === 'COUNTER' && amount) {
            updatedBids = job.bids.map(b => b.id === bidId ? { ...b, amount, negotiationHistory: [...(b.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] } : b);
            await addNotification(job.posterId, t.notifCounterOffer, `Worker countered: ₹${amount}`, "INFO", jobId);
        }
        await updateJob({ ...job, bids: updatedBids });
      } catch (error) {
        console.error('Error replying to counter offer:', error);
        showAlert('Failed to process counter offer. Please try again.', 'error');
      }
  };

  const toggleVoiceInput = (mode: 'description' | 'search') => {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) { showAlert("Voice input not supported", 'error'); return; }
      if (isSearchingVoice) { setIsSearchingVoice(false); try { (window as any).recognition?.stop(); } catch(e){} return; }

      setIsSearchingVoice(true);
      try {
          const recognition = new SpeechRecognition();
          (window as any).recognition = recognition;
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
          recognition.onresult = (event: any) => { setSearchQuery(event.results[0][0].transcript); setIsSearchingVoice(false); };
          recognition.onerror = () => setIsSearchingVoice(false);
          recognition.onend = () => setIsSearchingVoice(false);
          recognition.start();
      } catch(e) { setIsSearchingVoice(false); }
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => n.userId === user.id ? { ...n, read: true } : n));
  };
  
  const handleNotificationClick = (n: Notification) => {
      setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
      if (n.relatedJobId) {
          const job = jobs.find(j => j.id === n.relatedJobId);
          if (job) { setSelectedJob(job); setShowNotifications(false); }
      }
  };

  const handleEditJobInit = (job: Job) => {
    if (job.bids.length > 0) { showAlert(t.alertCantEdit, 'error'); return; }
    setEditingJob(job); setEditTitle(job.title); setEditDesc(job.description); setEditCategory(job.category); setEditDate(job.jobDate); setEditDuration(job.duration); setEditBudget(job.budget.toString());
    setSelectedJob(null);
  };

  const handleUpdateJob = async () => {
    if (!editingJob || !editTitle || !editDesc || !editBudget) return;
    try {
      await updateJob({ ...editingJob, title: editTitle, description: editDesc, category: editCategory, jobDate: editDate, duration: editDuration, budget: parseInt(editBudget) });
      setEditingJob(null);
      await addNotification(user.id, t.alertJobUpdated, t.alertJobUpdated, "SUCCESS");
      showAlert(t.alertJobUpdated, 'success');
    } catch (error) {
      console.error('Error updating job:', error);
      showAlert('Failed to update job. Please try again.', 'error');
    }
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    if (job.status !== JobStatus.OPEN) { showAlert(t.alertCantDeleteProgress, 'error'); return; }
    if (window.confirm(t.alertConfirmDelete)) {
      try {
        await deleteJob(jobId);
        setSelectedJob(null);
        showAlert(t.alertJobDeleted, 'success');
      } catch (error) {
        console.error('Error deleting job:', error);
        showAlert('Failed to delete job. Please try again.', 'error');
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setEditProfilePhoto(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReview = () => {
     if (reviewRating === 0) { showAlert("Please select a rating.", 'error'); return; }
     const newReview: Review = { id: `rev${Date.now()}`, reviewerId: user.id, reviewerName: user.name, rating: reviewRating, comment: reviewComment, date: Date.now(), tags: reviewTags };
     if (reviewTarget && reviewTarget.id === user.id) { setUser(prev => ({ ...prev, reviews: [newReview, ...(prev.reviews || [])] })); }
     addNotification(reviewTarget!.id, "New Review", `You received a ${reviewRating} star review from ${user.name}!`, "SUCCESS");
     setReviewModalOpen(false); showAlert(t.reviewSubmitted, 'success');
  };
  
  const handleSaveProfile = async () => {
    try {
      const updates = {
        name: editProfileName,
        phone: editProfilePhone,
        location: editProfileLocation,
        bio: editProfileBio,
        experience: editProfileExp,
        skills: editProfileSkills.split(',').map(s => s.trim()).filter(s => s),
        profilePhoto: editProfilePhoto
      };

      await updateUserInDB(updates);
      setShowEditProfile(false);
      await addNotification(user.id, t.notifProfileUpdated, t.notifProfileUpdatedBody, "SUCCESS");
      showAlert(t.notifProfileUpdated, 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Failed to update profile. Please try again.', 'error');
    }
  };

  // --- Auth View ---
  if (!isLoggedIn) {
     return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100 flex flex-col items-center justify-center p-6 font-sans text-gray-900 relative">
         <style>{`
          input, textarea, select { background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important; -webkit-appearance: none; appearance: none; }
          input::placeholder, textarea::placeholder { color: #9ca3af !important; }
          input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active{ -webkit-box-shadow: 0 0 0 30px white inset !important; -webkit-text-fill-color: black !important; }
         `}</style>
         
         <div className="absolute top-6 right-6 z-10">
            <button onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')} className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-emerald-100 shadow-sm text-xs font-bold text-emerald-800 hover:bg-white transition-all">
                <Languages size={14} /> {language === 'en' ? 'हिन्दी' : 'English'}
            </button>
        </div>

        {/* Global Alert Toast */}
        {currentAlert && (
            <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 animate-slide-down backdrop-blur-md border border-white/20 ${
                currentAlert.type === 'error' ? 'bg-red-500/90 text-white' : 
                currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white' : 
                'bg-gray-800/90 text-white'
            }`}>
                {currentAlert.type === 'error' && <XCircle size={18} className="text-white/80"/>}
                {currentAlert.type === 'success' && <CheckCircle2 size={18} className="text-white/80"/>}
                {currentAlert.type === 'info' && <AlertCircle size={18} className="text-white/80"/>}
                <span>{currentAlert.message}</span>
            </div>
        )}

        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50 animate-pop duration-500">
            <div className="mb-8 flex flex-col items-center">
               <div className="w-20 h-20 bg-gradient-to-tr from-emerald-100 to-green-50 rounded-full flex items-center justify-center mb-4 shadow-inner ring-4 ring-white">
                  <MapPin size={40} className="text-emerald-600 drop-shadow-sm" fill="#10b981" />
               </div>
               <h1 className="text-4xl font-black text-emerald-950 tracking-tighter drop-shadow-sm">CHOWKAR</h1>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{authView === 'signin' ? t.signIn : t.joinTitle}</h2>
            
            {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide ml-1">{t.mobileNumber}</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700 font-bold border-r border-emerald-100 pr-3">+91</span>
                            <input type="tel" required maxLength={10} className="w-full bg-white border-2 border-emerald-100/80 rounded-2xl p-4 pl-16 text-lg font-semibold outline-none focus:border-emerald-500 transition-all placeholder-gray-300 shadow-sm" value={mobileNumber} onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))} placeholder="98765 43210" />
                            <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    {authView === 'signup' && (
                        <div className="space-y-4 animate-slide-down">
                            <div className="relative group">
                                <UserCircle size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" required className="w-full bg-white border-2 border-emerald-100/80 rounded-2xl p-4 pl-12 font-medium outline-none focus:border-emerald-500 transition-all placeholder-gray-400 shadow-sm" placeholder={t.fullName} value={regName} onChange={e => setRegName(e.target.value)} />
                            </div>
                            <div className="relative group">
                                <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" required className="w-full bg-white border-2 border-emerald-100/80 rounded-2xl p-4 pl-12 font-medium outline-none focus:border-emerald-500 transition-all placeholder-gray-400 shadow-sm" placeholder={t.cityVillage} value={regLocation} onChange={e => setRegLocation(e.target.value)} />
                            </div>
                            <button type="button" onClick={() => { setIsGettingLocation(true); getDeviceLocation(setRegCoords, () => setIsGettingLocation(false)); }} className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-all ${regCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                                {isGettingLocation ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />} {regCoords ? t.locationCaptured : t.useGps}
                            </button>
                        </div>
                    )}

                    <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:translate-y-[-2px] transition-all mt-4">
                        {t.getOtp} <ArrowUpRight size={20} className="inline ml-2" />
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6 animate-slide-in-right">
                    <div className="text-center"><p className="text-sm text-gray-500 font-medium mb-1">{t.otpSentTo}</p><p className="text-lg font-bold text-gray-800 tracking-wide">+91 {mobileNumber}</p></div>
                    <div className="relative"><input type="text" maxLength={6} className="w-full bg-gray-50 border-2 border-emerald-100 rounded-2xl p-4 text-center text-3xl font-bold tracking-[0.5em] text-emerald-800 outline-none focus:bg-white focus:border-emerald-500 transition-all" placeholder="••••••" value={enteredOtp} onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))} /></div>
                    <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all">{authView === 'signin' ? t.verifyLogin : t.verifyRegister}</button>
                    <button type="button" onClick={() => setOtpSent(false)} className="w-full text-sm text-emerald-600 font-bold hover:underline">Change Mobile Number</button>
                </form>
            )}
            
            <div className="text-center mt-8 pt-6 border-t border-gray-100">
                <button onClick={() => { setAuthView(authView === 'signin' ? 'signup' : 'signin'); setOtpSent(false); }} className="text-gray-500 font-medium hover:text-emerald-700 transition-colors text-sm">
                    {authView === 'signin' ? t.newHere : t.alreadyHaveAccount} <span className="font-bold text-emerald-700 underline decoration-2 underline-offset-4 ml-1">{authView === 'signin' ? t.createAccount : t.signIn}</span>
                </button>
            </div>
        </div>
      </div>
    );
  }

  // --- Main App UI ---
  return (
    <div className="min-h-screen bg-green-50 font-sans text-gray-900">
      <style>{`
          input, textarea, select { background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important; -webkit-appearance: none; appearance: none; }
          input::placeholder, textarea::placeholder { color: #9ca3af !important; }
          input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active{ -webkit-box-shadow: 0 0 0 30px white inset !important; -webkit-text-fill-color: black !important; }
      `}</style>
      <div className="max-w-md mx-auto min-h-screen bg-green-50 relative shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-white px-4 py-3 sticky top-0 z-30 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin size={24} className="text-emerald-600" fill="#10b981" />
            <div><h1 className="text-xl font-bold text-emerald-900 leading-none">CHOWKAR</h1><span className="text-[10px] font-medium text-emerald-800">by Jyorick</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')} className="p-2 rounded-full hover:bg-gray-100 text-emerald-800 flex items-center gap-1 text-xs font-bold"><Languages size={18} /> {language === 'en' ? 'हि' : 'En'}</button>
            <button onClick={() => setShowChatList(true)} className="relative p-2 rounded-full hover:bg-gray-100"><MessageCircle size={20} className="text-gray-600" /></button>
            <button onClick={() => setShowNotifications(true)} className="relative p-2 rounded-full hover:bg-gray-100">
                <Bell size={20} className="text-gray-600" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>
            <button onClick={() => { setRole(r => r === UserRole.WORKER ? UserRole.POSTER : UserRole.WORKER); setActiveTab('home'); setShowMyBidsOnly(false); }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-full text-xs font-semibold text-emerald-800">
                <ArrowLeftRight size={14} />{role === UserRole.WORKER ? t.switchHiring : t.switchWorking}
            </button>
          </div>
        </header>

        {/* Global Alert Toast */}
        {currentAlert && (
            <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 animate-slide-down backdrop-blur-md border border-white/20 ${
                currentAlert.type === 'error' ? 'bg-red-500/90 text-white' : 
                currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white' : 
                'bg-gray-800/90 text-white'
            }`}>
                {currentAlert.type === 'error' && <XCircle size={18} className="text-white/80"/>}
                {currentAlert.type === 'success' && <CheckCircle2 size={18} className="text-white/80"/>}
                {currentAlert.type === 'info' && <AlertCircle size={18} className="text-white/80"/>}
                <span>{currentAlert.message}</span>
            </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-green-50 pb-20">
            {activeTab === 'home' && (
                <div className="p-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-emerald-900">{role === UserRole.POSTER ? t.myJobPosts : (showMyBidsOnly ? t.myApplications : t.jobsNearMe)}</h2></div>
                    {/* Search/Filter Bar */}
                    <div className="mb-4 space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="text" placeholder={role === UserRole.WORKER ? t.searchWork : t.searchPosts} className="w-full pl-10 pr-10 py-2.5 appearance-none bg-white text-black border border-emerald-100 rounded-xl text-sm outline-none shadow-sm placeholder-gray-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <button 
                                    onClick={() => toggleVoiceInput('search')} 
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isSearchingVoice ? 'bg-red-50 text-red-500 animate-pulse' : 'hover:bg-gray-100 text-gray-400'}`}
                                >
                                    {isSearchingVoice ? <MicOff size={16}/> : <Mic size={16}/>}
                                </button>
                            </div>
                            <button onClick={() => setShowFilterModal(true)} className={`p-2.5 rounded-xl border transition-colors shadow-sm ${filterLocation ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-gray-500'}`}><SlidersHorizontal size={20} /></button>
                        </div>
                        <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                            {role === UserRole.WORKER && <button onClick={() => setShowMyBidsOnly(!showMyBidsOnly)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border ${showMyBidsOnly ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}><CheckCircle2 size={12} /> {t.myBids}</button>}
                            {['All', ...CATEGORIES].map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}>{cat === 'All' ? t.allJobs : (CATEGORY_TRANSLATIONS[cat]?.[language] || cat)}</button>)}
                        </div>
                    </div>
                    {/* Job List */}
                    {jobs.map(j => ({ ...j, distance: (user.coordinates && j.coordinates) ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng) : undefined }))
                        .filter(j => {
                            if (role === UserRole.POSTER) return j.posterId === user.id;
                            const isMyJob = j.posterId === user.id;
                            const myBid = j.bids.find(b => b.workerId === user.id);
                            if (isMyJob) return false;
                            if (showMyBidsOnly && !myBid) return false;
                            if (j.status !== JobStatus.OPEN && !myBid) return false;
                            if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                            if (selectedCategory !== 'All' && j.category !== selectedCategory) return false;
                            if (filterLocation && !j.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
                            if (filterMinBudget && j.budget < parseInt(filterMinBudget)) return false;
                            if (filterMaxDistance && j.distance !== undefined && j.distance > parseInt(filterMaxDistance)) return false;
                            return true;
                        }).map(job => (
                            <JobCard key={job.id} job={job} currentUserId={user.id} userRole={role} distance={job.distance} language={language}
                                onBid={(id) => setBidModalOpen({ isOpen: true, jobId: id })}
                                onViewBids={(j) => setViewBidsModal({ isOpen: true, job: j })}
                                onChat={handleChatOpen}
                                onEdit={(j) => {
                                    if(j.bids.length > 0) { showAlert(t.alertCantEdit, 'error'); return; }
                                    setEditingJob(j); setEditTitle(j.title); setEditDesc(j.description); setEditCategory(j.category); setEditDate(j.jobDate); setEditDuration(j.duration); setEditBudget(j.budget.toString());
                                }}
                                onClick={() => setSelectedJob(job)}
                                onReplyToCounter={handleWorkerReplyToCounter}
                            />
                        ))}
                    {jobs.length === 0 && <div className="text-center py-10 text-gray-400"><Briefcase size={48} className="mx-auto mb-2 opacity-50" /><p>{t.noJobsFound}</p></div>}
                </div>
            )}

            {activeTab === 'post' && role === UserRole.POSTER && (
                <JobPostingForm onSuccess={() => setActiveTab('home')} />
            )}

            {activeTab === 'wallet' && (
                <WalletView onShowBidHistory={() => setShowBidHistory(true)} />
            )}

            {activeTab === 'profile' && (
                <div className="pb-24 animate-fade-in">
                    <div className="bg-white rounded-b-3xl shadow-sm border-b border-gray-100 overflow-hidden mb-4">
                        <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-500 relative">
                            <button onClick={() => {setEditProfileName(user.name); setEditProfilePhone(user.phone); setEditProfileLocation(user.location); setEditProfileBio(user.bio || ''); setEditProfileExp(user.experience || ''); setEditProfileSkills(user.skills?.join(', ') || ''); setEditProfilePhoto(user.profilePhoto || ''); setShowEditProfile(true);}} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white"><Pencil size={18} /></button>
                            {user.isPremium && <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm"><Crown size={14} fill="currentColor"/> Premium</div>}
                        </div>
                        <div className="px-5 pb-6 -mt-12 flex flex-col items-center">
                            <div className="w-24 h-24 bg-white p-1.5 rounded-full shadow-lg mb-3 relative overflow-hidden animate-pop">
                                {user.profilePhoto ? <img src={user.profilePhoto} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-emerald-100 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700">{user.name.charAt(0)}</div>}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{user.name} <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" /></h2>
                            <p className="text-gray-500 font-medium text-sm flex items-center gap-1"><MapPin size={14} /> {user.location}</p>
                        </div>
                    </div>
                    <div className="px-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center"><div className="text-emerald-600 mb-1 flex justify-center"><Star size={20} fill="currentColor" /></div><div className="font-bold text-gray-900 text-lg">{user.rating}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t.rating}</div></div>
                            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center"><div className="text-purple-600 mb-1 flex justify-center"><Award size={20} /></div><div className="font-bold text-gray-900 text-lg">{user.experience || 'N/A'}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t.experience}</div></div>
                            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center"><div className="text-blue-600 mb-1 flex justify-center"><CheckCircle2 size={20} /></div><div className="font-bold text-gray-900 text-lg">{user.jobsCompleted || 0}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t.jobsDone}</div></div>
                            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center"><div className="text-orange-600 mb-1 flex justify-center"><Briefcase size={20} /></div><div className="font-bold text-gray-900 text-lg">{postedJobsCount}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t.jobsPosted}</div></div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"><h3 className="font-bold text-gray-900 mb-3">{t.aboutMe}</h3><p className="text-gray-600 text-sm">{user.bio || "No bio added yet."}</p></div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 mb-3">{t.skills}</h3>
                            <div className="flex flex-wrap gap-2">
                                {user.skills?.map((s, i) => (
                                    <span key={i} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-100">{s}</span>
                                ))}
                                {(!user.skills || user.skills.length === 0) && <span className="text-gray-400 text-sm italic">No skills added.</span>}
                            </div>
                        </div>

                        {/* Reviews Section */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-900">{t.reviews || "Reviews"} ({user.reviews?.length || 0})</h3>
                            {user.reviews && user.reviews.length > 0 ? (
                                user.reviews.map(review => (
                                    <div key={review.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-sm text-gray-800">{review.reviewerName}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(review.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1 mb-2">
                                            {[1,2,3,4,5].map(star => (
                                                <Star key={star} size={12} fill={star <= review.rating ? "orange" : "transparent"} className={star <= review.rating ? "text-orange-400" : "text-gray-300"} />
                                            ))}
                                        </div>
                                        {review.tags && review.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {review.tags.map((tag, i) => (
                                                    <span key={i} className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded border border-gray-200">
                                                        {REVIEW_TAGS_TRANSLATIONS[tag]?.[language === 'hi' ? 'hi' : 'en'] || tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 italic">"{review.comment}"</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 italic">No reviews yet.</p>
                            )}
                        </div>

                        {!user.isPremium && <button onClick={() => setShowSubscriptionModal(true)} className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"><Crown size={18} fill="currentColor" /> {t.upgradePremium}</button>}
                        <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-100"><LogOut size={18} /> {t.signOut}</button>
                    </div>
                </div>
            )}
        </main>

        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-emerald-100 flex justify-around py-3 pb-5 z-40">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-emerald-700' : 'text-gray-400'}`}><LayoutGrid size={24} /><span className="text-xs font-medium">{t.navHome}</span></button>
            <button onClick={() => { if (role === UserRole.WORKER) setRole(UserRole.POSTER); setActiveTab('post'); }} className={`flex flex-col items-center gap-1 ${activeTab === 'post' ? 'text-emerald-700' : 'text-gray-400'}`}><div className={`rounded-full p-2 -mt-6 shadow-lg border-4 border-green-50 text-white transition-all ${activeTab === 'post' ? 'bg-emerald-700 scale-110' : 'bg-emerald-600'}`}><Plus size={24} /></div><span className="text-xs font-medium">{t.navPost}</span></button>
            <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center gap-1 ${activeTab === 'wallet' ? 'text-emerald-700' : 'text-gray-400'}`}><Wallet size={24} /><span className="text-xs font-medium">{t.navWallet}</span></button>
            <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-emerald-700' : 'text-gray-400'}`}><UserCircle size={24} /><span className="text-xs font-medium">{t.navProfile}</span></button>
        </nav>

        {/* Global Modals */}
        {showSubscriptionModal && (
            <div className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-pop relative">
                    <button onClick={() => setShowSubscriptionModal(false)} className="absolute top-3 right-3 bg-black/10 p-1.5 rounded-full hover:bg-black/20 transition-colors z-20"><X size={20}/></button>
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <h2 className="text-xl font-bold mb-1">{t.upgradePremium}</h2><p className="text-sm text-gray-300">{t.premiumDesc}</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <button onClick={() => { setShowSubscriptionModal(false); addNotification(user.id, t.notifPremiumActivated, t.notifPremiumActivatedBody, "SUCCESS"); }} className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group">{t.subscribeBtn} <ArrowUpRight size={20}/></button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Chat Interface */}
        {chatOpen.isOpen && chatOpen.job && (
            <ChatInterface 
                job={chatOpen.job} 
                currentUser={user} 
                onClose={() => setChatOpen({ isOpen: false, job: null })}
                messages={messages.filter(m => m.jobId === chatOpen.job!.id)}
                onSendMessage={async (text) => {
                    const msg: ChatMessage = { id: `m${Date.now()}`, jobId: chatOpen.job!.id, senderId: user.id, text, timestamp: Date.now() };

                    try {
                      await supabase.from('chat_messages').insert({
                        id: msg.id,
                        job_id: msg.jobId,
                        sender_id: msg.senderId,
                        text: msg.text
                      });

                      setMessages(prev => [...prev, msg]);

                      setTimeout(async () => {
                        const autoReply: ChatMessage = { id: `r${Date.now()}`, jobId: chatOpen.job!.id, senderId: 'other', text: 'Got it, thanks!', timestamp: Date.now() };

                        try {
                          await supabase.from('chat_messages').insert({
                            id: autoReply.id,
                            job_id: autoReply.jobId,
                            sender_id: autoReply.senderId,
                            text: autoReply.text
                          });
                          setMessages(prev => [...prev, autoReply]);
                        } catch (error) {
                          console.error('Error saving auto reply:', error);
                        }
                      }, 1500);
                    } catch (error) {
                      console.error('Error saving message:', error);
                      showAlert('Failed to send message. Please try again.', 'error');
                    }
                }}
                onCompleteJob={async () => {
                    if (!chatOpen.job) return;
                    try {
                      await updateJob({ ...chatOpen.job, status: JobStatus.COMPLETED });
                      setChatOpen({ isOpen: false, job: null });
                      showAlert(t.jobCompletedAlert, 'success');
                    } catch (error) {
                      console.error('Error completing job:', error);
                      showAlert('Failed to complete job. Please try again.', 'error');
                    }
                }}
                onTranslateMessage={handleTranslateChat}
            />
        )}
        
        {/* Other Modals can be similarly refactored, for brevity leaving some inline or placeholders */}
        {bidModalOpen.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-pop">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{t.placeBid}</h3><button onClick={() => setBidModalOpen({isOpen:false, jobId: null})}><X size={20}/></button></div>
                    <input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="number" className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3 mb-4 text-lg font-bold placeholder-gray-400 outline-none" placeholder={t.yourOffer} value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-500 ml-1">{t.msgToEmployer}</span>
                        <button onClick={handleEnhanceBid} className="text-[10px] flex items-center gap-1 font-bold px-2 py-1 rounded-lg border bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200">
                             {isEnhancingBid ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} {t.aiEnhance}
                        </button>
                    </div>
                    <textarea style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3 mb-4 h-24 placeholder-gray-400 outline-none" placeholder="I can do this job..." value={bidMessage} onChange={e => setBidMessage(e.target.value)} />
                    <button onClick={handlePlaceBid} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.sendBid}</button>
                </div>
            </div>
        )}
        
        {/* View Bids Modal */}
        {viewBidsModal.isOpen && viewBidsModal.job && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
                <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md h-[80vh] flex flex-col animate-slide-up">
                    <div className="p-4 border-b flex justify-between"><h2 className="font-bold">{t.reviewBids}</h2><button onClick={() => setViewBidsModal({isOpen: false, job: null})}><X size={20}/></button></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {viewBidsModal.job.bids.filter(b => b.status === 'PENDING').map(bid => {
                            const lastAction = bid.negotiationHistory?.[bid.negotiationHistory.length - 1];
                            const isWaitingForWorker = lastAction?.by === UserRole.POSTER;
                            
                            return (
                                <div key={bid.id} className="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden">
                                    {isWaitingForWorker && <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg border-l border-b border-amber-200">{t.waitingForResponse}</div>}
                                    <div className="flex justify-between items-start mb-2"><h4 className="font-bold">{bid.workerName}</h4><span className="text-xl font-bold text-emerald-700">₹{bid.amount}</span></div>
                                    <div className="flex items-center text-xs text-gray-500 mb-3"><Star size={12} className="text-orange-400 fill-orange-400 mr-1"/> {bid.workerRating} • {bid.workerLocation}</div>
                                    <p className="text-sm bg-gray-50 p-2 rounded mb-3 italic">"{bid.message}"</p>
                                    
                                    {isWaitingForWorker ? (
                                        <div className="text-center text-xs text-gray-400 font-medium py-2 border-t border-dashed">
                                            {t.youCountered} ₹{bid.amount}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={async () => {
                                                const updatedJob = jobs.find(j => j.id === viewBidsModal.job!.id);
                                                if (updatedJob) {
                                                    try {
                                                      const updatedBids = updatedJob.bids.map(b => b.id === bid.id ? { ...b, status: 'REJECTED' as const } : b);
                                                      await updateJob({ ...updatedJob, bids: updatedBids });
                                                      setViewBidsModal({ ...viewBidsModal, job: { ...updatedJob, bids: updatedBids } });
                                                      await addNotification(bid.workerId, t.notifBidRejected, t.notifBidRejectedBody, "WARNING", updatedJob.id);
                                                    } catch (error) {
                                                      console.error('Error rejecting bid:', error);
                                                      showAlert('Failed to reject bid. Please try again.', 'error');
                                                    }
                                                }
                                            }} className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg font-bold text-sm">{t.rejectBid}</button>
                                            <button onClick={() => setCounterModalOpen({ isOpen: true, bidId: bid.id, jobId: viewBidsModal.job!.id })} className="flex-1 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-sm">{t.counterOffer}</button>
                                            <button onClick={() => handleAcceptBid(viewBidsModal.job!.id, bid.id, bid.amount, bid.workerId)} className="flex-[1.5] py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm">{t.acceptFor} {bid.amount}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
        
        {/* Counter Offer Modal */}
        {counterModalOpen.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-pop">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{t.counterOffer}</h3><button onClick={() => setCounterModalOpen({isOpen:false, bidId:null, jobId:null})}><X size={20}/></button></div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t.counterAmount}</label>
                    <input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="number" autoFocus className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3 mb-6 text-lg font-bold placeholder-gray-400 outline-none" placeholder="₹" value={counterInputAmount} onChange={e => setCounterInputAmount(e.target.value)} />
                    <button onClick={handleCounterByPoster} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.sendCounter}</button>
                </div>
            </div>
        )}

        {/* Edit Job Modal */}
        {editingJob && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
                <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md h-[85vh] flex flex-col p-5 overflow-y-auto animate-slide-up">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{t.editJob}</h2>
                        <button onClick={() => setEditingJob(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
                     </div>
                     
                     <div className="space-y-4 flex-1">
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.jobTitleLabel}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400"/></div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.categoryLabel}</label>
                            <div className="relative">
                                <select style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none appearance-none font-medium" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_TRANSLATIONS[c]?.[language] || c}</option>)}</select>
                                <ArrowDownWideNarrow size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.descLabel}</label><textarea style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 h-32 outline-none resize-none font-medium placeholder-gray-400"/></div>
                        <div className="flex gap-4">
                            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">{t.startDate}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400"/></div>
                            <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">{t.duration}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editDuration} onChange={e=>setEditDuration(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400"/></div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.budget} (₹)</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="number" value={editBudget} onChange={e=>setEditBudget(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-bold placeholder-gray-400"/></div>
                     </div>
                     
                     <button onClick={handleUpdateJob} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-4 hover:bg-emerald-700 active:scale-95 transition-all">{t.saveChanges}</button>
                </div>
            </div>
        )}

        {/* 1. Job Details Modal */}
        {selectedJob && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
                <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
                    <div className={`h-40 bg-gradient-to-br from-emerald-500 to-teal-700 relative p-6 flex flex-col justify-end overflow-hidden`}>
                        {selectedJob.image && (
                            <>
                                <img src={selectedJob.image} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            </>
                        )}
                        <button onClick={() => setSelectedJob(null)} className="absolute top-4 right-4 bg-black/20 text-white p-2 rounded-full z-10 hover:bg-black/40 transition-colors"><X size={20} /></button>
                        <div className="absolute top-4 right-14 flex gap-2 z-10">
                             <button onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(`${selectedJob.title} - ${selectedJob.description}`);
                                    showAlert("Copied to clipboard!", "success");
                                } catch(e) {}
                             }} className="bg-black/20 text-white p-2 rounded-full hover:bg-black/40 transition-colors"><Share2 size={20} /></button>
                             {selectedJob.posterId === user.id && selectedJob.status === JobStatus.OPEN && <button onClick={(e) => handleDeleteJob(e, selectedJob.id)} className="bg-black/20 text-white p-2 rounded-full hover:bg-red-500 transition-colors"><Trash2 size={20} /></button>}
                             {selectedJob.posterId === user.id && selectedJob.status === JobStatus.OPEN && selectedJob.bids.length === 0 && (
                                <button onClick={() => handleEditJobInit(selectedJob)} className="bg-black/20 text-white p-2 rounded-full hover:bg-black/40 transition-colors"><Pencil size={20} /></button>
                             )}
                        </div>
                        <h2 className="text-2xl font-bold text-white relative z-10 drop-shadow-sm">{selectedJob.title}</h2>
                        <span className="text-white/90 text-xs flex items-center gap-1 relative z-10">
                            {t.postedBy} {selectedJob.posterName} 
                            {selectedJob.posterId === user.id && <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px] font-bold ml-1">YOU</span>}
                        </span>
                    </div>
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50 p-4 rounded-xl text-center"><IndianRupee size={24} className="text-emerald-600 mx-auto mb-1"/><span className="text-xl font-bold">₹{selectedJob.budget}</span></div>
                            <div className="bg-blue-50 p-4 rounded-xl text-center"><Hourglass size={24} className="text-blue-600 mx-auto mb-1"/><span className="text-lg font-bold">{selectedJob.duration}</span></div>
                        </div>
                        <div><h3 className="font-bold mb-2">{t.jobDescription}</h3><p className="text-gray-600">{selectedJob.description}</p></div>
                        <div className="bg-gray-100 h-48 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-inner border border-gray-200">
                             {selectedJob.coordinates ? (
                                 <LeafletMap lat={selectedJob.coordinates.lat} lng={selectedJob.coordinates.lng} popupText={selectedJob.location} />
                             ) : (
                                 <div className="flex flex-col items-center justify-center text-gray-400">
                                     <MapPin size={32} className="mb-2 opacity-50"/>
                                     <span className="text-xs">Map not available</span>
                                 </div>
                             )}
                        </div>
                        <div className="flex items-center justify-between">
                             <div className="flex flex-col">
                                 <span className="font-bold text-gray-700">{selectedJob.location}</span>
                             </div>
                             {selectedJob.coordinates && (
                                 <div className="flex gap-2">
                                     <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.coordinates!.lat},${selectedJob.coordinates!.lng}`, '_blank')} className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm flex items-center gap-1 hover:bg-emerald-700">
                                         <Navigation size={14}/> Directions
                                     </button>
                                 </div>
                             )}
                        </div>
                    </div>
                    <div className="p-4 border-t bg-white">
                        {role === UserRole.WORKER && selectedJob.posterId !== user.id ? (
                            !selectedJob.bids.find(b => b.workerId === user.id) && selectedJob.status === JobStatus.OPEN ? 
                            <button onClick={() => setBidModalOpen({ isOpen: true, jobId: selectedJob.id })} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.bidNow}</button> : 
                            <div className="text-center font-bold text-emerald-600">{t.pending}</div>
                        ) : (
                            selectedJob.posterId === user.id && selectedJob.status === JobStatus.OPEN ? 
                            <button onClick={() => setViewBidsModal({ isOpen: true, job: selectedJob })} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.viewBids} ({selectedJob.bids.length})</button> :
                            ((selectedJob.status === 'IN_PROGRESS' || selectedJob.status === 'COMPLETED') && (selectedJob.posterId === user.id || selectedJob.acceptedBidId === selectedJob.bids.find(b => b.workerId === user.id)?.id)) ?
                            <button onClick={() => handleChatOpen(selectedJob)} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><MessageCircle size={20}/> {t.chat}</button> : null
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <UserProvider>
      <JobProvider>
        <AppContent />
      </JobProvider>
    </UserProvider>
  );
};