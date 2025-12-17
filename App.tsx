import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { ChatMessage, Coordinates, Job, JobStatus, UserRole } from './types';
import { Confetti } from './components/Confetti';
import { POSTER_FEE } from './constants';
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
import { cancelJob } from './services/jobService';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    notifications, messages, setMessages,
    addNotification, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB, refreshUser, setActiveChatId, markNotificationsAsReadForJob
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
  const [chatOpen, setChatOpen] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
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
    n.title === "New Message" &&
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

  const handleLogout = async () => { await logout(); };

  const handleChatOpen = (job: Job) => {
    setChatOpen({ isOpen: true, job });
    setActiveChatId(job.id);
    markNotificationsAsReadForJob(job.id);
    setShowChatList(false);
  };

  const handleSendMessage = async (text: string) => {
    if (!chatOpen.job) return;

    const tempId = `temp_${Date.now()}_${Math.random()} `;
    const msg: ChatMessage = {
      id: tempId,
      jobId: chatOpen.job.id,
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
    try {
      const updatedJob = { ...chatOpen.job, status: JobStatus.COMPLETED };
      await updateJob(updatedJob);

      // Prompt for review
      const acceptedBid = chatOpen.job.bids.find(b => b.id === chatOpen.job?.acceptedBidId);
      if (acceptedBid) {
        setReviewModalData({
          isOpen: true,
          revieweeId: acceptedBid.workerId,
          revieweeName: acceptedBid.workerName,
          jobId: chatOpen.job.id
        });
        await addNotification(acceptedBid.workerId, t.notifJobCompleted, t.jobCompletedAlert, 'SUCCESS', chatOpen.job.id);
      }

      setChatOpen({ isOpen: false, job: null });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showAlert(t.jobCompletedAlert, 'success');
    } catch {
      showAlert('Failed to complete job', 'error');
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
        const updatedBid = { ...bid, negotiationHistory: [...(bid.negotiationHistory || []), { amount: bid.amount, by: UserRole.WORKER, timestamp: Date.now(), message: "Accepted Counter Offer" }] };
        await updateBid(updatedBid);
        await addNotification(job.posterId, "Counter Accepted", "Worker accepted your offer. Please finalize hiring.", "SUCCESS", jobId);
      } else if (action === 'REJECT') {
        const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
        await updateJob(updatedJob);
        showAlert(t.alertJobDeleted, 'info');
      } else if (action === 'COUNTER' && amount) {
        const updatedBid = { ...bid, amount, negotiationHistory: [...(bid.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] };
        await updateBid(updatedBid);
        await addNotification(job.posterId, t.notifCounterOffer, `Worker countered: ₹${amount} `, "INFO", jobId);
      }
    } catch { showAlert('Failed to process counter.', 'error'); }
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
      setMessages(prev => prev.filter(m => m.id !== messageId));
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
              {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
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
        onClose={() => setSelectedJob(null)}
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
      />

      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        showAlert={showAlert}
      />

      <ViewBidsModal
        isOpen={viewBidsModal.isOpen}
        onClose={() => setViewBidsModal({ isOpen: false, job: null })}
        job={viewBidsModal.job}
        onCounter={(bidId, amount) => {
          // setViewBidsModal({ isOpen: false, job: null }); // Optional: keep bids view open or close? Original code didn't close it explicitly, just opened counter logic
          // Actually, we want to open counter modal.
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
        onJobClick={(job) => { setShowNotifications(false); handleChatOpen(job); }}
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
          onClose={() => { setChatOpen({ isOpen: false, job: null }); setActiveChatId(null); }}
          messages={messages.filter(m => m.jobId === chatOpen.job?.id)}
          onSendMessage={handleSendMessage}
          onCompleteJob={handleCompleteJob}
          onTranslateMessage={handleTranslateMessage}
          onDeleteMessage={handleDeleteMessage}
          onIncomingMessage={(msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
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