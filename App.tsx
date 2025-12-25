import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { ChatMessage, Coordinates, Job, JobStatus, UserRole } from './types';
import {
  MapPin, UserCircle, ArrowLeftRight, Bell, MessageCircle, Languages, Loader2
} from 'lucide-react';
import { supabase } from './lib/supabase';

// --- Lazy loaded Pages ---
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const WalletPage = lazy(() => import('./pages/Wallet').then(m => ({ default: m.Wallet })));
const PostJob = lazy(() => import('./pages/PostJob').then(m => ({ default: m.PostJob })));

// --- Lazy loaded Components ---
const Confetti = lazy(() => import('./components/Confetti').then(m => ({ default: m.Confetti })));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
const ReviewModal = lazy(() => import('./components/ReviewModal').then(m => ({ default: m.ReviewModal })));
const PaymentModal = lazy(() => import('./components/PaymentModal').then(m => ({ default: m.PaymentModal })));
const BidModal = lazy(() => import('./components/BidModal').then(m => ({ default: m.BidModal })));
const JobDetailsModal = lazy(() => import('./components/JobDetailsModal').then(m => ({ default: m.JobDetailsModal })));
const EditProfileModal = lazy(() => import('./components/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const ViewBidsModal = lazy(() => import('./components/ViewBidsModal').then(m => ({ default: m.ViewBidsModal })));
const CounterModal = lazy(() => import('./components/CounterModal').then(m => ({ default: m.CounterModal })));
const OnboardingModal = lazy(() => import('./components/OnboardingModal').then(m => ({ default: m.OnboardingModal })));
const BidHistoryModal = lazy(() => import('./components/BidHistoryModal').then(m => ({ default: m.BidHistoryModal })));
const NotificationsPanel = lazy(() => import('./components/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
const ChatListPanel = lazy(() => import('./components/ChatListPanel').then(m => ({ default: m.ChatListPanel })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const UserProfileModal = lazy(() => import('./components/UserProfileModal').then(m => ({ default: m.UserProfileModal })));

// Import Synchronous Components
import { BottomNav } from './components/BottomNav';

// Services
import { signInWithGoogle, completeProfile, markWelcomeBonusAsSeen } from './services/authService';
import { useDeepLinkHandler } from './hooks/useDeepLinkHandler';
import { cancelJob } from './services/jobService';
import { checkWalletBalance, deductFromWallet, getAppConfig } from './services/paymentService';
import { setupPushListeners, removePushListeners, isPushSupported } from './services/pushService';
import { handleNotificationNavigation, parseNotificationData } from './services/notificationNavigationService';
import { editMessage } from './services/chatService';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    notifications, transactions, messages, setMessages,
    addNotification, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB, refreshUser, setActiveChatId,
    markNotificationsAsReadForJob, setActiveJobId, deleteNotification, clearNotificationsForJob
  } = useUser();

  const { jobs, updateJob, deleteJob, updateBid, getJobWithFullDetails, refreshJobs } = useJobs();

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

  // Worker Payment Modal State (for unlocking chat after bid accepted)
  const [workerPaymentModal, setWorkerPaymentModal] = useState<{ isOpen: boolean; job: Job | null; bidId: string | null }>({ isOpen: false, job: null, bidId: null });

  // User Profile Modal State
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; userId: string; userName?: string }>({ isOpen: false, userId: '' });

  // Wallet Refill Modal State
  const [showWalletRefill, setShowWalletRefill] = useState(false);

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
  // Update: I will just use `useNavigate` to go to ` / post` with state.
  const navigate = useNavigate();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status
  useEffect(() => {
    // Wait for real DB data before nagging about profile
    // We check user.joinDate to ensure we have a db-hydrated user (optimistic user creates joinDate from Date.now, but DB user has it too)
    // Better: check if we have actually attempted to load the profile.

    if (isLoggedIn && !isAuthLoading && !user.name.includes('Mock')) {
      // 1. Role Selection
      const hasCompletedOnboarding = localStorage.getItem('chowkar_onboarding_complete');
      if (hasCompletedOnboarding !== 'true') {
        setShowOnboarding(true);
        return; // Prioritize Role Selection
      }

      // 2. Profile Completion (Phone/Location) - ONLY pop up if we are sure (user object has been synced)
      // The optimistic user from auth change might lack phone/location.
      // We'll assume if walletBalance is defined, we have fetched from DB (since optimistic doesn't usually set exact wallet from DB without fetch)
      // Actually, let's just use a simpler heuristic: don't auto-show unless we are sure they are missing.
      // But we need them to fill it. 

      // 2. Profile Completion (Name/Phone/Location)
      // DISABLED: Profile completion requirement temporarily disabled
      // if (user.id) {
      //   const isNameMissing = !user.name || user.name.trim() === '';
      //   const isPhoneMissing = !user.phone || user.phone.trim() === '';
      //   const isLocationMissing = !user.location || user.location === 'Not set' || user.location.trim() === '';

      //   if (isNameMissing || isPhoneMissing || isLocationMissing) {
      //     console.log('[App] Profile incomplete, redirecting to /profile:', { name: !isNameMissing, phone: !isPhoneMissing, location: !isLocationMissing });
      //     if (location.pathname !== '/profile') {
      //       navigate('/profile');
      //     }
      //   }
      // }

    }
  }, [isLoggedIn, isAuthLoading, user]);

  // Handle pending notification navigation (from LocalNotifications tap)
  useEffect(() => {
    if (!isLoggedIn || jobs.length === 0) return;

    const pending = localStorage.getItem('chowkar_pending_navigation');
    if (!pending) return;

    try {
      const { jobId, type, timestamp } = JSON.parse(pending);

      // Ignore old navigation intents (>5 minutes)
      if (Date.now() - timestamp > 300000) {
        localStorage.removeItem('chowkar_pending_navigation');
        return;
      }

      console.log('[Navigation] Processing pending navigation:', { jobId, type });

      const job = jobs.find(j => j.id === jobId);
      if (!job) {
        console.warn('[Navigation] Job not found:', jobId);
        localStorage.removeItem('chowkar_pending_navigation');
        return;
      }

      // Clear the pending navigation
      localStorage.removeItem('chowkar_pending_navigation');

      // Mark notifications as read for this job
      markNotificationsAsReadForJob(jobId);
      setActiveJobId(jobId);

      // Navigate based on type
      if (type === 'bid_received' || type === 'counter_offer' || type === 'INFO') {
        // Poster: Open ViewBidsModal
        setViewBidsModal({ isOpen: true, job });
      } else if (type === 'bid_accepted' || type === 'SUCCESS') {
        // Worker: Open job details or chat
        setSelectedJob(job);
      } else if (type === 'chat_message') {
        // Open chat
        handleChatOpen(job);
      }
    } catch (err) {
      console.error('[Navigation] Error processing pending navigation:', err);
      localStorage.removeItem('chowkar_pending_navigation');
    }
  }, [isLoggedIn, jobs]);

  // Push notification tap handler (deep linking)
  useEffect(() => {
    if (!isLoggedIn || !isPushSupported()) return;

    console.log('[PushTap] Setting up notification tap handler');

    // Helper to open modals
    const openModal = (type: string, id: string) => {
      const job = jobs.find(j => j.id === id);
      if (!job) {
        console.warn('[PushTap] Job not found:', id);
        return;
      }

      switch (type) {
        case 'viewBids':
          setViewBidsModal({ isOpen: true, job });
          getJobWithFullDetails(id, true);
          break;
        case 'chat':
          setChatOpen({ isOpen: true, job });
          setActiveChatId(id);
          getJobWithFullDetails(id, true);
          break;
        case 'jobDetails':
          setSelectedJob(job);
          getJobWithFullDetails(id, true);
          break;
      }
    };

    setupPushListeners(
      // onNotificationReceived (app is open)
      (notification) => {
        console.log('[PushTap] Notification received while app open:', notification);
        // Don't show system notification - in-app notification already handled by context
      },
      // onNotificationClicked (user tapped notification)
      (action) => {
        console.log('[PushTap] User tapped notification:', action);
        const data = parseNotificationData(action.notification);
        handleNotificationNavigation(data, navigate, openModal);
      }
    );

    return () => {
      console.log('[PushTap] Removing notification listeners');
      removePushListeners();
    };
  }, [isLoggedIn, jobs, navigate]);

  // --- Realtime Sync ---
  // When 'jobs' update in background, update the open Modal view
  useEffect(() => {
    // Sync View Bids Modal if open
    if (viewBidsModal.isOpen && viewBidsModal.job) {
      const liveJob = jobs.find(j => j.id === viewBidsModal.job!.id);
      // Update if the job reference changed (which happens when getJobWithFullDetails completes)
      if (liveJob && liveJob !== viewBidsModal.job) {
        setViewBidsModal(prev => ({ ...prev, job: liveJob }));
      }
    }
    // Sync Selected Job if open
    if (selectedJob) {
      const liveJob = jobs.find(j => j.id === selectedJob.id);
      if (liveJob && liveJob !== selectedJob) {
        setSelectedJob(liveJob);
      }
    }
  }, [jobs, viewBidsModal.isOpen, viewBidsModal.job?.id, selectedJob?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // WELCOME BONUS CELEBRATION (One-time)
  useEffect(() => {
    if (isLoggedIn && transactions.length > 0) {
      const bonusTx = transactions.find(t => t.description === 'Welcome Bonus ₹100');
      if (bonusTx && user.hasSeenWelcomeBonus === false) {
        // Show celebration
        showAlert(language === 'en'
          ? "Congratulations! You've received a ₹100 Welcome Bonus! 🎁"
          : "बधाई हो! आपको ₹100 का स्वागत बोनस मिला है! 🎁", 'success');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);

        // Mark as seen in DB
        markWelcomeBonusAsSeen(user.id);

        // Optimistic update local state to prevent multiple shows while DB updates
        setUser(prev => ({ ...prev, hasSeenWelcomeBonus: true }));
        // Legacy fallback
        localStorage.setItem(`chowkar_bonus_shown_${user.id}`, 'true');
      }
    }
  }, [isLoggedIn, transactions, user.id, user.hasSeenWelcomeBonus]);

  // Count chats with unread messages (only for IN_PROGRESS or COMPLETED jobs)
  const unreadChatCount = notifications.filter(n =>
    n.userId === user.id &&
    !n.read &&
    n.title === "New Message" && // Only count actual message notifications
    n.relatedJobId &&
    jobs.some(j => j.id === n.relatedJobId && j.status !== 'OPEN') // Exclude OPEN jobs
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
    }
    // Always reset after attempt (success leads to auth state change)
    setIsSigningIn(false);
  };

  // Reset signing in state when user is not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setIsSigningIn(false);
    }
  }, [isLoggedIn]);

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

  const handleChatOpen = async (job: Job, receiverId?: string) => {
    // VALIDATE: Chat only for IN_PROGRESS or COMPLETED jobs
    if (job.status !== JobStatus.IN_PROGRESS && job.status !== JobStatus.COMPLETED) {
      showAlert(language === 'en'
        ? 'Chat is only available after job is accepted'
        : 'चैट केवल जॉब स्वीकार होने के बाद उपलब्ध है', 'info');
      return;
    }

    // SURGICAL LOADING: If this job came from a lightweight feed (no bids), fetch full details
    // This is critical for COMPLETED/IN_PROGRESS jobs where we need the bids to identify participants
    let jobWithBids = job;
    if (job.bids.length === 0 || (job.acceptedBidId && !job.bids.find(b => b.id === job.acceptedBidId))) {
      const fetched = await getJobWithFullDetails(job.id);
      if (fetched) jobWithBids = fetched;
    }

    // VALIDATE: Only poster or accepted worker can chat
    const acceptedBid = jobWithBids.bids.find(b => b.id === jobWithBids.acceptedBidId);
    const isParticipant = user.id === jobWithBids.posterId || user.id === acceptedBid?.workerId;

    if (!isParticipant) {
      showAlert(language === 'en'
        ? 'You are not a participant in this job'
        : 'आप इस जॉब में भागीदार नहीं हैं', 'error');
      return;
    }

    // Use the enriched job object for the rest of the function
    const currentJob = jobWithBids;

    // WORKER PAYMENT CHECK: If user is the accepted worker, check if they've paid
    if (user.id === acceptedBid?.workerId && acceptedBid) {
      // Check connection_payment_status from database
      const { data: bidData } = await supabase
        .from('bids')
        .select('connection_payment_status')
        .eq('id', acceptedBid.id)
        .single();

      if (bidData?.connection_payment_status !== 'PAID') {
        // Worker hasn't paid - check wallet first
        const config = await getAppConfig();
        const connectionFee = config.connection_fee;
        const { sufficient } = await checkWalletBalance(user.id, connectionFee);

        if (sufficient) {
          // Deduct from wallet and mark as paid
          const { success } = await deductFromWallet(user.id, connectionFee, 'Connection Fee', 'CONNECTION', currentJob.id);
          if (success) {
            // Update bid payment status
            await supabase.from('bids').update({ connection_payment_status: 'PAID' }).eq('id', acceptedBid.id);

            // Notify poster
            // DB trigger will handle notification to poster
            // await addNotification(currentJob.posterId, "Chat is now active", `Chat unlocked for "${currentJob.title}"!`, "SUCCESS", currentJob.id);
            showAlert(language === 'en' ? `Chat unlocked! ₹${connectionFee} deducted from wallet.` : `चैट अनलॉक! वॉलेट से ₹${connectionFee} काटे गए।`, 'success');

            // Open chat
            setChatOpen({ isOpen: true, job: currentJob, receiverId: currentJob.posterId });
            setActiveChatId(currentJob.id);
            setActiveJobId(currentJob.id);
            markNotificationsAsReadForJob(currentJob.id);
            setShowChatList(false);
            return;
          }
        }

        // Wallet insufficient - show payment modal
        setWorkerPaymentModal({ isOpen: true, job: currentJob, bidId: acceptedBid.id });
        return;
      }
    }

    // Either poster or paid worker - open chat
    setChatOpen({ isOpen: true, job: currentJob, receiverId });
    setActiveChatId(currentJob.id);
    setActiveJobId(currentJob.id);
    markNotificationsAsReadForJob(currentJob.id);
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
      showAlert(t.chatReceiverError, 'error');
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
          // DB trigger on Job Completion will handle this
          // await addNotification(acceptedBid.workerId, "Job Completed", `Job "${currentJob.title}" marked as completed!`, 'SUCCESS', currentJob.id);
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
      showAlert(`${t.jobCompletionError}: ${err.message || 'Unknown error'}`, 'error');
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
    let job = jobs.find(j => j.id === jobId);

    // Robost Fetch: If job not loaded, fetch it
    if (!job) {
      try {
        const fetched = await getJobWithFullDetails(jobId, true);
        if (fetched) job = fetched;
      } catch (e) {
        console.error("Failed to fetch job for reply", e);
      }
    }

    if (!job) {
      showAlert(t.jobNotFound || "Job not found", 'error');
      return;
    }

    try {
      let bid = job.bids.find(b => b.id === bidId);

      // Robust Fetch: If bid not loaded (e.g. valid job but unloaded bids), reload job
      if (!bid) {
        const fetched = await getJobWithFullDetails(jobId, true);
        if (fetched) {
          job = fetched;
          bid = fetched.bids.find(b => b.id === bidId);
        }
      }

      if (!bid) {
        showAlert(t.bidNotFound || "Bid not found", 'error');
        return;
      }

      if (action === 'ACCEPT') {
        // WORKER ACCEPTS COUNTER = JOB FINALIZED (but worker needs to pay to unlock chat)
        // 1. Call accept_bid RPC (no fees anymore)
        const { error: acceptError } = await supabase.rpc('accept_bid', {
          p_job_id: jobId,
          p_bid_id: bidId,
          p_poster_id: job.posterId,
          p_worker_id: bid.workerId,
          p_amount: bid.amount,
          p_poster_fee: 0 // No fee - already paid when posting
        });
        if (acceptError) throw acceptError;

        // 2. Broadcast job update for instant real-time sync
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
            longitude: job.coordinates?.lng,
            poster_name: job.posterName,
            poster_photo: job.posterPhoto,
            created_at: new Date(job.createdAt).toISOString()
          };
          const channel = supabase.channel('job_system_hybrid_sync');
          await channel.subscribe();
          await channel.send({
            type: 'broadcast',
            event: 'job_updated',
            payload: updatedJobPayload
          });
        } catch (broadcastErr) {
          console.warn('[Accept] Job broadcast failed:', broadcastErr);
        }

        // 3. Notify Poster with clear context - no mention of payment!
        // DB triggers on bids table will handle notifications
        /*
        await addNotification(
          job.posterId,
          "Worker Confirmed! 🎉",
          `${bid.workerName} confirmed for "${job.title}" at ₹${bid.amount}. Chat will be ready shortly!`,
          "SUCCESS",
          jobId
        );
        */
        // Note: addNotification now handles push automatically

        // 4. Show worker their payment modal to unlock chat
        setWorkerPaymentModal({ isOpen: true, job, bidId });
        showAlert(t.counterAcceptedPay, 'success');

      } else if (action === 'REJECT') {
        // Confirmation dialog
        if (!confirm(t.declineCounterPrompt)) return;

        const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
        await updateJob(updatedJob);
        // DB triggers on bids table will handle notifications
        // await addNotification(job.posterId, "Offer Declined", `${bid.workerName} declined your offer for "${job.title}". You can try other workers!`, "WARNING", jobId);
        // Note: addNotification now handles push automatically

        showAlert(t.counterDeclined, 'info');

      } else if (action === 'COUNTER' && amount) {
        const updatedBid = { ...bid, amount, negotiationHistory: [...(bid.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] };
        await updateBid(updatedBid);
        // DB triggers on bids table will handle notifications
        // await addNotification(job.posterId, "New Counter Offer 💰", `${bid.workerName} proposed ₹${amount} for "${job.title}". Tap to respond!`, "INFO", jobId);
        // Note: addNotification now handles push automatically
      }
    } catch (err: any) {
      console.error('[WorkerReply] Error:', err);
      showAlert(`${t.genericError}${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleWithdrawBid = async (jobId: string, bidId: string) => {
    if (!confirm(t.withdrawBidPrompt)) return;
    try {
      const job = jobs.find(j => j.id === jobId); if (!job) return;
      const bid = job.bids.find(b => b.id === bidId);
      const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
      await updateJob(updatedJob);

      // Notify poster that worker withdrew their bid
      // DB trigger for bid withdrawal (rejection/deletion) should handle this
      /*
      if (bid) {
        await addNotification(
          job.posterId,
          "Bid Update",
          `${bid.workerName} is no longer available for "${job.title}". Check other bids!`,
          "INFO",
          jobId
        );
      }
      */  // Note: addNotification now handles push automatically

      showAlert(t.bidWithdrawn, 'info');
    } catch { showAlert(t.withdrawBidError, 'error'); }
  };

  const handleEditJobLink = async (job: Job) => {
    // 1. Check for Boost Intent (passed via hacked job prop from JobCard)
    // JobCard sends a COPY with isBoosted=true. `jobs` state still has isBoosted=false (or true).

    // Check if valid boost request (passed=true, DB=false)
    const dbJob = jobs.find(j => j.id === job.id);
    const isBoostRequest = job.isBoosted === true && (!dbJob || dbJob.isBoosted !== true);

    if (isBoostRequest) {
      if (!confirm(language === 'en' ? `Boost this job for ₹20?\nIt will be pinned to the top of the feed for 24 hours.` : `इस जॉब को ₹20 में बूस्ट करें?\nयह 24 घंटे के लिए सबसे ऊपर दिखेगा।`)) return;

      try {
        const { checkWalletBalance } = await import('./services/paymentService');
        const { sufficient } = await checkWalletBalance(user.id, 20);

        if (!sufficient) {
          if (confirm(language === 'en' ? 'Insufficient balance (₹20 required). Add money to wallet?' : 'अपर्याप्त बैलेंस (₹20 आवश्यक)। वॉलेट में पैसे डालें?')) {
            setShowWalletRefill(true);
          }
          return;
        }

        const { error } = await supabase.rpc('boost_job', { p_job_id: job.id });
        if (error) throw error;

        showAlert(language === 'en' ? 'Job Boosted Successfully! 🚀' : 'जॉब सफलतापूर्वक बूस्ट किया गया! 🚀', 'success');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        await refreshJobs(); // Update UI

      } catch (e: any) {
        console.error(e);
        showAlert(e.message || 'Failed to boost job', 'error');
      }
      return;
    }

    // Normal Edit Logic
    if (job.bids.length > 0) { showAlert(t.alertCantEdit, 'error'); return; }
    // Navigate to post page with state to potentially populate it
    navigate('/post', { state: { jobToEdit: job } });
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      const result = await editMessage(messageId, newText);
      if (result.success) {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, text: newText }
            : m
        ));
      } else {
        showAlert('Failed to edit message', 'error');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      showAlert('Error editing message', 'error');
    }
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
        showAlert(t.jobCancelledRefunded, 'success');
        setSelectedJob(null);
        await refreshUser(); // Update wallet balance
      } else {
        showAlert(result.error || t.cancelError, 'error');
      }
    } catch (e) {
      console.error(e);
      showAlert(t.cancellationError, 'error');
    }
  };

  // Worker Payment Success Handler - Updates bid and opens chat
  const handleWorkerPaymentSuccess = async (paymentId: string) => {
    if (!workerPaymentModal.job || !workerPaymentModal.bidId) return;

    try {
      // 1. Update bid status in database
      const { error } = await supabase
        .from('bids')
        .update({ connection_payment_status: 'PAID' })
        .eq('id', workerPaymentModal.bidId);

      if (error) throw error;

      // 2. Refresh local state
      await refreshUser(); // Update balance

      showAlert(t.paymentSuccessChat, 'success');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);

      // 3. Open chat automatically
      handleChatOpen(workerPaymentModal.job);
    } catch (err: any) {
      console.error('Payment callback error:', err);
      showAlert('Payment recorded but failed to update status. Please contact support.', 'error');
    }
  };

  const handleWalletPaymentSuccess = async (paymentId: string, amount: number) => {
    // Balance is updated in DB by process_transaction in PaymentModal, 
    // but we update local state for instant feedback.
    setUser(prev => ({ ...prev, walletBalance: prev.walletBalance + amount }));
    showAlert(`₹${amount} added to your wallet!`, 'success');
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  // --- Views ---

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-green-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-gray-900 dark:text-white">
        <Loader2 size={32} className="text-emerald-600 dark:text-emerald-500 animate-spin mb-4" />
        <p className="text-emerald-700 dark:text-emerald-400 font-medium">{loadingMessage}</p>
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
    <div className="h-[100dvh] w-full bg-green-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-white flex flex-col overflow-hidden transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-30 shadow-sm flex-none transition-colors duration-300 pt-safe">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <MapPin size={24} className="text-emerald-600 dark:text-emerald-500" fill="#10b981" />
            <div><h1 className="text-xl font-bold text-emerald-900 dark:text-white leading-none">CHOWKAR</h1></div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/')} className={`text-sm font-bold ${location.pathname === '/' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>{t.navHome}</button>
            {role === UserRole.POSTER && (
              <button onClick={() => navigate('/post')} className={`text-sm font-bold ${location.pathname === '/post' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>{t.navPost}</button>
            )}
            <button onClick={() => navigate('/wallet')} className={`text-sm font-bold ${location.pathname === '/wallet' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>{t.navWallet}</button>
            <button onClick={() => navigate('/profile')} className={`text-sm font-bold ${location.pathname === '/profile' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>{t.navProfile}</button>
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')} className="p-2 text-emerald-800 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-900 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"><Languages size={18} /> {language === 'en' ? 'हि' : 'En'}</button>
            <button onClick={() => setShowChatList(true)} className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <MessageCircle size={20} className="text-gray-600 dark:text-gray-400" />
              {unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              data-notifications-button
              className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Bell size={20} className="text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
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
      <main className="flex-1 overflow-y-auto bg-green-50 dark:bg-gray-950 w-full relative transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full h-full">
          <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center bg-green-50/50 dark:bg-gray-950/50">
              <Loader2 size={32} className="text-emerald-600 dark:text-emerald-500 animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Home
                onBid={(id) => setBidModalOpen({ isOpen: true, jobId: id })}
                onViewBids={(j) => {
                  setViewBidsModal({ isOpen: true, job: j });
                  getJobWithFullDetails(j.id, true); // Proactively fetch latest
                }}
                onChat={handleChatOpen}
                onEdit={handleEditJobLink}
                onClick={(j) => {
                  setSelectedJob(j);
                  getJobWithFullDetails(j.id, true); // Proactively fetch latest
                }}
                onReplyToCounter={handleWorkerReplyToCounter}
                onWithdrawBid={handleWithdrawBid}
                setShowFilterModal={setShowFilterModal}
                showAlert={showAlert}
              />} />
              <Route path="/wallet" element={<WalletPage onShowBidHistory={() => setShowBidHistory(true)} onAddMoney={() => setShowWalletRefill(true)} />} />
              <Route path="/profile" element={<Profile onEditProfile={() => setShowEditProfile(true)} setShowSubscriptionModal={setShowSubscriptionModal} onLogout={handleLogout} />} />
              <Route path="/post" element={<PostJob />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <BottomNav />

      {/* --- Global Modals (Lazy Loaded) --- */}
      <Suspense fallback={null}>
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
          onViewProfile={(userId, name) => setProfileModal({ isOpen: true, userId, userName: name })}
        />

        <EditProfileModal
          isOpen={showEditProfile}
          onClose={() => setShowEditProfile(false)}
          showAlert={showAlert}
          isMandatory={isLoggedIn && (!user.phone || !user.location) && user.name !== 'Mock User'}
        />

        <ViewBidsModal
          isOpen={viewBidsModal.isOpen}
          onClose={() => { setViewBidsModal({ isOpen: false, job: null }); setActiveJobId(null); }}
          job={viewBidsModal.job}
          onCounter={(bidId, amount) => {
            setCounterModalOpen({ isOpen: true, bidId, jobId: viewBidsModal.job!.id, initialAmount: amount.toString() });
          }}
          showAlert={showAlert}
          onViewProfile={(userId, name) => setProfileModal({ isOpen: true, userId, userName: name })}
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
          onJobClick={async (job, notif) => {
            setShowNotifications(false);
            deleteNotification(notif.id);

            // SECURITY: Ensure we have full details (bids, etc.) for non-open jobs
            // Optimized feeds don't include bids, but we need them for chat/review logic

            let fullJob = job;
            // Always fetch full details if bids are missing (common for optimized high-performance feeds)
            if (fullJob.bids.length === 0 && (fullJob.bidCount || 0) > 0) {
              const fetched = await getJobWithFullDetails(job.id);
              if (fetched) fullJob = fetched;
            } else if (job.status !== 'OPEN' && job.bids.length === 0) {
              // Legacy fallback
              const fetched = await getJobWithFullDetails(job.id);
              if (fetched) fullJob = fetched;
            }

            setActiveJobId(fullJob.id);
            const title = (notif.title || "").toLowerCase();

            // Match SQL Trigger Titles: 
            // 'New Bid Received! 🔔', 'You Got the Job! 🎉', 'Counter Offer', 'Job Completed! 💰', 'Job Cancelled ⚠️'

            if (title.includes("worker ready") || title.includes("joined the chat")) {
              if (role === 'POSTER' && fullJob.posterId === user.id) {
                handleChatOpen(fullJob);
              } else {
                setSelectedJob(fullJob);
              }
            }
            else if (title.includes("new bid") || title.includes("bid received")) {
              if (role === 'POSTER' && fullJob.posterId === user.id) {
                setViewBidsModal({ isOpen: true, job: fullJob });
              } else {
                setSelectedJob(fullJob);
              }
            }
            else if (title.includes("counter")) {
              if (role === 'POSTER' && fullJob.posterId === user.id) {
                setViewBidsModal({ isOpen: true, job: fullJob });
              } else {
                setSelectedJob(fullJob);
              }
            }
            else if (title.includes("you got the job") || title.includes("accepted")) {
              if (fullJob.status === JobStatus.IN_PROGRESS) {
                handleChatOpen(fullJob);
              } else {
                setSelectedJob(fullJob);
              }
            }
            else if (title.includes("job completed") || title.includes("complete")) {
              const acceptedBid = fullJob.bids.find(b => b.id === fullJob.acceptedBidId);
              if (acceptedBid) {
                const isWorker = user.id === acceptedBid.workerId;
                const isPoster = user.id === fullJob.posterId;

                if (isWorker || isPoster) {
                  setReviewModalData({
                    isOpen: true,
                    revieweeId: isWorker ? fullJob.posterId : acceptedBid.workerId,
                    revieweeName: isWorker ? fullJob.posterName : acceptedBid.workerName,
                    jobId: fullJob.id
                  });
                }
              } else {
                handleChatOpen(fullJob);
              }
            }
            // ... apply fullJob to other blocks if needed, but let's do COMPLETED first
            else if (title.includes("review")) {
              navigate('/profile');
            }
            else if (title.includes("cancelled") || title.includes("not selected")) {
              setSelectedJob(job);
            }
            else if (job.status === JobStatus.IN_PROGRESS) {
              handleChatOpen(job);
            }
            else {
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
            onEditMessage={handleEditMessage}
            onIncomingMessage={(msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
            onMessageUpdate={handleMessageUpdate}
            isPremium={user.isPremium}
            remainingTries={user.isPremium ? 999 : (2 - (user.aiUsageCount || 0))}
          />
        )}

        <OnboardingModal
          isOpen={showOnboarding}
          onComplete={(selectedRole) => {
            setRole(selectedRole);
            localStorage.setItem('chowkar_onboarding_complete', 'true');
            setShowOnboarding(false);
            if (selectedRole === UserRole.POSTER) {
              navigate('/post');
            } else {
              navigate('/');
            }
          }}
        />

        <PaymentModal
          isOpen={workerPaymentModal.isOpen}
          onClose={() => setWorkerPaymentModal({ isOpen: false, job: null, bidId: null })}
          paymentType="CONNECTION"
          relatedJobId={workerPaymentModal.job?.id}
          relatedBidId={workerPaymentModal.bidId || undefined}
          onPaymentSuccess={handleWorkerPaymentSuccess}
          onPaymentFailure={(error) => showAlert(error || 'Payment failed', 'error')}
        />

        <UserProfileModal
          isOpen={profileModal.isOpen}
          userId={profileModal.userId}
          userName={profileModal.userName}
          onClose={() => setProfileModal({ isOpen: false, userId: '' })}
        />

        <PaymentModal
          isOpen={showWalletRefill}
          onClose={() => setShowWalletRefill(false)}
          paymentType="WALLET_REFILL"
          onPaymentSuccess={handleWalletPaymentSuccess}
          onPaymentFailure={(error) => showAlert(error || 'Payment failed', 'error')}
        />
      </Suspense>

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