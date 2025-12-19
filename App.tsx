import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { ChatMessage, Coordinates, Job, JobStatus, UserRole } from './types';
import { Confetti } from './components/Confetti';
import { POSTER_FEE, WORKER_COMMISSION_RATE } from './constants';
import { ChatInterface } from './components/ChatInterface';
import { ReviewModal } from './components/ReviewModal';
import {
  MapPin, UserCircle, ArrowLeftRight, Bell, MessageCircle, Languages, Loader2
} from 'lucide-react';
import { supabase } from './lib/supabase';

// Import Pages
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Wallet as WalletPage } from './pages/Wallet';
import { PostJob } from './pages/PostJob';

// Import Components
import { BottomNav } from './components/BottomNav';
import { BidModal } from './components/BidModal';
import { JobDetailsModal } from './components/JobDetailsModal';
import { EditProfileModal } from './components/EditProfileModal';
import { ViewBidsModal } from './components/ViewBidsModal';
import { CounterModal } from './components/CounterModal';
import { OnboardingModal } from './components/OnboardingModal';
import { BidHistoryModal } from './components/BidHistoryModal';
import { NotificationsPanel } from './components/NotificationsPanel';
import { ChatListPanel } from './components/ChatListPanel';
import { LandingPage } from './components/LandingPage';

