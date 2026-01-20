import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContextDB';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { JobProvider, useJobs } from './contexts/JobContextDB';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { Job } from './types';
import {
  Loader2, Menu
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

// Contexts & Hooks
import { ModalProvider, useModals } from './contexts/ModalContext';
import { GlobalModals } from './components/GlobalModals';
import { useJobActions } from './hooks/useJobActions';
import { useKeyboard } from './hooks/useKeyboard';
import { useDeepLinkHandler } from './hooks/useDeepLinkHandler';

// Services
import { signInWithGoogle } from './services/authService';

// Lazy Pages
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const PostJob = lazy(() => import('./pages/PostJob').then(m => ({ default: m.PostJob })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const WalletPage = lazy(() => import('./pages/WalletPage').then(m => ({ default: m.WalletPage })));
const CategoryJobs = lazy(() => import('./pages/CategoryJobs').then(m => ({ default: m.CategoryJobs })));
const JobPage = lazy(() => import('./pages/JobPage').then(m => ({ default: m.JobPage })));

// Components
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const MobileWelcome = lazy(() => import('./components/MobileWelcome').then(m => ({ default: m.MobileWelcome })));

import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';

const AppContent: React.FC = () => {
  const {
    user, isLoggedIn, isAuthLoading, loadingMessage,
    showEditProfile, setShowEditProfile,
    language, setLanguage, setIsLoggedIn
  } = useUser();

  const {
    handleCompleteJob, handleCancelJob, handleWithdrawBid, handleWorkerReplyToCounter, handleEditJobLink
  } = useJobActions();

  const {
    selectedJob, openBidModal, openViewBids, openChat, openProfileModal, openReviewModal,
    openFilterModal, showSubscription, openJobDetails,
  } = useModals();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useKeyboard();
  useDeepLinkHandler();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handlers for Child Components (Adapters)
  const handleOnBid = useCallback((jobId: string) => openBidModal(jobId), [openBidModal]);
  const handleOnViewBids = useCallback((job: Job) => openViewBids(job), [openViewBids]);
  const handleChatOpen = useCallback((job: Job) => openChat(job), [openChat]);
  const handleCardClick = useCallback((job: Job) => openJobDetails(job), [openJobDetails]);
  const handleEditProfile = useCallback(() => setShowEditProfile(true), [setShowEditProfile]);

  const handleLogin = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle();
      // signInWithGoogle usually handles redirect or session update.
      // If it returns, we assume success or check result.
      // For now, rely on UserContext updates via Supabase listener.
    } catch (e) {
      console.error('Login failed', e);
    } finally {
      setIsSigningIn(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(l => l === 'en' ? 'hi' : l === 'hi' ? 'pa' : 'en');
  };

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400 animate-pulse">{loadingMessage || 'Initializing...'}</p>
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-20 md:pb-0">

      {/* Mobile Header (Inline) */}
      {!isDesktop && isLoggedIn && (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 shadow-sm z-40 flex items-center px-4 justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-bold text-xl text-primary">Chowkar</div>
          <div className="w-8" />
        </header>
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`main-content ${isLoggedIn && !isDesktop ? 'pt-16' : ''}`}>
        <Suspense fallback={<div className="p-4 flex justify-center"><Loader2 className="animate-spin" /></div>}>
          <Routes>
            {/* Public Routes */}
            {!isLoggedIn && (
              <>
                <Route path="/" element={
                  !isDesktop ? (
                    <MobileWelcome
                      onGetStarted={handleLogin}
                      isSigningIn={isSigningIn}
                      language={language as any}
                      onLanguageToggle={toggleLanguage}
                    />
                  ) : (
                    <LandingPage
                      onGetStarted={handleLogin}
                      isSigningIn={isSigningIn}
                      language={language as any}
                      onLanguageToggle={toggleLanguage}
                    />
                  )
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}

            {/* Private Routes */}
            {isLoggedIn && (
              <>
                <Route path="/" element={<Home
                  onBid={handleOnBid}
                  onViewBids={handleOnViewBids}
                  onChat={handleChatOpen}
                  onEdit={handleEditJobLink}
                  onClick={handleCardClick}
                  onReplyToCounter={handleWorkerReplyToCounter}
                  onWithdrawBid={handleWithdrawBid}
                  setShowFilterModal={openFilterModal}
                />} />
                <Route path="/jobs" element={<JobPage />} />
                <Route path="/post" element={<PostJob />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/category/:category" element={<CategoryJobs
                  onBid={handleOnBid}
                  onClick={handleCardClick}
                />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </Suspense>
      </div>

      {/* Global Modals Container - Handles all Popups */}
      <GlobalModals />

      {isLoggedIn && !isDesktop && <BottomNav />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <LoadingProvider>
            <ToastProvider>
              <UserProvider>
                <NotificationProvider>
                  <WalletProvider>
                    <JobProvider>
                      <ModalProvider>
                        <Router>
                          <AppContent />
                        </Router>
                      </ModalProvider>
                    </JobProvider>
                  </WalletProvider>
                </NotificationProvider>
              </UserProvider>
            </ToastProvider>
          </LoadingProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
