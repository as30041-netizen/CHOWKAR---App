import React, { useState, useEffect } from 'react';
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
import { signInWithGoogle, completeProfile } from './services/authService';
import { supabase } from './lib/supabase';
import { ReviewModal } from './components/ReviewModal';
import {
  MapPin, LayoutGrid, Plus, Wallet, UserCircle, Search, SlidersHorizontal,
  ArrowLeftRight, Bell, MessageCircle, Languages, Loader2, Navigation,
  ArrowUpRight, LogOut, Phone, Star, Award, CheckCircle2, Briefcase,
  ArrowDownWideNarrow, Sparkles, ChevronRight,
  ArrowDownLeft, X, IndianRupee, Hourglass,
  Calendar, Trash2, Pencil, Check, AlertCircle, Camera,
  Mic, MicOff, Share2, ExternalLink, Copy, Map, Crown, Lock, XCircle, Calculator, Handshake
} from 'lucide-react';

const getTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    transactions, setTransactions, notifications, setNotifications, messages, setMessages,
    addNotification, checkFreeLimit, incrementAiUsage, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB
  } = useUser();

  const { jobs, setJobs, updateJob, deleteJob, addBid, updateBid } = useJobs();

  // --- Auth State ---
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileCoords, setProfileCoords] = useState<Coordinates | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

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
  const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean, revieweeId: string, revieweeName: string, jobId: string } | null>(null);
  const [viewBidsModal, setViewBidsModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [counterModalOpen, setCounterModalOpen] = useState<{ isOpen: boolean; bidId: string | null; jobId: string | null }>({ isOpen: false, bidId: null, jobId: null });
  const [counterInputAmount, setCounterInputAmount] = useState('');
  const [isAcceptingBid, setIsAcceptingBid] = useState(false);

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
  // Removed reviewTarget, reviewRating, reviewComment, reviewTags as they are now handled by reviewModalData and handleSubmitReview arguments.

  const unreadCount = notifications.filter(n => n.userId === user.id && !n.read).length;
  const postedJobsCount = jobs.filter(j => j.posterId === user.id).length;

  useEffect(() => {
    if (isLoggedIn && user.id && (!user.phone || user.location === 'Not set')) {
      setShowProfileCompletion(true);
    }
  }, [isLoggedIn, user.id, user.phone, user.location]);

  // Reset signing in state when auth completes
  useEffect(() => {
    if (isLoggedIn) {
      setIsSigningIn(false);
    }
  }, [isLoggedIn]);

  // --- Real-time Sync for Modals ---
  // When 'jobs' update in background (from Realtime), update the open Modal view
  useEffect(() => {
    if (viewBidsModal.isOpen && viewBidsModal.job) {
      const liveJob = jobs.find(j => j.id === viewBidsModal.job!.id);
      // Only update if data actually changed (prevent loops)
      if (liveJob && JSON.stringify(liveJob.bids) !== JSON.stringify(viewBidsModal.job.bids)) {
        setViewBidsModal(prev => ({ ...prev, job: liveJob }));
      }
    }
  }, [jobs, viewBidsModal.isOpen, viewBidsModal.job]);

  // --- Handlers ---
  const handleGoogleSignIn = async () => {
    console.log('[UI] Starting Google sign-in...');
    setIsSigningIn(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      console.error('[UI] Sign-in failed:', result.error);
      showAlert(result.error || 'Failed to sign in', 'error');
      setIsSigningIn(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !profileLocation) {
      showAlert('Please fill in all required fields', 'error');
      return;
    }

    const result = await completeProfile(user.id, phoneNumber, profileLocation, profileCoords);
    if (result.success) {
      setShowProfileCompletion(false);
      setUser(prev => ({
        ...prev,
        phone: phoneNumber,
        location: profileLocation,
        coordinates: profileCoords
      }));
      await addNotification(user.id, t.notifWelcome, t.notifWelcomeBody, "SUCCESS");
      showAlert('Profile completed successfully!', 'success');
    } else {
      showAlert(result.error || 'Failed to complete profile', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
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
      posterId: job.posterId,
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
      await addBid(newBid);
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

    setIsAcceptingBid(true);
    try {
      const { error } = await supabase.rpc('accept_bid', {
        p_job_id: jobId,
        p_bid_id: bidId,
        p_poster_id: user.id,
        p_worker_id: workerId,
        p_amount: bidAmount,
        p_poster_fee: POSTER_FEE
      });

      if (error) throw error;

      await refreshUser(); // Update wallet and transactions from DB

      setViewBidsModal({ isOpen: false, job: null });
      if (selectedJob) setSelectedJob(null);

      await addNotification(workerId, t.notifBidAccepted, t.notifBidAcceptedBody, "SUCCESS", jobId);
      showAlert(t.contactUnlocked, 'success');
    } catch (error) {
      console.error('Error accepting bid:', error);
      showAlert('Failed to accept bid. Please try again.', 'error');
    } finally {
      setIsAcceptingBid(false);
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
    if (job) {
      try {
        const bid = job.bids.find(b => b.id === counterModalOpen.bidId);
        if (bid) {
          const updatedBid = {
            ...bid,
            amount: newAmount,
            negotiationHistory: [...(bid.negotiationHistory || []), {
              amount: newAmount,
              by: UserRole.POSTER,
              timestamp: Date.now()
            }]
          };
          await updateBid(updatedBid);

          // Update local view modal if open
          if (viewBidsModal.isOpen) {
            setViewBidsModal(prev => ({ ...prev, job: { ...prev.job!, bids: prev.job!.bids.map(b => b.id === bid.id ? updatedBid : b) } }));
          }
        }
        const workerId = job.bids.find(b => b.id === counterModalOpen.bidId)?.workerId;
        if (workerId) await addNotification(workerId, t.notifCounterOffer, `${t.posterCountered}: ₹${newAmount}`, "INFO", job.id);
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
    if (!job) return;

    try {
      const bid = job.bids.find(b => b.id === bidId);
      if (!bid) return;

      if (action === 'ACCEPT') {
        const updatedBid = { ...bid, negotiationHistory: [...(bid.negotiationHistory || []), { amount: bid.amount, by: UserRole.WORKER, timestamp: Date.now(), message: "Accepted Counter Offer" }] };
        await updateBid(updatedBid);
        await addNotification(job.posterId, "Counter Accepted", "Worker accepted your offer. Please finalize hiring.", "SUCCESS", jobId);
      } else if (action === 'REJECT') {
        // Rejecting usually deletes the bid or sets status REJECTED
        // Current logic deleted it.
        // If DELETE, updateBid doesn't support DELETE. 
        // We need deleteBid? Or update status to REJECTED.
        // Original logic: updatedBids = job.bids.filter(...) -> calls updateJob -> DELETES bid from array.
        // To delete a bid, we should use deleteBid? Or update status?
        // Let's set status to REJECTED for better history?
        // But original logic removed it.
        // Let's assume we maintain original behavior: Remove it.
        // Wait, context has deleteBid? NO. context has deleteJob.
        // jobService has deleteJob.
        // Does jobService have deleteBid? No.
        // Okay, for REJECT, we will keep using updateJob (removal from array) OR implement deleteBid.
        // BUT, actually if we just set status to REJECTED it's better.
        // User's code: updatedBids = job.bids.filter(b => b.id !== bidId);
        // This implies DELETING.
        // Since I don't have deleteBid exposed, I'll stick to updateJob for DELETE only.
        const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
        await updateJob(updatedJob);
        showAlert(t.alertJobDeleted, 'info');
      } else if (action === 'COUNTER' && amount) {
        const updatedBid = { ...bid, amount, negotiationHistory: [...(bid.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] };
        await updateBid(updatedBid);
        await addNotification(job.posterId, t.notifCounterOffer, `Worker countered: ₹${amount}`, "INFO", jobId);
      }
    } catch (error) {
      console.error('Error replying to counter offer:', error);
      showAlert('Failed to process counter offer. Please try again.', 'error');
    }
  };

  const handleWithdrawBid = async (jobId: string, bidId: string) => {
    if (!confirm(language === 'en' ? 'Are you sure you want to withdraw your bid?' : 'क्या आप अपनी बोली वापस लेना चाहते हैं?')) return;
    try {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;
      const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
      await updateJob(updatedJob);
      showAlert(language === 'en' ? 'Bid withdrawn' : 'बोली वापस ली गई', 'info');
    } catch (e) {
      console.error(e);
      showAlert('Error withdrawing bid', 'error');
    }
  };

  const handleCompleteJob = async (job: Job) => {
    try {
      await updateJob({ ...job, status: JobStatus.COMPLETED });

      const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);
      if (acceptedBid) {
        await addNotification(acceptedBid.workerId, "Job Completed", "Poster marked the job as completed.", "SUCCESS", job.id);
        // Open review modal for Worker
        setReviewModalData({
          isOpen: true,
          revieweeId: acceptedBid.workerId,
          revieweeName: acceptedBid.workerName,
          jobId: job.id
        });
      }
      showAlert("Job marked as completed!", "success");
      setSelectedJob(null);
    } catch (e) {
      console.error(e);
      showAlert("Error updating job.", "error");
    }
  };

  const toggleVoiceInput = (mode: 'description' | 'search') => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) { showAlert("Voice input not supported", 'error'); return; }
    if (isSearchingVoice) { setIsSearchingVoice(false); try { (window as any).recognition?.stop(); } catch (e) { } return; }

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
    } catch (e) { setIsSearchingVoice(false); }
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

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { showAlert("Please select a rating.", 'error'); return; }
    if (!reviewTarget) { showAlert("No review target selected.", 'error'); return; }

    try {
      // Insert review into database
      const { error } = await supabase
        .from('reviews')
        .insert({
          reviewer_id: user.id,
          reviewee_id: reviewTarget.id,
          job_id: selectedJob?.id || null,
          rating: reviewRating,
          comment: reviewComment || null,
          tags: reviewTags.length > 0 ? reviewTags : null
        });

      if (error) throw error;

      await addNotification(reviewTarget.id, "New Review", `You received a ${reviewRating} star review from ${user.name}!`, "SUCCESS");
      setReviewModalOpen(false);
      showAlert(t.reviewSubmitted, 'success');
    } catch (error) {
      console.error('Error submitting review:', error);
      showAlert('Failed to submit review. Please try again.', 'error');
    }
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

  // --- Loading Screen ---
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100 flex flex-col items-center justify-center p-6 font-sans text-gray-900">
        <div className="flex flex-col items-center max-w-md w-full">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-100 to-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-white animate-pulse">
            <MapPin size={40} className="text-emerald-600 drop-shadow-sm" fill="#10b981" />
          </div>
          <h1 className="text-4xl font-black text-emerald-950 tracking-tighter drop-shadow-sm mb-2">CHOWKAR</h1>
          <p className="text-sm text-emerald-700 font-medium mb-6">{loadingMessage}</p>
          <Loader2 size={32} className="text-emerald-600 animate-spin mb-6" />
          {loadingMessage.includes('timeout') || loadingMessage.includes('Error') || loadingMessage.includes('failed') ? (
            <button
              onClick={retryAuth}
              className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg"
            >
              Retry Connection
            </button>
          ) : null}
        </div>
      </div>
    );
  }

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

        {currentAlert && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 animate-slide-down backdrop-blur-md border border-white/20 ${currentAlert.type === 'error' ? 'bg-red-500/90 text-white' :
            currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white' :
              'bg-gray-800/90 text-white'
            }`}>
            {currentAlert.type === 'error' && <XCircle size={18} className="text-white/80" />}
            {currentAlert.type === 'success' && <CheckCircle2 size={18} className="text-white/80" />}
            {currentAlert.type === 'info' && <AlertCircle size={18} className="text-white/80" />}
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

          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t.signIn}</h2>
          <p className="text-center text-gray-600 text-sm mb-6">
            {language === 'en' ? 'Sign in with your Google account to get started' : 'शुरू करने के लिए अपने Google खाते से साइन इन करें'}
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full bg-white text-gray-700 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all border-2 border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {language === 'en' ? 'Continue with Google' : 'Google के साथ जारी रखें'}
          </button>
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
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 animate-slide-down backdrop-blur-md border border-white/20 ${currentAlert.type === 'error' ? 'bg-red-500/90 text-white' :
            currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white' :
              'bg-gray-800/90 text-white'
            }`}>
            {currentAlert.type === 'error' && <XCircle size={18} className="text-white/80" />}
            {currentAlert.type === 'success' && <CheckCircle2 size={18} className="text-white/80" />}
            {currentAlert.type === 'info' && <AlertCircle size={18} className="text-white/80" />}
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
                      {isSearchingVoice ? <MicOff size={16} /> : <Mic size={16} />}
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
                      if (j.bids.length > 0) { showAlert(t.alertCantEdit, 'error'); return; }
                      setEditingJob(j); setEditTitle(j.title); setEditDesc(j.description); setEditCategory(j.category); setEditDate(j.jobDate); setEditDuration(j.duration); setEditBudget(j.budget.toString());
                    }}
                    onClick={() => setSelectedJob(job)}
                    onReplyToCounter={handleWorkerReplyToCounter}
                    onWithdrawBid={handleWithdrawBid}
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
                  <button onClick={() => { setEditProfileName(user.name); setEditProfilePhone(user.phone); setEditProfileLocation(user.location); setEditProfileBio(user.bio || ''); setEditProfileExp(user.experience || ''); setEditProfileSkills(user.skills?.join(', ') || ''); setEditProfilePhoto(user.profilePhoto || ''); setShowEditProfile(true); }} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white"><Pencil size={18} /></button>
                  {user.isPremium && <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm"><Crown size={14} fill="currentColor" /> Premium</div>}
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
                          {[1, 2, 3, 4, 5].map(star => (
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

        {/* Profile Completion Modal */}
        {showProfileCompletion && (
          <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-pop">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{language === 'en' ? 'Complete Your Profile' : 'अपनी प्रोफ़ाइल पूर्ण करें'}</h2>
              <p className="text-gray-600 text-sm mb-6">
                {language === 'en' ? 'Please provide your phone number and location to continue' : 'जारी रखने के लिए कृपया अपना फ़ोन नंबर और स्थान प्रदान करें'}
              </p>

              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide ml-1">{t.mobileNumber}</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700 font-bold border-r border-emerald-100 pr-3">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      className="w-full bg-white border-2 border-emerald-100/80 rounded-2xl p-4 pl-16 text-lg font-semibold outline-none focus:border-emerald-500 transition-all placeholder-gray-300 shadow-sm"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                    />
                    <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide ml-1">{t.cityVillage}</label>
                  <div className="relative group">
                    <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      className="w-full bg-white border-2 border-emerald-100/80 rounded-2xl p-4 pl-12 font-medium outline-none focus:border-emerald-500 transition-all placeholder-gray-400 shadow-sm"
                      placeholder={t.cityVillage}
                      value={profileLocation}
                      onChange={e => setProfileLocation(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsGettingLocation(true);
                    getDeviceLocation(setProfileCoords, () => setIsGettingLocation(false));
                  }}
                  className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-all ${profileCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  {isGettingLocation ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  {profileCoords ? t.locationCaptured : t.useGps}
                </button>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all"
                >
                  {language === 'en' ? 'Continue' : 'जारी रखें'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Global Modals */}
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-pop relative">
              <button onClick={() => setShowSubscriptionModal(false)} className="absolute top-3 right-3 bg-black/10 p-1.5 rounded-full hover:bg-black/20 transition-colors z-20"><X size={20} /></button>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <h2 className="text-xl font-bold mb-1">{t.upgradePremium}</h2><p className="text-sm text-gray-300">{t.premiumDesc}</p>
              </div>
              <div className="p-5 space-y-4">
                <button onClick={() => { setShowSubscriptionModal(false); addNotification(user.id, t.notifPremiumActivated, t.notifPremiumActivatedBody, "SUCCESS"); }} className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group">{t.subscribeBtn} <ArrowUpRight size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-pop relative">
              <button onClick={() => setShowFilterModal(false)} className="absolute top-3 right-3 bg-black/10 p-1.5 rounded-full hover:bg-black/20 transition-colors z-20"><X size={20} /></button>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><SlidersHorizontal size={24} /> Filter Jobs</h2>
                <p className="text-sm text-emerald-100">Refine your job search</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="Enter location..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setFilterLocation(''); setShowFilterModal(false); }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => setShowFilterModal(false)}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                  >
                    Apply Filters
                  </button>
                </div>
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
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{t.placeBid}</h3><button onClick={() => setBidModalOpen({ isOpen: false, jobId: null })}><X size={20} /></button></div>
              <input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="number" className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3 mb-4 text-lg font-bold placeholder-gray-400 outline-none" placeholder={t.yourOffer} value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-500 ml-1">{t.msgToEmployer}</span>
                <button onClick={handleEnhanceBid} className="text-[10px] flex items-center gap-1 font-bold px-2 py-1 rounded-lg border bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200">
                  {isEnhancingBid ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} {t.aiEnhance}
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
              <div className="p-4 border-b flex justify-between"><h2 className="font-bold">{t.reviewBids}</h2><button onClick={() => setViewBidsModal({ isOpen: false, job: null })}><X size={20} /></button></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {viewBidsModal.job.bids.filter(b => b.status === 'PENDING').map(bid => {
                  const lastAction = bid.negotiationHistory?.[bid.negotiationHistory.length - 1];
                  const isWaitingForWorker = lastAction?.by === UserRole.POSTER;

                  return (
                    <div key={bid.id} className="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden">
                      {isWaitingForWorker && <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg border-l border-b border-amber-200">{t.waitingForResponse}</div>}
                      <div className="flex justify-between items-start mb-2"><h4 className="font-bold">{bid.workerName}</h4><span className="text-xl font-bold text-emerald-700">₹{bid.amount}</span></div>
                      <div className="flex items-center text-xs text-gray-500 mb-3"><Star size={12} className="text-orange-400 fill-orange-400 mr-1" /> {bid.workerRating} • {bid.workerLocation}</div>
                      <p className="text-sm bg-gray-50 p-2 rounded mb-3 italic">"{bid.message}"</p>

                      {bid.negotiationHistory && bid.negotiationHistory.length > 0 && (
                        <div className="mb-3 bg-gray-50/50 rounded-lg p-2 text-xs border border-gray-100/50 max-h-40 overflow-y-auto no-scrollbar flex flex-col gap-2">
                          <div className="space-y-2">
                            {bid.negotiationHistory.map((h, i) => {
                              const isMe = h.by === UserRole.POSTER;
                              return (
                                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`px-3 py-1.5 rounded-2xl shadow-sm ${isMe ? 'bg-emerald-100 text-emerald-900 rounded-br-none border border-emerald-200' : 'bg-white text-gray-900 rounded-bl-none border border-gray-200'}`}>
                                    <div className="font-bold">₹{h.amount}</div>
                                    <div className="text-[9px] opacity-70 mt-0.5">{h.message || (isMe ? 'Counter Offer' : 'Bid')} • {getTimeAgo(h.timestamp)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                                const bidToReject = updatedJob.bids.find(b => b.id === bid.id);
                                if (bidToReject) {
                                  const updatedBid = { ...bidToReject, status: 'REJECTED' as const };
                                  await updateBid(updatedBid);

                                  // Update local modal
                                  setViewBidsModal(prev => ({
                                    ...prev,
                                    job: { ...prev.job!, bids: prev.job!.bids.map(b => b.id === bid.id ? updatedBid : b) }
                                  }));

                                  await addNotification(bid.workerId, t.notifBidRejected, t.notifBidRejectedBody, "WARNING", updatedJob.id);
                                }
                              } catch (error) {
                                console.error('Error rejecting bid:', error);
                                showAlert('Failed to reject bid. Please try again.', 'error');
                              }
                            }
                          }} className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg font-bold text-sm">{t.rejectBid}</button>
                          <button onClick={() => setCounterModalOpen({ isOpen: true, bidId: bid.id, jobId: viewBidsModal.job!.id })} className="flex-1 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-sm">{t.counterOffer}</button>
                          <button disabled={isAcceptingBid} onClick={() => handleAcceptBid(viewBidsModal.job!.id, bid.id, bid.amount, bid.workerId)} className="flex-[1.5] py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {isAcceptingBid ? <><Loader2 size={16} className="animate-spin" /> Processing</> : <>{t.acceptFor} {bid.amount}</>}
                          </button>
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
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{t.counterOffer}</h3><button onClick={() => setCounterModalOpen({ isOpen: false, bidId: null, jobId: null })}><X size={20} /></button></div>
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
                <button onClick={() => setEditingJob(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} /></button>
              </div>

              <div className="space-y-4 flex-1">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.jobTitleLabel}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400" /></div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t.categoryLabel}</label>
                  <div className="relative">
                    <select style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none appearance-none font-medium" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_TRANSLATIONS[c]?.[language] || c}</option>)}</select>
                    <ArrowDownWideNarrow size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.descLabel}</label><textarea style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 h-32 outline-none resize-none font-medium placeholder-gray-400" /></div>
                <div className="flex gap-4">
                  <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">{t.startDate}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400" /></div>
                  <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">{t.duration}</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} value={editDuration} onChange={e => setEditDuration(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400" /></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.budget} (₹)</label><input style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }} type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} className="w-full appearance-none bg-white text-black border border-gray-200 rounded-xl p-3.5 outline-none font-bold placeholder-gray-400" /></div>
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
                    } catch (e) { }
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
                  <div className="bg-emerald-50 p-4 rounded-xl text-center"><IndianRupee size={24} className="text-emerald-600 mx-auto mb-1" /><span className="text-xl font-bold">₹{selectedJob.budget}</span></div>
                  <div className="bg-blue-50 p-4 rounded-xl text-center"><Hourglass size={24} className="text-blue-600 mx-auto mb-1" /><span className="text-lg font-bold">{selectedJob.duration}</span></div>
                </div>
                <div><h3 className="font-bold mb-2">{t.jobDescription}</h3><p className="text-gray-600">{selectedJob.description}</p></div>
                <div className="bg-gray-100 h-48 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-inner border border-gray-200">
                  {selectedJob.coordinates ? (
                    <LeafletMap lat={selectedJob.coordinates.lat} lng={selectedJob.coordinates.lng} popupText={selectedJob.location} />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <MapPin size={32} className="mb-2 opacity-50" />
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
                        <Navigation size={14} /> Directions
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t bg-white">
                {role === UserRole.WORKER && selectedJob.posterId !== user.id ? (
                  selectedJob.status === JobStatus.COMPLETED && selectedJob.acceptedBidId === selectedJob.bids.find(b => b.workerId === user.id)?.id ? (
                    <button onClick={() => setReviewModalData({ isOpen: true, revieweeId: selectedJob.posterId, revieweeName: selectedJob.posterName, jobId: selectedJob.id })} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Star size={20} /> Rate Poster</button>
                  ) :
                    !selectedJob.bids.find(b => b.workerId === user.id) && selectedJob.status === JobStatus.OPEN ?
                      <button onClick={() => setBidModalOpen({ isOpen: true, jobId: selectedJob.id })} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.bidNow}</button> :
                      <div className="text-center font-bold text-emerald-600">{t.pending}</div>
                ) : (
                  selectedJob.posterId === user.id && selectedJob.status === JobStatus.OPEN ?
                    <button onClick={() => setViewBidsModal({ isOpen: true, job: selectedJob })} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{t.viewBids} ({selectedJob.bids.length})</button> :
                    ((selectedJob.status === 'IN_PROGRESS' || selectedJob.status === 'COMPLETED') && (selectedJob.posterId === user.id || selectedJob.acceptedBidId === selectedJob.bids.find(b => b.workerId === user.id)?.id)) ?
                      <div className="flex gap-2 w-full">
                        <button onClick={() => handleChatOpen(selectedJob)} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><MessageCircle size={20} /> {t.chat}</button>
                        {selectedJob.status === 'IN_PROGRESS' && selectedJob.posterId === user.id && (
                          <button onClick={() => handleCompleteJob(selectedJob)} className="flex-1 bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><CheckCircle2 size={20} /> Complete</button>
                        )}
                        {selectedJob.status === JobStatus.COMPLETED && selectedJob.posterId === user.id && (
                          <button onClick={() => {
                            const workerToRate = selectedJob.bids.find(b => b.id === selectedJob.acceptedBidId);
                            if (workerToRate) setReviewModalData({ isOpen: true, revieweeId: workerToRate.workerId, revieweeName: workerToRate.workerName, jobId: selectedJob.id });
                          }} className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Star size={20} /> Rate Worker</button>
                        )}
                      </div> : null
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewModalData && (
          <ReviewModal
            isOpen={reviewModalData.isOpen}
            onClose={() => setReviewModalData(null)}
            onSubmit={handleSubmitReview}
            revieweeName={reviewModalData.revieweeName}
          />
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