// Services
import { signInWithGoogle, completeProfile } from './services/authService';
import { useDeepLinkHandler } from './hooks/useDeepLinkHandler';
import { cancelJob, chargeWorkerCommission } from './services/jobService';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    notifications, messages, setMessages,
    addNotification, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB, refreshUser, setActiveChatId,
    markNotificationsAsReadForJob, setActiveJobId, deleteNotification, clearNotificationsForJob
  } = useUser();

  const { jobs, updateJob, deleteJob, updateBid } = useJobs();

  // Handle deep links for OAuth callback
  useDeepLinkHandler(() => {
    console.log('[App] OAuth callback handled, refreshing auth');
    retryAuth();
  });

  // --- Auth State ---
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileCoords, setProfileCoords] = useState<Coordinates | undefined>(undefined);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // --- UI State ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(false); // Used in Wallet Page
  const [showFilterModal, setShowFilterModal] = useState(false); // Used in Home Page
  const [showEditProfile, setShowEditProfile] = useState(false); // Used in Profile Page

  // --- Global Modals State ---
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [chatOpen, setChatOpen] = useState<{ isOpen: boolean; job: Job | null; receiverId?: string }>({ isOpen: false, job: null });
  const [bidModalOpen, setBidModalOpen] = useState<{ isOpen: boolean; jobId: string | null }>({ isOpen: false, jobId: null });
  const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean, revieweeId: string, revieweeName: string, jobId: string } | null>(null);
  const [viewBidsModal, setViewBidsModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [counterModalOpen, setCounterModalOpen] = useState<{ isOpen: boolean; bidId: string | null; jobId: string | null; initialAmount: string }>({ isOpen: false, bidId: null, jobId: null, initialAmount: '' });

  // --- Job Editing State (Used in Home Page -> Edit) ---
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  // Note: edit state was mostly local in original app but navigation handling implies it might navigate to Post page?
  // In the original, handleEditJobLink set local state but didn't seem to open a modal directly in the return.
  // It set `editingJob` and friends.
  // For this refactor, I'll rely on navigating to /post with state or handling it. 
  // Given user wants "split" not "rewrite", I will keep logic as close as possible but structured.
  // The original App had `handleEditJobLink` but it wasn't clear what it rendered. 
  // It seems it was preparing to use the `PostJob` component (if it was embedded) or similar.
  // I will leave the `handleEditJobLink` logic as a stub or navigation for now until I see `PostJob` usage.
  // Actually, I'll just keep the Navigate to Post for editing if I can.
  // For now, I'll implement `handleEditJobLink` to Navigate to ` / post` with the job state to pre-fill it (requires PostJob update, but I can't touch it easily).
  // So I will just keep the legacy state for now in case I missed where it renders.
  // For now, I'll implement `handleEditJobLink` to Navigate to ` / post` with the job state to pre-fill it (requires PostJob update, but I can't touch it easily).
  // So I will just keep the legacy state for now in case I missed where it renders.
  // Update: I will just use `useNavigate` to go to ` / post` with state.
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status
  useEffect(() => {
    if (isLoggedIn && !isAuthLoading && !user.name.includes('Mock')) { // Don't show for mock user if we want
      const hasCompletedOnboarding = localStorage.getItem('chowkar_onboarding_complete');
      if (hasCompletedOnboarding !== 'true') {
        setShowOnboarding(true);
      }
    }
  }, [isLoggedIn, isAuthLoading, user]);

  // --- Realtime Sync ---
  // When 'jobs' update in background, update the open Modal view
  useEffect(() => {
    if (viewBidsModal.isOpen && viewBidsModal.job) {
      const liveJob = jobs.find(j => j.id === viewBidsModal.job!.id);
      if (liveJob && JSON.stringify(liveJob.bids) !== JSON.stringify(viewBidsModal.job.bids)) {
        setViewBidsModal(prev => ({ ...prev, job: liveJob }));
      }
    }
    // Also sync Selected Job if open
    if (selectedJob) {
      const liveJob = jobs.find(j => j.id === selectedJob.id);
      if (liveJob && liveJob.status !== selectedJob.status) {
        setSelectedJob(liveJob);
      }
    }
  }, [jobs, viewBidsModal.isOpen, viewBidsModal.job, selectedJob]);

  const unreadCount = notifications.filter(n => n.userId === user.id && !n.read).length;

  // Count chats with unread messages
  const unreadChatCount = notifications.filter(n =>
    n.userId === user.id &&
    !n.read &&
    // n.title === "New Message" && // Removed check
    n.relatedJobId
  ).reduce((acc, n) => {
    if (!acc.includes(n.relatedJobId!)) acc.push(n.relatedJobId!);
    return acc;
  }, [] as string[]).length;

  // --- Handlers ---
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      showAlert(result.error || 'Failed to sign in', 'error');
      setIsSigningIn(false);
    }
  };

  // Close chat on navigation to prevent stuck active state
  useEffect(() => {
    setChatOpen({ isOpen: false, job: null });
    setActiveChatId(null);
    setActiveJobId(null);
  }, [location.pathname]);

  // Track when ViewBidsModal opens to set active job and mark notifications as read
  useEffect(() => {
    if (viewBidsModal.isOpen && viewBidsModal.job) {
      setActiveJobId(viewBidsModal.job.id);
      markNotificationsAsReadForJob(viewBidsModal.job.id);
    }
  }, [viewBidsModal.isOpen, viewBidsModal.job?.id]);

  // Track when JobDetailsModal (selectedJob) opens
  useEffect(() => {
    if (selectedJob) {
      setActiveJobId(selectedJob.id);
      markNotificationsAsReadForJob(selectedJob.id);
    }
  }, [selectedJob?.id]);

  const handleLogout = async () => { await logout(); };

  const handleChatOpen = (job: Job, receiverId?: string) => {
    // VALIDATE: Chat only for IN_PROGRESS jobs
    if (job.status !== JobStatus.IN_PROGRESS) {
      showAlert(language === 'en'
        ? 'Chat is only available after job is accepted'
        : 'चैट केवल जॉब स्वीकार होने के बाद उपलब्ध है', 'info');
      return;
    }

    // VALIDATE: Only poster or accepted worker can chat
    const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);
    const isParticipant = user.id === job.posterId || user.id === acceptedBid?.workerId;
    if (!isParticipant) {
      showAlert(language === 'en'
        ? 'You are not a participant in this job'
        : 'आप इस जॉब में भागीदार नहीं हैं', 'error');
      return;
    }

    setChatOpen({ isOpen: true, job, receiverId });
    setActiveChatId(job.id);
    setActiveJobId(job.id);
    markNotificationsAsReadForJob(job.id);
    setShowChatList(false);
  };

  const handleMessageUpdate = (updatedMsg: ChatMessage) => {
    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
  };

  const handleSendMessage = async (text: string) => {
    if (!chatOpen.job) return;

    // Derive receiver ID
    const job = chatOpen.job;
    const isPoster = user.id === job.posterId;

    let receiverId = chatOpen.receiverId;

    if (!receiverId) {
      // Fallback logic
      const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);
      if (isPoster) {
        receiverId = acceptedBid?.workerId;
      } else {
        receiverId = job.posterId;
      }
    }

    if (!receiverId) {
      console.error('Cannot determine chat receiver');
      showAlert('Error: Cannot determine who to send message to.', 'error');
      return;
    }

    const tempId = `temp_${Date.now()}_${Math.random()} `;
    const msg: ChatMessage = {
      id: tempId,
      jobId: job.id,
      senderId: user.id,
      text,
      timestamp: Date.now()
    };

    // Optimistic update
    setMessages(prev => [...prev, msg]);

    // Save to database
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          job_id: msg.jobId,
          sender_id: msg.senderId,
          receiver_id: receiverId,
          text: msg.text
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } else if (data) {
        setMessages(prev => prev.map(m =>
          m.id === tempId
            ? { ...m, id: data.id, timestamp: new Date(data.created_at).getTime() }
            : m
        ));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleCompleteJob = async () => {
    if (!chatOpen.job) return;
    const currentJob = chatOpen.job;

    try {
      console.log('[App] Marking job as completed:', currentJob.id);
      const updatedJob = { ...currentJob, status: JobStatus.COMPLETED };

      // Update DB and wait for response
      await updateJob(updatedJob);

      // Prompt for review if there's an accepted worker
      const acceptedBid = currentJob.bids.find(b => b.id === currentJob.acceptedBidId);
      if (acceptedBid) {
        setReviewModalData({
          isOpen: true,
          revieweeId: acceptedBid.workerId,
          revieweeName: acceptedBid.workerName,
          jobId: currentJob.id
        });

        try {
          await addNotification(acceptedBid.workerId, "Job Completed", `Job "${currentJob.title}" marked as completed!`, 'SUCCESS', currentJob.id);
        } catch (notifErr) {
          console.warn('[App] Failed to send completion notification:', notifErr);
        }
      }

      setChatOpen({ isOpen: false, job: null });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showAlert(t.jobCompletedAlert, 'success');
    } catch (err: any) {
      console.error('[App] Error in handleCompleteJob:', err);
      showAlert(`Failed to complete job: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleTranslateMessage = async (messageId: string, text: string) => {
    try {
      const { translateText } = await import('./services/geminiService');
      const translated = await translateText(text, language === 'en' ? 'hi' : 'en');
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, translatedText: translated } : m));
    } catch (err) {
      console.error('Translation error:', err);
    }
  };

  const handleWorkerReplyToCounter = async (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => {
    const job = jobs.find(j => j.id === jobId); if (!job) return;
    try {
      const bid = job.bids.find(b => b.id === bidId); if (!bid) return;

      if (action === 'ACCEPT') {
        // WORKER ACCEPTS COUNTER = JOB FINALIZED
        // 1. Call accept_bid RPC to finalize the job
        const { error: acceptError } = await supabase.rpc('accept_bid', {
          p_job_id: jobId,
          p_bid_id: bidId,
          p_poster_id: job.posterId,
          p_worker_id: bid.workerId,
          p_amount: bid.amount,
          p_poster_fee: POSTER_FEE
        });
        if (acceptError) throw acceptError;

        // 2. Charge Worker Commission
        const { error: commissionError } = await chargeWorkerCommission(bid.workerId, jobId, bid.amount);
        if (commissionError) {
          console.warn('[Accept] Worker commission charge failed:', commissionError);
        }

        // 3. Broadcast job update for instant real-time sync
        try {
          const updatedJobPayload = {
            id: jobId,
            status: 'IN_PROGRESS',
            accepted_bid_id: bidId,
            poster_id: job.posterId,
            title: job.title,
            description: job.description,
            category: job.category,
            budget: job.budget,
            location: job.location,
            latitude: job.coordinates?.lat,
            longitude: job.coordinates?.lng
          };
          const channel = supabase.channel('job_system_hybrid_sync');
          await channel.subscribe();
          await channel.send({
            type: 'broadcast',
            event: 'job_updated',
            payload: updatedJobPayload
          });
          console.log('[Accept] Job status broadcast sent');
        } catch (broadcastErr) {
          console.warn('[Accept] Job broadcast failed:', broadcastErr);
        }

        // 4. Notify Poster
        const commission = Math.ceil(bid.amount * WORKER_COMMISSION_RATE);
        await addNotification(
          job.posterId,
          "Job Accepted",
          `"${job.title}": ${bid.workerName} accepted ₹${bid.amount}. Chat is now unlocked!`,
          "SUCCESS",
          jobId
        );

        showAlert(t.contactUnlocked || 'Job accepted! Chat unlocked.', 'success');

      } else if (action === 'REJECT') {
        const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
        await updateJob(updatedJob);
        await addNotification(job.posterId, "Counter Declined", `"${job.title}": ${bid.workerName} declined your offer.`, "WARNING", jobId);
        showAlert(t.alertJobDeleted, 'info');

      } else if (action === 'COUNTER' && amount) {
        const updatedBid = { ...bid, amount, negotiationHistory: [...(bid.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] };
        await updateBid(updatedBid);
        await addNotification(job.posterId, "Counter Offer", `"${job.title}": ${bid.workerName} countered ₹${amount}`, "INFO", jobId);
      }
    } catch (err: any) {
      console.error('[WorkerReply] Error:', err);
      showAlert(`Failed: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleWithdrawBid = async (jobId: string, bidId: string) => {
    if (!confirm(language === 'en' ? 'Are you sure you want to withdraw your bid?' : 'क्या आप अपनी बोली वापस लेना चाहते हैं?')) return;
    try {
      const job = jobs.find(j => j.id === jobId); if (!job) return;
      const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
      await updateJob(updatedJob);
      showAlert(language === 'en' ? 'Bid withdrawn' : 'बोली वापस ली गई', 'info');
    } catch { showAlert('Error withdrawing bid', 'error'); }
  };

  const handleEditJobLink = (job: Job) => {
    if (job.bids.length > 0) { showAlert(t.alertCantEdit, 'error'); return; }
    // Navigate to post page with state to potentially populate it
    // NOTE: This assumes PostJob can read location state. If not, it just opens the form.
    navigate('/post', { state: { jobToEdit: job } });
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await supabase.rpc('soft_delete_chat_message', { p_message_id: messageId });
      // Update UI to show deleted state (consistent with DB soft delete)
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, text: 'This message was deleted', translatedText: undefined }
          : m
      ));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const result = await cancelJob(jobId, 'Cancelled by user');
      if (result.success) {
        showAlert(language === 'en' ? 'Job cancelled and funds refunded.' : 'जॉब रद्द कर दिया गया और पैसे वापस कर दिए गए।', 'success');
        setSelectedJob(null);
        await refreshUser(); // Update wallet balance
      } else {
        showAlert(result.error || 'Failed to cancel', 'error');
      }
    } catch (e) {
      console.error(e);
      showAlert('Error during cancellation', 'error');
    }
  };


  // --- Views ---

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-gray-900">
        <Loader2 size={32} className="text-emerald-600 animate-spin mb-4" />
        <p className="text-emerald-700 font-medium">{loadingMessage}</p>
        {loadingMessage.includes('timeout') && <button onClick={retryAuth} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded">Retry</button>}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LandingPage
        onGetStarted={handleGoogleSignIn}
        language={language}
        onLanguageToggle={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
        isSigningIn={isSigningIn}
      />
    );
  }

  // --- Main Layout ---
  return (
    <div className="h-[100dvh] w-full bg-green-50 font-sans text-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 z-30 shadow-sm flex-none">
        <div className="max-w-7xl mx-auto px-4 py-3 pt-safe flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <MapPin size={24} className="text-emerald-600" fill="#10b981" />
            <div><h1 className="text-xl font-bold text-emerald-900 leading-none">CHOWKAR</h1></div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/')} className={`text-sm font-bold ${location.pathname === '/' ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}>{t.navHome}</button>
            {role === UserRole.POSTER && (
              <button onClick={() => navigate('/post')} className={`text-sm font-bold ${location.pathname === '/post' ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}>{t.navPost}</button>
            )}
            <button onClick={() => navigate('/wallet')} className={`text-sm font-bold ${location.pathname === '/wallet' ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}>{t.navWallet}</button>
            <button onClick={() => navigate('/profile')} className={`text-sm font-bold ${location.pathname === '/profile' ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-600'}`}>{t.navProfile}</button>
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')} className="p-2 text-emerald-800 text-xs font-bold border border-emerald-100 rounded-lg bg-emerald-50 hover:bg-emerald-100"><Languages size={18} /> {language === 'en' ? 'हि' : 'En'}</button>
            <button onClick={() => setShowChatList(true)} className="relative p-2 hover:bg-gray-100 rounded-full">
              <MessageCircle size={20} className="text-gray-600" />
              {unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowNotifications(true)} className="relative p-2 hover:bg-gray-100 rounded-full">
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => { setRole(r => r === UserRole.WORKER ? UserRole.POSTER : UserRole.WORKER); }} className="px-3 py-1.5 bg-emerald-50 rounded-full text-xs font-semibold text-emerald-800 border border-emerald-100 flex items-center gap-1 hover:bg-emerald-100">
              <ArrowLeftRight size={14} />{role === UserRole.WORKER ? t.switchHiring : t.switchWorking}
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {showConfetti && <Confetti />}
      {currentAlert && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-xl font-bold text-sm flex items-center gap-3 backdrop-blur-md ${currentAlert.type === 'error' ? 'bg-red-500/90 text-white' : currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white' : 'bg-gray-800/90 text-white'} `}>
          <span>{currentAlert.message}</span>
        </div>
      )}

      {/* Router View */}
      <main className="flex-1 overflow-y-auto bg-green-50 w-full relative">
        <div className="max-w-7xl mx-auto w-full h-full">
          <Routes>
            <Route path="/" element={<Home
              onBid={(id) => setBidModalOpen({ isOpen: true, jobId: id })}
              onViewBids={(j) => setViewBidsModal({ isOpen: true, job: j })}
              onChat={handleChatOpen}
              onEdit={handleEditJobLink}
              onClick={(j) => setSelectedJob(j)} // Open job details
              onReplyToCounter={handleWorkerReplyToCounter}
              onWithdrawBid={handleWithdrawBid}
              setShowFilterModal={setShowFilterModal}
              showAlert={showAlert}
            />} />
            <Route path="/wallet" element={<WalletPage onShowBidHistory={() => setShowBidHistory(true)} />} />
            <Route path="/profile" element={<Profile onEditProfile={() => setShowEditProfile(true)} setShowSubscriptionModal={setShowSubscriptionModal} onLogout={handleLogout} />} />
            <Route path="/post" element={<PostJob />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <BottomNav />

      {/* --- Global Modals --- */}

      <BidModal
        isOpen={bidModalOpen.isOpen}
        onClose={() => setBidModalOpen({ isOpen: false, jobId: null })}
        jobId={bidModalOpen.jobId}
        onSuccess={() => { }}
        showAlert={showAlert}
      />

      <JobDetailsModal
        job={selectedJob}
        onClose={() => { setSelectedJob(null); setActiveJobId(null); }}
        onBid={(jobId) => { setSelectedJob(null); setBidModalOpen({ isOpen: true, jobId }); }}
        onViewBids={(job) => { setSelectedJob(null); setViewBidsModal({ isOpen: true, job }); }}
        onChat={(job) => { setSelectedJob(null); handleChatOpen(job); }}
        onEdit={(job) => { setSelectedJob(null); handleEditJobLink(job); }}
        onCancel={handleCancelJob}
        onDelete={async (jobId) => {
          try {
            await deleteJob(jobId);
            setSelectedJob(null);
            showAlert(t.alertJobDeleted, 'success');
          } catch {
            showAlert('Failed to delete job', 'error');
          }
        }}
        showAlert={showAlert}
        onReplyToCounter={handleWorkerReplyToCounter}
      />

      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        showAlert={showAlert}
      />

      <ViewBidsModal
        isOpen={viewBidsModal.isOpen}
        onClose={() => { setViewBidsModal({ isOpen: false, job: null }); setActiveJobId(null); }}
        job={viewBidsModal.job}
        onCounter={(bidId, amount) => {
          setCounterModalOpen({ isOpen: true, bidId, jobId: viewBidsModal.job!.id, initialAmount: amount.toString() });
        }}
        showAlert={showAlert}
      />

      <CounterModal
        isOpen={counterModalOpen.isOpen}
        onClose={() => setCounterModalOpen({ isOpen: false, bidId: null, jobId: null, initialAmount: '' })}
        bidId={counterModalOpen.bidId}
        jobId={counterModalOpen.jobId}
        initialAmount={counterModalOpen.initialAmount}
        showAlert={showAlert}
      />

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onJobClick={(job, notif) => {
          setShowNotifications(false);

          // Delete the notification after clicking (user has acted on it)
          deleteNotification(notif.id);

          // Set active job to suppress future notifications for this job
          setActiveJobId(job.id);

          // Click-to-Action Routing based on notification type and job status
          const isAcceptedNotif = notif.title === "Bid Accepted" || notif.title === "Job Accepted" || notif.title === "Counter Accepted";

          if (notif.title === t.notifBidReceived || notif.title === "New Bid") {
            // New bid - poster views bids
            setViewBidsModal({ isOpen: true, job });
          } else if (isAcceptedNotif && job.status === JobStatus.IN_PROGRESS) {
            // Job is accepted and in progress - go to chat
            handleChatOpen(job);
          } else if (notif.title === t.notifJobCompleted || notif.title === "Job Completed") {
            // Job completed - show review modal if poster
            const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);
            if (user.id === job.posterId && acceptedBid) {
              setReviewModalData({
                isOpen: true,
                revieweeId: acceptedBid.workerId,
                revieweeName: acceptedBid.workerName,
                jobId: job.id
              });
            } else {
              handleChatOpen(job);
            }
          } else if (notif.title === t.notifCounterOffer || notif.title === "Counter Offer") {
            // Counter offer - view in appropriate modal (job still OPEN, no chat yet)
            if (user.id === job.posterId) {
              setViewBidsModal({ isOpen: true, job });
            } else {
              setSelectedJob(job);
            }
          } else if (notif.title === "Bid Not Selected") {
            // Rejected bid - just show job details
            setSelectedJob(job);
          } else if (job.status === JobStatus.IN_PROGRESS) {
            // Default for IN_PROGRESS jobs: Open Chat
            handleChatOpen(job);
          } else {
            // Default for other statuses: Open job details
            setSelectedJob(job);
          }
        }}
      />

      <ChatListPanel
        isOpen={showChatList}
        onClose={() => setShowChatList(false)}
        onChatSelect={handleChatOpen}
      />

      <BidHistoryModal
        isOpen={showBidHistory}
        onClose={() => setShowBidHistory(false)}
      />

      {/* Legacy Review Modal (if used) */}
      <ReviewModal
        isOpen={reviewModalData?.isOpen || false}
        onClose={() => setReviewModalData(null)}
        onSubmit={async (rating, comment) => {
          if (!reviewModalData) return;
          try {
            const { error } = await supabase.from('reviews').insert({
              reviewer_id: user.id,
              reviewee_id: reviewModalData.revieweeId,
              job_id: reviewModalData.jobId,
              rating,
              comment,
              tags: null
            });
            if (error) throw error;
            await addNotification(reviewModalData.revieweeId, "New Review", `You received a ${rating} star review!`, "SUCCESS");
            setReviewModalData(null);
            showAlert(t.reviewSubmitted, 'success');
          } catch { showAlert('Failed to submit review', 'error'); }
        }}
        revieweeName={reviewModalData?.revieweeName || ''}
      />

      {/* Chat Interface */}
      {chatOpen.isOpen && chatOpen.job && (
        <ChatInterface
          job={chatOpen.job}
          currentUser={user}
          onClose={() => { setChatOpen({ isOpen: false, job: null }); setActiveChatId(null); setActiveJobId(null); }}
          messages={messages.filter(m => m.jobId === chatOpen.job?.id)}
          onSendMessage={handleSendMessage}
          onCompleteJob={handleCompleteJob}
          onTranslateMessage={handleTranslateMessage}
          onDeleteMessage={handleDeleteMessage}
          onIncomingMessage={(msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
          onMessageUpdate={handleMessageUpdate}
          isPremium={user.isPremium}
          remainingTries={user.isPremium ? 999 : (2 - (user.aiUsageCount || 0))}
        />
      )}

      {/* Onboarding Dialog */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={(selectedRole) => {
          setRole(selectedRole);
          localStorage.setItem('chowkar_onboarding_complete', 'true');
          setShowOnboarding(false);

          // Navigate based on choice
          if (selectedRole === UserRole.POSTER) {
            navigate('/post');
          } else {
            navigate('/');
          }
        }}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <UserProvider>
        <JobProvider>
          <AppContent />
        </JobProvider>
      </UserProvider>
    </Router>
  );
};