import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatMessage, Coordinates, Job, JobStatus, UserRole } from './types';
import {
  MapPin, UserCircle, ArrowLeftRight, Bell, MessageCircle, Languages, Loader2, Briefcase, Menu, Search, X, Home as HomeIcon, Wallet, LayoutGrid, Plus
} from 'lucide-react';
import { supabase, waitForSupabase } from './lib/supabase';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Lazy loaded Pages ---
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const PostJob = lazy(() => import('./pages/PostJob').then(m => ({ default: m.PostJob })));

const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const WalletPage = lazy(() => import('./pages/WalletPage').then(m => ({ default: m.WalletPage })));
const CategoryJobs = lazy(() => import('./pages/CategoryJobs').then(m => ({ default: m.CategoryJobs })));

// --- Lazy loaded Components ---
const Confetti = lazy(() => import('./components/Confetti').then(m => ({ default: m.Confetti })));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
const ReviewModal = lazy(() => import('./components/ReviewModal').then(m => ({ default: m.ReviewModal })));
const BidModal = lazy(() => import('./components/BidModal').then(m => ({ default: m.BidModal })));
const JobDetailsModal = lazy(() => import('./components/JobDetailsModal').then(m => ({ default: m.JobDetailsModal })));
const EditProfileModal = lazy(() => import('./components/EditProfileModal').then(m => ({ default: m.EditProfileModal })));
const ViewBidsModal = lazy(() => import('./components/ViewBidsModal').then(m => ({ default: m.ViewBidsModal })));
const CounterModal = lazy(() => import('./components/CounterModal').then(m => ({ default: m.CounterModal })));
const BidHistoryModal = lazy(() => import('./components/BidHistoryModal').then(m => ({ default: m.BidHistoryModal })));
const NotificationsPanel = lazy(() => import('./components/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
const ChatListPanel = lazy(() => import('./components/ChatListPanel').then(m => ({ default: m.ChatListPanel })));
const SubscriptionModal = lazy(() => import('./components/SubscriptionModal').then(m => ({ default: m.SubscriptionModal })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const UserProfileModal = lazy(() => import('./components/UserProfileModal').then(m => ({ default: m.UserProfileModal })));

// Import Synchronous Components
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';

// Services
import { signInWithGoogle } from './services/authService';
import { useDeepLinkHandler } from './hooks/useDeepLinkHandler';
import { useJobActions } from './hooks/useJobActions';
import { useChatHandlers } from './hooks/useChatHandlers';
import { cancelJob } from './services/jobService';
import { setupPushListeners, removePushListeners, isPushSupported } from './services/pushService';
import { handleNotificationNavigation, parseNotificationData } from './services/notificationNavigationService';
import { editMessage } from './services/chatService';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const {
    user, setUser, role, setRole, language, setLanguage, isLoggedIn, setIsLoggedIn, isAuthLoading,
    loadingMessage, retryAuth,
    logout, t,
    showSubscriptionModal, setShowSubscriptionModal,
    showAlert, currentAlert, updateUserInDB, refreshUser,
    showEditProfile, setShowEditProfile
  } = useUser();

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debug Auth State
  useEffect(() => {
    console.log('[AppContent] Auth State:', { isLoggedIn, isAuthLoading, userId: user.id });
  }, [isLoggedIn, isAuthLoading, user.id]);

  const {
    notifications,
    addNotification,
    setActiveChatId,
    setActiveJobId,
    markNotificationsAsReadForJob,
    deleteNotification,
    clearNotificationsForJob
  } = useNotification();

  const { walletBalance, refreshWallet } = useWallet();
  const { completeJob, cancelJob, withdrawBid, replyToCounter, editJobLink } = useJobActions();


  const { jobs, updateJob, deleteJob, updateBid, getJobWithFullDetails, markJobAsReviewed, refreshJobs, loading, searchQuery, setSearchQuery } = useJobs();
  const navigate = useNavigate();
  const location = useLocation();

  // --- Deep Linking Logic ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkedJobId = params.get('jobId');
    const linkedAction = params.get('action'); // 'view', 'bid', 'chat'

    if (linkedJobId && !loading && jobs.length > 0) {
      console.log('[DeepLink] Found jobId in URL:', linkedJobId, linkedAction);

      const processLink = async () => {
        // 1. Try finding in current feed
        let job = jobs.find(j => j.id === linkedJobId);

        // 2. If not found, fetch it specifically
        if (!job) {
          console.log('[DeepLink] Job not in feed, fetching...', linkedJobId);
          job = await getJobWithFullDetails(linkedJobId, true);
        }

        if (job) {
          // Remove param from URL without reload
          window.history.replaceState({}, '', window.location.pathname);

          // Open appropriate modal
          if (linkedAction === 'chat') {
            handleChatOpen(job);
          } else if (linkedAction === 'bid') {
            setBidModalOpen({ isOpen: true, jobId: job.id });
          } else {
            setSelectedJob(job);
          }
        }
      };

      processLink();
    }
  }, [location.search, loading, jobs.length]);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- UI State ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false); // Used in Home Page

  const {
    chatState, openChat, closeChat,
    sendMessage, updateMessage,
    editMessage, deleteMessage, translateMessage
  } = useChatHandlers(setShowEditProfile, setShowChatList);

  // --- Global Modals State ---
  const [selectedJob, setSelectedJob] = useState<Job | null>(null); // Modal & UI State
  // const [chatOpen, setChatOpen] = useState<{ isOpen: boolean, job: Job | null, receiverId?: string }>({ isOpen: false, job: null }); // REPLACED BY HOOK
  const [bidModalOpen, setBidModalOpen] = useState<{ isOpen: boolean; jobId: string | null }>({ isOpen: false, jobId: null });
  const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean, revieweeId: string, revieweeName: string, jobId: string } | null>(null);
  const [viewBidsModal, setViewBidsModal] = useState<{ isOpen: boolean; job: Job | null }>({ isOpen: false, job: null });
  const [counterModalOpen, setCounterModalOpen] = useState<{ isOpen: boolean; bidId: string | null; jobId: string | null; initialAmount: string }>({ isOpen: false, bidId: null, jobId: null, initialAmount: '' });
  // User Profile Modal State
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; userId: string; userName?: string; phoneNumber?: string }>({ isOpen: false, userId: '' });

  // --- UI State ---


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
          openChat(job);
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
    closeChat();
    setActiveChatId(null);
    setActiveJobId(null);
    setShowChatList(false);
    setShowNotifications(false);
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

  // --- Memoized Handlers for Performance ---
  const handleOnBid = useCallback((id: string) => {
    // CRITICAL: Prevent action if user session is invalid (Zombie state protection)
    if (!user.id) {
      console.warn('Attempted to bid without valid user ID');
      return;
    }

    if (!user.phone || !user.location || user.location === 'Not set') {
      setShowEditProfile(true);
      showAlert(language === 'en'
        ? 'Please complete your profile (Phone & Location) before bidding.'
        : 'बोली लगाने से पहले कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
      return;
    }
    setBidModalOpen({ isOpen: true, jobId: id });
  }, [user.id, user.phone, user.location, language, showAlert, setShowEditProfile]);

  const handleOnViewBids = useCallback((j: Job) => {
    console.log('[App] onViewBids handler called', j.id);
    try {
      setViewBidsModal({ isOpen: true, job: j });
      getJobWithFullDetails(j.id, true);
    } catch (err) {
      console.error('[App] Error in onViewBids handler', err);
    }
  }, [getJobWithFullDetails]);

  const handleCardClick = useCallback((j: Job) => {
    setSelectedJob(j);
    getJobWithFullDetails(j.id, true); // Proactively fetch latest
  }, [getJobWithFullDetails]);

  const handleLogout = async () => { await logout(); };

  // --- Handlers Replaced by Hooks ---
  // handleChatOpen, handleSendMessage, etc. are now in useChatHandlers
  const handleMessageUpdate = (updatedMsg: ChatMessage) => {
    updateMessage(updatedMsg);
  };

  // Kept for prop drilling
  const handleChatOpen = (job: Job, receiverId?: string) => openChat(job, receiverId);

  const handleCompleteJob = async (job?: Job) => {
    const currentJob = job || selectedJob;
    if (!currentJob) return;

    // 1. If job is already completed, just handle the review part
    if (currentJob.status === JobStatus.COMPLETED) {
      if (currentJob.hasMyReview) {
        showAlert(language === 'en' ? 'You have already reviewed this user.' : 'आप पहले ही समीक्षा दे चुके हैं।', 'info');
        return;
      }

      const acceptedBid = currentJob.bids.find(b => b.id === currentJob.acceptedBidId);
      if (acceptedBid) {
        setReviewModalData({
          isOpen: true,
          revieweeId: role === UserRole.POSTER ? acceptedBid.workerId : currentJob.posterId,
          revieweeName: role === UserRole.POSTER ? acceptedBid.workerName : currentJob.posterName,
          jobId: currentJob.id
        });
      } else {
        showAlert('No worker found to review.', 'error');
      }
      return;
    }

    // 2. Normal completion flow for IN_PROGRESS jobs
    if (!confirm(t.completeJobPrompt)) return;

    const success = await completeJob(currentJob, (reviewData) => {
      setReviewModalData(reviewData);
    });

    if (success) {
      closeChat();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  const handleWorkerReplyToCounter = async (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => {
    await replyToCounter(jobId, bidId, action, amount);
  };

  const handleWithdrawBid = async (jobId: string, bidId: string) => {
    await withdrawBid(jobId, bidId);
  };

  const handleEditJobLink = async (job: Job) => {
    editJobLink(job);
  };

  const handleCancelJob = async (jobId: string) => {
    setSelectedJob(null);
    await cancelJob(jobId);
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
      {/* Header - Amazon/Super App Style */}
      {/* Hide header on specific mobile pages to avoid "Double Header", but keep it on Desktop for "Super App" feel */}
      {(!['/wallet', '/profile', '/post', '/chat'].some(path => location.pathname.startsWith(path)) || isDesktop) && (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-50 shadow-sm pt-safe sticky top-0">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">

            {/* 1. Left Cluster: Identity & Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                title="Menu"
              >
                <Menu size={24} />
              </button>

              {role === UserRole.WORKER && (
                <button
                  onClick={() => navigate('/')}
                  className={`hidden md:flex items-center gap-2 p-2.5 rounded-xl transition-all active:scale-95 group ${location.pathname === '/'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    }`}
                  title="Dashboard"
                >
                  <HomeIcon size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>

            {/* 2. Center Cluster: Discovery Area */}
            <div className="flex-1 max-w-xl relative mx-4 group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder={role === UserRole.WORKER
                  ? (language === 'en' ? "Search for work near you..." : "अपने आस-पास काम खोजें...")
                  : (language === 'en' ? "Search your job posts..." : "अपनी पोस्ट खोजें...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl pl-10 pr-10 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 3. Right Cluster: Service & Social Feed */}
            <div className="flex items-center gap-1.5">
              {role === UserRole.WORKER && (
                <div className="hidden md:flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => navigate('/find')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${location.pathname === '/find'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-500/20'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-emerald-700 dark:hover:bg-emerald-50'
                      }`}
                  >
                    <Search size={16} strokeWidth={3} />
                    {language === 'en' ? 'Find Work' : 'काम खोजें'}
                  </button>

                  <button
                    onClick={() => navigate('/wallet')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${location.pathname === '/wallet'
                      ? 'bg-emerald-50 active:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <Wallet size={18} strokeWidth={2.5} />
                    <span>{language === 'en' ? 'Wallet' : 'वॉलेट'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/profile')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${location.pathname === '/profile'
                      ? 'bg-emerald-50 active:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <UserCircle size={18} strokeWidth={2.5} />
                    <span>{t.profile}</span>
                  </button>
                </div>
              )}

              {role === UserRole.POSTER && (
                <div className="hidden md:flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => navigate('/post')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${location.pathname === '/post'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-500/20'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-emerald-700 dark:hover:bg-emerald-50'
                      }`}
                  >
                    <Plus size={16} strokeWidth={3} />
                    {language === 'en' ? 'Post Job' : 'नया काम'}
                  </button>

                  <button
                    onClick={() => navigate('/')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${location.pathname === '/'
                      ? 'bg-emerald-50 active:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <LayoutGrid size={18} strokeWidth={2.5} />
                    <span>{language === 'en' ? 'Dashboard' : 'डैशबोर्ड'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/wallet')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${location.pathname === '/wallet'
                      ? 'bg-emerald-50 active:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <Wallet size={18} strokeWidth={2.5} />
                    <span>{language === 'en' ? 'Wallet' : 'वॉलेट'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/profile')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${location.pathname === '/profile'
                      ? 'bg-emerald-50 active:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <UserCircle size={18} strokeWidth={2.5} />
                    <span>{t.profile}</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowChatList(true)}
                className={`p-2.5 rounded-xl transition-all relative group ${showChatList || chatState.isOpen
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                title="Chats"
              >
                <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
                {unreadChatCount > 0 && (
                  <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 ${showChatList || chatState.isOpen ? 'bg-white border-emerald-600' : 'bg-emerald-500 border-white dark:border-gray-900'
                    }`} />
                )}
              </button>

              <button
                onClick={() => setShowNotifications(true)}
                className={`p-2.5 rounded-xl transition-all relative group ${showNotifications
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                title="Notifications"
              >
                <Bell size={24} className="group-hover:scale-110 transition-transform" />
                {unreadCount > 0 && (
                  <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 ${showNotifications ? 'bg-white border-emerald-600' : 'bg-red-500 border-white dark:border-gray-900'
                    }`} />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Sidebar Drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLanguageToggle={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
        onLogout={handleLogout}
      />

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
              onBid={handleOnBid}
              onViewBids={handleOnViewBids}
              onChat={handleChatOpen}
              onEdit={handleEditJobLink}
              onClick={handleCardClick}
              onReplyToCounter={handleWorkerReplyToCounter}
              onWithdrawBid={handleWithdrawBid}
              setShowFilterModal={setShowFilterModal}
              showAlert={showAlert}
            />} />
            <Route path="/find" element={<Home
              onBid={handleOnBid}
              onViewBids={handleOnViewBids}
              onChat={handleChatOpen}
              onEdit={handleEditJobLink}
              onClick={handleCardClick}
              onReplyToCounter={handleWorkerReplyToCounter}
              onWithdrawBid={handleWithdrawBid}
              setShowFilterModal={setShowFilterModal}
              showAlert={showAlert}
            />} />
            <Route path="/profile" element={<Profile setShowSubscriptionModal={setShowSubscriptionModal} onLogout={handleLogout} />} />
            <Route path="/post" element={<PostJob />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/category/:categoryId" element={<CategoryJobs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <BottomNav
        unreadChatCount={unreadChatCount}
        walletBalance={walletBalance}
        onChatClick={() => setShowChatList(true)}
        onTabChange={() => {
          setShowChatList(false);
          setShowNotifications(false);
          closeChat();
        }}
      />

      {/* --- MODALS --- */}
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
          onViewProfile={(userId, name, phoneNumber) => setProfileModal({ isOpen: true, userId, userName: name, phoneNumber })}
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

            // Refactored to use reviewService for safety
            const { submitReview } = await import('./services/reviewService');
            const { success, error } = await submitReview(
              user.id,
              reviewModalData.revieweeId,
              reviewModalData.jobId,
              rating,
              comment
            );

            if (success) {
              // Determine user language for notification
              const msg = language === 'en'
                ? `You received a ${rating} star review!`
                : `आपको ${rating} स्टार की समीक्षा मिली!`;

              await addNotification(reviewModalData.revieweeId, "New Review", msg, "SUCCESS");

              // REFRESH: Immediately refetch this job to update hasMyReview status
              await getJobWithFullDetails(reviewModalData.jobId, true);

              // OPTIMISTIC: Manually mark as reviewed in case refetch is slow
              markJobAsReviewed(reviewModalData.jobId);

              setReviewModalData(null);
              showAlert(t.reviewSubmitted, 'success');
            } else {
              showAlert(error || 'Failed to submit review', 'error');
            }
          }}
          revieweeName={reviewModalData?.revieweeName || ''}
        />

        {/* Chat Interface */}
        {chatState.isOpen && chatState.job && (
          <Suspense fallback={null}>
            <ChatInterface
              jobId={chatState.job.id}
              onClose={closeChat}
              onSendMessage={sendMessage}

              currentUser={user}
              onTranslateMessage={translateMessage}
              onCompleteJob={(job) => completeJob(job, setReviewModalData)}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              receiverId={chatState.receiverId}
              isPremium={user.isPremium}
              remainingTries={user.isPremium ? 999 : (2 - (user.aiUsageCount || 0))}
            />
          </Suspense>
        )}




        <UserProfileModal
          isOpen={profileModal.isOpen}
          userId={profileModal.userId}
          userName={profileModal.userName}
          phoneNumber={profileModal.phoneNumber}
          onClose={() => setProfileModal({ isOpen: false, userId: '' })}
        />

        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
        />

      </Suspense>

    </div >
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LanguageProvider>
          <ToastProvider>
            <UserProvider>
              <WalletProvider>
                <NotificationProvider>
                  <JobProvider>
                    <ThemeProvider>
                      <AppContent />
                    </ThemeProvider>
                  </JobProvider>
                </NotificationProvider>
              </WalletProvider>
            </UserProvider>
          </ToastProvider>
        </LanguageProvider>
      </Router>
    </ErrorBoundary>
  );
};