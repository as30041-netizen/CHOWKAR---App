import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { ChatMessage, Coordinates, Job, JobStatus, UserRole } from './types';
import {
  MapPin, UserCircle, ArrowLeftRight, Bell, MessageCircle, Languages, Loader2
} from 'lucide-react';
import { supabase, waitForSupabase } from './lib/supabase';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Lazy loaded Pages ---
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const PostJob = lazy(() => import('./pages/PostJob').then(m => ({ default: m.PostJob })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));

// --- Lazy loaded Components ---
const Confetti = lazy(() => import('./components/Confetti').then(m => ({ default: m.Confetti })));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
const ReviewModal = lazy(() => import('./components/ReviewModal').then(m => ({ default: m.ReviewModal })));
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
import { signInWithGoogle } from './services/authService';
import { useDeepLinkHandler } from './hooks/useDeepLinkHandler';
import { cancelJob } from './services/jobService';
import { setupPushListeners, removePushListeners, isPushSupported } from './services/pushService';
import { handleNotificationNavigation, parseNotificationData } from './services/notificationNavigationService';
import { editMessage } from './services/chatService';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    notifications, messages, setMessages,
    addNotification, logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB, refreshUser, setActiveChatId,
    markNotificationsAsReadForJob, setActiveJobId, deleteNotification, clearNotificationsForJob,
    showEditProfile, setShowEditProfile
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
  const [showFilterModal, setShowFilterModal] = useState(false); // Used in Home Page

  // --- Global Modals State ---
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [chatOpen, setChatOpen] = useState<{ isOpen: boolean; job: Job | null; receiverId?: string }>({ isOpen: false, job: null });
  const [bidModalOpen, setBidModalOpen] = useState<{ isOpen: boolean; jobId: string | null }>({ isOpen: false, jobId: null });
  const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean, revieweeId: string, revieweeName: string, jobId: string } | null>(null);
  const [viewBidsModal, setViewBidsModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [counterModalOpen, setCounterModalOpen] = useState<{ isOpen: boolean; bidId: string | null; jobId: string | null; initialAmount: string }>({ isOpen: false, bidId: null, jobId: null, initialAmount: '' });
  // User Profile Modal State
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; userId: string; userName?: string }>({ isOpen: false, userId: '' });

  // --- UI State ---

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

      // 2. Profile Completion (Phone/Location) - Show if essential fields missing
      // Don't auto-show unless we are sure they are missing. 



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

  // Count chats with unread messages (only for IN_PROGRESS or COMPLETED jobs)
  // Note: Chat notification titles are "{SenderName} 💬" from the SQL trigger
  const unreadChatCount = notifications.filter(n =>
    n.userId === user.id &&
    !n.read &&
    (n.title?.includes('💬') || n.title?.toLowerCase().includes('message')) && // Match chat notifications
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
    // 0. CHECK PROFILE COMPLETION (Source of Truth)
    if (!user.phone || !user.location || user.location === 'Not set') {
      setShowEditProfile(true);
      showAlert(language === 'en'
        ? 'Please complete your profile (Phone & Location) to start chatting.'
        : 'चैटिंग शुरू करने के लिए कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
      return;
    }

    // 1. SURGICAL LOADING: If this job came from a lightweight feed (no bids), fetch full details
    let jobWithBids = job;
    if (job.bids.length === 0 || (job.acceptedBidId && !job.bids.find(b => b.id === job.acceptedBidId))) {
      const fetched = await getJobWithFullDetails(job.id);
      if (fetched) jobWithBids = fetched;
    }

    // 2. CHECK STATUS
    const isHired = jobWithBids.status === JobStatus.IN_PROGRESS || jobWithBids.status === JobStatus.COMPLETED;
    const acceptedBid = jobWithBids.bids.find(b => b.id === jobWithBids.acceptedBidId);

    // VALIDATE: Chat only for IN_PROGRESS or COMPLETED jobs
    if (!isHired) {
      showAlert(language === 'en'
        ? 'Chat is only available after you hire a worker'
        : 'चैट केवल कामगार को नियुक्त करने के बाद ही उपलब्ध है', 'info');
      return;
    }

    // 3. VALIDATE PARTICIPANT: Only poster or accepted worker can chat
    const isParticipant = user.id === jobWithBids.posterId || user.id === acceptedBid?.workerId;

    if (!isParticipant) {
      showAlert(language === 'en'
        ? 'You are not a participant in this job'
        : 'आप इस जॉब में भागीदार नहीं हैं', 'error');
      return;
    }

    // Open chat immediately - no payment required
    setChatOpen({ isOpen: true, job: jobWithBids, receiverId });
    setActiveChatId(jobWithBids.id);
    setActiveJobId(jobWithBids.id);
    markNotificationsAsReadForJob(jobWithBids.id);
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
      const acceptedBid = job.bids?.find(b => b.id === job.acceptedBidId);
      const agreedBid = job.bids?.find(b => b.negotiationHistory?.some((h: any) => h.agreed));

      if (isPoster) {
        receiverId = acceptedBid?.workerId || agreedBid?.workerId;
      } else {
        receiverId = job.posterId;
      }
    }

    // Failsafe for Worker roles
    if (!receiverId && !isPoster) {
      receiverId = job.posterId;
      console.log('[Chat] Using job.posterId as failsafe receiverId');
    }

    if (!receiverId) {
      console.error('Cannot determine chat receiver', { isPoster, jobId: job.id });
      showAlert('Could not find receiver. Please refresh.', 'error');
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
      const { data, error } = await waitForSupabase(async () => {
        return await supabase
          .from('chat_messages')
          .insert({
            job_id: msg.jobId,
            sender_id: msg.senderId,
            receiver_id: receiverId,
            text: msg.text
          })
          .select()
          .single();
      });

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

  const handleCompleteJob = async (job?: Job) => {
    // Allow passing job explicitly (from JobDetailsModal) or use chatOpen.job (from ChatInterface)
    const currentJob = job || chatOpen.job;
    if (!currentJob) {
      console.error('[App] handleCompleteJob: No job provided');
      return;
    }

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
        // NEW FLOW: Worker AGREES to poster's terms, but Poster must Finalize
        // This prevents the job from immediately moving to IN_PROGRESS without poster's final check

        const updatedBid = {
          ...bid,
          status: 'PENDING' as const,
          negotiationHistory: [...(bid.negotiationHistory || []), {
            amount: bid.amount,
            by: UserRole.WORKER,
            timestamp: Date.now(),
            agreed: true
          }]
        };

        await updateBid(updatedBid);

        // Notify Poster (DB trigger will also likely fire when bid is updated)
        showAlert(t.waitingForPosterFinalize || "Offer accepted! Waiting for Employer to finalize.", 'success');

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
      if (!bid) return;

      // Persist withdrawal to DB by marking as REJECTED (using RPC for safety)
      const { safeRPC } = await import('./lib/supabase');
      const { data, error } = await safeRPC('withdraw_from_job', { p_job_id: jobId, p_bid_id: bidId });

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.error || 'Failed to withdraw bid');
      }

      // Local update (Optimistic)
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
    // Normal Edit Logic
    if (job.bids.length > 0) {
      showAlert(t.alertCantEdit, 'error');
      return;
    }
    // Navigate to post page with state to potentially populate it
    navigate('/post', { state: { jobToEdit: job } });
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      setSelectedJob(null); // Close modal immediately

      const result = await cancelJob(jobId);

      if (result.success) {
        showAlert(t.jobCancelledRefunded || 'Job cancelled successfully.', 'success');
        // Refresh jobs to update the UI
        await refreshJobs(user.id);
      } else {
        showAlert(result.error || 'Failed to cancel job', 'error');
      }
    } catch (error: any) {
      console.error('[App] Cancel job error:', error);
      showAlert(`${t.cancellationError || 'Error during cancellation'}: ${error.message || 'Unknown error'}`, 'error');
    }
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
      // Use service function for direct update (triggering Realtime UPDATE event)
      // The RPC 'soft_delete_chat_message' currently performs a HARD DELETE which breaks sync
      const { deleteMessage } = await import('./services/chatService');
      const result = await deleteMessage(messageId);

      if (result.success) {
        // Optimistic UI update
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, text: 'This message was deleted', translatedText: undefined, isDeleted: true }
            : m
        ));
      } else {
        console.error('Failed to delete message:', result.error);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
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

  // CRITICAL FIX: Also show landing if isLoggedIn but user.id is empty (stale localStorage, session expired)
  // This prevents the "blank user" bug where main UI shows without a valid session
  if (!isLoggedIn || !user.id) {
    // If localStorage thinks we're logged in but session isn't ready, show a brief loading state
    if (isLoggedIn && !user.id) {
      return (
        <div className="min-h-screen bg-green-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-gray-900 dark:text-white">
          <Loader2 size={32} className="text-emerald-600 dark:text-emerald-500 animate-spin mb-4" />
          <p className="text-emerald-700 dark:text-emerald-400 font-medium">{t.loading}</p>
        </div>
      );
    }

    return (
      <Suspense fallback={
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-green-50 dark:bg-gray-950 transition-colors duration-300">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-600 rounded-full animate-spin"></div>
            <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600 animate-pulse" size={24} />
          </div>
          <p className="mt-4 text-emerald-800 dark:text-emerald-400 font-bold animate-pulse">{t.loading}</p>
        </div>
      }>
        <LandingPage
          onGetStarted={handleGoogleSignIn}
          language={language}
          onLanguageToggle={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
          isSigningIn={isSigningIn}
        />
      </Suspense>
    );
  }


  // --- Main Layout ---
  return (
    <div className="h-[100dvh] w-full bg-green-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-white flex flex-col overflow-hidden transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 z-30 shadow-glass flex-none transition-all duration-300 pt-safe sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-transform">
              <MapPin size={22} className="text-white" fill="rgba(255,255,255,0.2)" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">CHOWKAR</h1>
              <div className="h-1 w-6 bg-emerald-500 rounded-full mt-1 group-hover:w-10 transition-all" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-10">
            {[
              { path: '/', label: t.navHome },
              { path: '/post', label: t.navPost, role: UserRole.POSTER },
              { path: '/profile', label: t.navProfile }
            ].map((link) => {
              if (link.role && role !== link.role) return null;
              const active = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    if (link.path === '/post' && (!user.phone || !user.location || user.location === 'Not set')) {
                      setShowEditProfile(true);
                      showAlert(language === 'en'
                        ? 'Please complete your profile (Phone & Location) before posting a job.'
                        : 'काम पोस्ट करने से पहले कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
                      return;
                    }
                    navigate(link.path);
                  }}
                  className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all relative group ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {link.label}
                  <span className={`absolute -bottom-2 left-0 h-1 bg-emerald-500 rounded-full transition-all ${active ? 'w-full' : 'w-0 group-hover:w-1/2'}`} />
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
              className="px-4 py-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/20 hover:scale-105 transition-all flex items-center gap-2 shadow-sm"
            >
              <Languages size={15} strokeWidth={2.5} /> {language === 'en' ? 'हिन्दी' : 'English'}
            </button>
            <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1 hidden sm:block" />
            <button
              onClick={() => setShowChatList(true)}
              className="relative p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90"
            >
              <MessageCircle size={22} className="text-gray-600 dark:text-gray-400" strokeWidth={2} />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-[0_0_10px_rgba(16,185,129,0.5)] border-2 border-white dark:border-gray-900">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              data-notifications-button
              className="relative p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90"
            >
              <Bell size={22} className="text-gray-600 dark:text-gray-400" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-[0_0_10px_rgba(239,68,68,0.5)] border-2 border-white dark:border-gray-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {showConfetti && <Confetti />}
      {/* Premium Alerts */}
      {showConfetti && <Confetti />}
      {currentAlert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-slide-down pointer-events-none">
          <div className={`px-8 py-4 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.1)] font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 backdrop-blur-xl border ${currentAlert.type === 'error' ? 'bg-red-500/90 text-white border-red-400/50' : currentAlert.type === 'success' ? 'bg-emerald-600/90 text-white border-emerald-500/50' : 'bg-gray-900/90 text-white border-gray-700/50'} `}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${currentAlert.type === 'error' ? 'bg-red-200' : currentAlert.type === 'success' ? 'bg-emerald-200' : 'bg-gray-400'}`} />
            {currentAlert.message}
          </div>
        </div>
      )}

      {/* Router View */}
      <main className="flex-1 overflow-y-auto bg-green-50 dark:bg-gray-950 w-full relative transition-colors duration-300">
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center bg-green-50/50 dark:bg-gray-950/50">
            <Loader2 size={32} className="text-emerald-600 dark:text-emerald-500 animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home
              onBid={(id) => {
                if (!user.phone || !user.location || user.location === 'Not set') {
                  setShowEditProfile(true);
                  showAlert(language === 'en'
                    ? 'Please complete your profile (Phone & Location) before bidding.'
                    : 'बोली लगाने से पहले कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
                  return;
                }
                setBidModalOpen({ isOpen: true, jobId: id });
              }}
              onViewBids={(j) => {
                console.log('[App] onViewBids handler called', j.id);
                try {
                  setViewBidsModal({ isOpen: true, job: j });
                  getJobWithFullDetails(j.id, true);
                } catch (err) {
                  console.error('[App] Error in onViewBids handler', err);
                }
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
            <Route path="/profile" element={<Profile setShowSubscriptionModal={setShowSubscriptionModal} onLogout={handleLogout} />} />
            <Route path="/post" element={<PostJob />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
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
            // Optimistic UI update: Close modal immediately
            setSelectedJob(null);

            try {
              const result = await deleteJob(jobId) as any;
              if (result && result.success) {
                showAlert(t.alertJobDeleted, 'success');
              } else {
                showAlert(result?.error || 'Failed to delete job', 'error');
              }
            } catch (error: any) {
              showAlert(error.message || 'Failed to delete job', 'error');
            }
          }}
          showAlert={showAlert}
          onReplyToCounter={handleWorkerReplyToCounter}
          onViewProfile={(userId, name) => setProfileModal({ isOpen: true, userId, userName: name })}
          onCompleteJob={handleCompleteJob}
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
                // Identify the specific worker who agreed
                const agreedBid = fullJob.bids.find(b => b.negotiationHistory?.some((h: any) => h.agreed));
                const workerId = agreedBid?.workerId;
                handleChatOpen(fullJob, workerId);
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
            onBackToMessages={() => {
              setChatOpen({ isOpen: false, job: null });
              setActiveChatId(null);
              setActiveJobId(null);
              setShowChatList(true); // Reopen Messages panel
            }}
            messages={messages.filter(m => m.jobId === chatOpen.job?.id)}
            onSendMessage={handleSendMessage}
            onCompleteJob={handleCompleteJob}
            onTranslateMessage={handleTranslateMessage}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onIncomingMessage={(msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
            onMessageUpdate={handleMessageUpdate}
            receiverId={chatOpen.receiverId}
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


        <UserProfileModal
          isOpen={profileModal.isOpen}
          userId={profileModal.userId}
          userName={profileModal.userName}
          onClose={() => setProfileModal({ isOpen: false, userId: '' })}
        />

      </Suspense>

    </div >
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserProvider>
          <JobProvider>
            <AppContent />
          </JobProvider>
        </UserProvider>
      </Router>
    </ErrorBoundary>
  );
};