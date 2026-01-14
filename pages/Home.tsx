import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { JobCard } from '../components/JobCard';
// Lazy load map to avoid loading Leaflet until needed
const JobMap = React.lazy(() => import('../components/JobMap').then(m => ({ default: m.JobMap })));
import { JobCardSkeleton } from '../components/Skeleton';
import { Job, UserRole, JobStatus } from '../types';
import { calculateDistance } from '../utils/geo';
import { CATEGORIES, CATEGORY_TRANSLATIONS } from '../constants';
import {
    Briefcase, RotateCw, Loader2, ArrowUpDown, Plus,
    Sparkles, MapPin, Zap, Clock, History, LayoutDashboard,
    ChevronRight, ArrowRight, Bell, Star, XCircle, Map as MapIcon, List as ListIcon,
    Search, Mic, MicOff, SlidersHorizontal, LayoutGrid, Filter, IndianRupee, Calendar, CheckCircle2, X, MessageCircle, AlertCircle
} from 'lucide-react';
import { FilterModal } from '../components/FilterModal';
import { useNavigate } from 'react-router-dom';

type SortOption = 'NEWEST' | 'BUDGET_HIGH' | 'BUDGET_LOW' | 'NEAREST';

interface HomeProps {
    onBid: (jobId: string) => void;
    onViewBids: (job: Job) => void;
    onChat: (job: Job) => void;
    onEdit: (job: Job) => void;
    onClick: (job: Job) => void;
    onReplyToCounter: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
    onWithdrawBid: (jobId: string, bidId: string) => void;
    setShowFilterModal: (show: boolean) => void;
    showAlert: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

import { useNotification } from '../contexts/NotificationContext';

export const Home: React.FC<HomeProps> = ({
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid,
    setShowFilterModal: _setShowFilterModal, showAlert
}) => {
    const { user, role, setRole, t, language, isAuthLoading } = useUser();
    const { notifications } = useNotification();
    const { jobs, loading, isRevalidating, refreshJobs, fetchMoreJobs, hasMore, isLoadingMore, loadFeed, hideJob, error: jobsError } = useJobs();
    const [posterTab, setPosterTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

    const [dashboardTab, setDashboardTab] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
    const [workerTab, setWorkerTab] = useState<'FIND' | 'ACTIVE' | 'HISTORY'>('FIND');
    const navigate = useNavigate();

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isSearchingVoice, setIsSearchingVoice] = useState(false);
    const [filterLocation, setFilterLocation] = useState('');
    const [filterMinBudget, setFilterMinBudget] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('NEWEST');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

    // Track if this is the first load (page refresh scenario)
    const isFirstLoadRef = React.useRef(true);

    useEffect(() => {
        if (isAuthLoading || !user.id) return;

        const loadData = async () => {
            // On first load (page refresh), wait briefly for session refresh to complete
            if (isFirstLoadRef.current) {
                isFirstLoadRef.current = false;
                console.log('[Home] First load detected, waiting for session refresh...');
                await new Promise(resolve => setTimeout(resolve, 800)); // Give session refresh time
            }

            const type = role === UserRole.POSTER ? 'POSTER' : (workerTab === 'FIND' ? 'HOME' : 'WORKER_APPS');
            console.log(`[Home] Triggering feed load: role=${role}, workerTab=${workerTab}, posterTab=${posterTab}, finalType=${type}`);
            loadFeed(type, 0, user.id);
        };

        loadData();
    }, [role, workerTab, posterTab, dashboardTab, loadFeed, user.id, isAuthLoading]);

    // Handle explicit refresh
    const handleRefresh = async () => {
        if (user.id) {
            await refreshJobs(user.id);
        } else {
            await refreshJobs();
        }
    };

    const sortOptions: { value: SortOption; labelEn: string; labelHi: string }[] = [
        { value: 'NEWEST', labelEn: 'Newest First', labelHi: 'नया पहले' },
        { value: 'BUDGET_HIGH', labelEn: 'Budget: High to Low', labelHi: 'बजट: ज्यादा से कम' },
        { value: 'BUDGET_LOW', labelEn: 'Budget: Low to High', labelHi: 'बजट: कम से ज्यादा' },
        { value: 'NEAREST', labelEn: 'Nearest First', labelHi: 'पास वाले पहले' },
    ];

    const toggleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { showAlert("Voice input not supported", 'error'); return; }
        if (isSearchingVoice) {
            setIsSearchingVoice(false);
            try { window.recognition?.stop(); } catch (e) { }
            return;
        }

        setIsSearchingVoice(true);
        try {
            const recognition = new SpeechRecognition();
            window.recognition = recognition;
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
            recognition.onresult = (event: any) => {
                setSearchQuery(event.results[0][0].transcript);
                setIsSearchingVoice(false);
            };
            recognition.onerror = () => setIsSearchingVoice(false);
            recognition.onend = () => setIsSearchingVoice(false);
            recognition.start();
        } catch (e) { setIsSearchingVoice(false); }
    };

    // 1. Memoize jobs with distance calculated (only when jobs or location change)
    const jobsWithDistance = useMemo(() => {
        return jobs.map(j => ({
            ...j,
            distance: (user.coordinates && j.coordinates)
                ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng)
                : undefined
        }));
    }, [jobs, user.coordinates]);

    // Derived counts for Poster
    const posterStats = useMemo(() => {
        const myJobs = jobsWithDistance.filter(j =>
            j.posterId && user.id && j.posterId.toLowerCase() === user.id.toLowerCase()
        );
        return {
            open: myJobs.filter(j => j.status === JobStatus.OPEN).length,
            active: myJobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
            completed: myJobs.filter(j => j.status === JobStatus.COMPLETED).length,
            cancelled: myJobs.filter(j => j.status === JobStatus.CANCELLED).length
        };
    }, [jobsWithDistance, user.id]);

    // 2. Final Filtering & Sorting (cheap, safe for search typing)
    const filteredJobs = useMemo(() => {
        return jobsWithDistance
            .filter(j => {
                const isMyJob = j.posterId && user.id && j.posterId.toLowerCase() === user.id.toLowerCase();

                if (role === UserRole.POSTER) {
                    if (!isMyJob) return false;

                    if (posterTab === 'ACTIVE') {
                        // Active: OPEN, IN_PROGRESS
                        const isActive = j.status === JobStatus.OPEN || j.status === JobStatus.IN_PROGRESS;
                        if (!isActive) return false;
                        if (dashboardTab !== 'ALL' && j.status !== dashboardTab) return false;
                    } else {
                        // History: COMPLETED, CANCELLED
                        const isHistory = j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED;
                        if (!isHistory) return false;
                    }
                } else {
                    if (j.posterId === user.id) return false;
                    const myBidId = j.myBidId || j.bids.find(b => b.workerId === user.id)?.id;
                    const myBidStatus = j.myBidStatus || j.bids.find(b => b.workerId === user.id)?.status;

                    if (workerTab === 'FIND') {
                        // Find: OPEN jobs I haven't bid on
                        if (j.status !== JobStatus.OPEN || myBidId) return false;
                    } else if (workerTab === 'ACTIVE') {
                        // Active: Jobs I bid on (PENDING) OR Jobs I won (IN_PROGRESS)
                        if (!myBidId) return false;
                        // Exclude finished/dead states
                        if (j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED || myBidStatus === 'REJECTED') return false;
                        // If job started (not OPEN) and I'm not the winner, it's not active for me (it's history)
                        if (j.status !== JobStatus.OPEN && j.acceptedBidId !== myBidId) return false;
                    } else {
                        // History: REJECTED bids, LOST jobs, COMPLETED jobs, CANCELLED jobs
                        if (!myBidId) return false;
                        const isRejected = myBidStatus === 'REJECTED' || (j.status !== JobStatus.OPEN && j.acceptedBidId !== myBidId);
                        const isFinished = j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED;
                        if (!isRejected && !isFinished) return false;
                    }
                }

                if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                if (selectedCategory !== 'All' && j.category !== selectedCategory) return false;
                if (filterLocation && !(j.location || '').toLowerCase().includes(filterLocation.toLowerCase())) return false;
                if (filterMinBudget && j.budget < parseInt(filterMinBudget)) return false;
                if (filterMaxDistance && j.distance !== undefined && j.distance > parseInt(filterMaxDistance)) return false;

                return true;
            })
            .sort((a, b) => {
                if (role === UserRole.POSTER) return b.createdAt - a.createdAt;

                switch (sortBy) {
                    case 'NEWEST': return b.createdAt - a.createdAt;
                    case 'BUDGET_HIGH': return b.budget - a.budget;
                    case 'BUDGET_LOW': return a.budget - b.budget;
                    case 'NEAREST':
                        if (a.distance === undefined && b.distance === undefined) return 0;
                        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
                    default: return b.createdAt - a.createdAt;
                }
            });
    }, [jobsWithDistance, role, posterTab, dashboardTab, workerTab, user.id, searchQuery, selectedCategory, filterLocation, filterMinBudget, filterMaxDistance, sortBy]);



    const unreadNotificationsCount = notifications.filter(n => !n.read).length;

    return (
        <div className="min-h-screen transition-colors duration-500 overflow-x-hidden">
            <FilterModal
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                currentFilters={{
                    location: filterLocation,
                    minBudget: filterMinBudget,
                    maxDistance: filterMaxDistance,
                    category: selectedCategory,
                    sortBy: sortBy
                }}
                onApply={(f) => {
                    setFilterLocation(f.location);
                    setFilterMinBudget(f.minBudget);
                    setFilterMaxDistance(f.maxDistance);
                    setSelectedCategory(f.category);
                    setSortBy(f.sortBy);
                }}
            />

            {/* --- COMPACT PREMIUM HERO SECTION --- */}
            <div className={`relative pt-safe transition-all duration-700 ${role === UserRole.POSTER ? 'bg-blue-600 dark:bg-blue-900' : 'bg-emerald-600 dark:bg-emerald-900'}`}>
                {/* Mesh Gradient Background */}
                <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none overflow-hidden">
                    <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[80%] bg-emerald-400 rounded-full blur-[120px] animate-pulse-subtle" />
                    <div className="absolute top-[10%] -right-[10%] w-[50%] h-[70%] bg-blue-400 rounded-full blur-[100px] animate-pulse-subtle delay-700" />
                </div>

                <div className="max-w-7xl mx-auto px-6 py-4 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Compact Profile & Greeting */}
                    <div className="flex items-center gap-3">
                        <div className="relative group cursor-pointer shrink-0" onClick={() => navigate('/profile')}>
                            <div className="w-12 h-12 rounded-2xl bg-white p-0.5 shadow-xl transition-transform duration-500 group-hover:scale-105">
                                <div className="w-full h-full rounded-[0.9rem] overflow-hidden bg-gray-100 dark:bg-gray-800">
                                    {user.profilePhoto ? (
                                        <img src={user.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center text-lg font-black ${role === UserRole.POSTER ? 'text-blue-600' : 'text-emerald-600'}`}>
                                            {user.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none mb-0.5">
                                {t.greeting}, {user.name.split(' ')[0]}!
                            </h2>
                            <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.3em]">
                                {role === UserRole.POSTER
                                    ? (language === 'en' ? 'POSTER' : 'नियुक्ता')
                                    : (language === 'en' ? 'WORKER' : 'कामगार')}
                            </p>
                        </div>
                    </div>

                    {/* Compact Role Switcher */}
                    <div className="bg-black/10 backdrop-blur-3xl p-1 rounded-[1.5rem] border border-white/10 flex gap-0.5">
                        <button
                            onClick={() => setRole(UserRole.WORKER)}
                            className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-500 flex items-center gap-2 ${role === UserRole.WORKER ? 'bg-white text-emerald-600 shadow-lg scale-100' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <Zap size={12} strokeWidth={3} /> {t.findWork}
                        </button>
                        <button
                            onClick={() => setRole(UserRole.POSTER)}
                            className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-500 flex items-center gap-2 ${role === UserRole.POSTER ? 'bg-white text-blue-600 shadow-lg scale-100' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <LayoutDashboard size={12} strokeWidth={3} /> {language === 'en' ? 'POSTER' : 'नियुक्ता'}
                        </button>
                    </div>
                </div>

                {/* Bottom Curve/Transition */}
                <div className="h-6 bg-white dark:bg-gray-950 rounded-t-[2.5rem] mt-2" />
            </div>

            {/* --- SEARCH & CONTROL BAR --- */}
            <div className="max-w-7xl mx-auto px-6 -mt-6 relative z-20 space-y-8">
                {/* Compact Search & Filter Bar */}
                <div className="flex gap-4 items-center">
                    <div className="flex-1 bg-white dark:bg-gray-900 p-1.5 rounded-[2.5rem] shadow-glass border-4 border-white dark:border-gray-800 flex items-center gap-2 group transition-all duration-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder={role === UserRole.WORKER
                                    ? (language === 'en' ? "Search for work..." : "काम खोजें...")
                                    : (language === 'en' ? "Search your posts..." : "अपनी पोस्ट खोजें...")
                                }
                                className="w-full bg-transparent border-none rounded-[2rem] pl-14 pr-6 py-4 font-bold text-lg text-gray-900 dark:text-white outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                        </div>

                        <button
                            onClick={toggleVoiceInput}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isSearchingVoice ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-emerald-500'}`}
                        >
                            {isSearchingVoice ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                    </div>

                    <div className="flex gap-2 shrink-0">
                        {/* View Toggle */}
                        <button
                            onClick={() => setViewMode(prev => prev === 'LIST' ? 'MAP' : 'LIST')}
                            className="w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all active:scale-95 border-4 shadow-glass bg-white dark:bg-gray-900 border-white dark:border-gray-800 text-gray-500 hover:text-emerald-500"
                        >
                            {viewMode === 'LIST' ? <MapIcon size={24} strokeWidth={3} /> : <ListIcon size={24} strokeWidth={3} />}
                        </button>

                        <button
                            onClick={() => setShowFilters(true)}
                            className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all active:scale-95 border-4 shadow-glass ${filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All' ? 'bg-emerald-600 text-white border-white dark:border-gray-700' : 'bg-white dark:bg-gray-900 text-gray-500 border-white dark:border-gray-800'}`}
                        >
                            <div className="relative">
                                <SlidersHorizontal size={24} strokeWidth={3} />
                                {(filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All') && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-bounce" />
                                )}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Integrated Switcher */}
                    <div className="bg-white/50 dark:bg-gray-900/50 p-1.5 rounded-[2.5rem] border-2 border-white dark:border-gray-800 flex gap-1 self-center w-full max-w-2xl">
                        {role === UserRole.WORKER ? (
                            [
                                { id: 'FIND', icon: Zap, label: language === 'en' ? 'Discover' : 'खोजें' },
                                { id: 'ACTIVE', icon: Clock, label: language === 'en' ? 'Active' : 'सक्रिय' },
                                { id: 'HISTORY', icon: History, label: language === 'en' ? 'History' : 'इतिहास' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setWorkerTab(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-3xl transition-all duration-500 font-black text-[10px] uppercase tracking-widest ${workerTab === tab.id ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xl scale-100' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <tab.icon size={16} strokeWidth={3} />
                                    {tab.label}
                                </button>
                            ))
                        ) : (
                            [
                                { id: 'ACTIVE', icon: LayoutDashboard, label: language === 'en' ? 'My Directory' : 'मेरी निर्देशिका', count: posterStats.open + posterStats.active },
                                { id: 'HISTORY', icon: History, label: language === 'en' ? 'History' : 'इतिहास', count: posterStats.completed + posterStats.cancelled }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setPosterTab(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-3xl transition-all duration-500 font-black text-[10px] uppercase tracking-widest ${posterTab === tab.id ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xl scale-100' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <tab.icon size={16} strokeWidth={3} />
                                        <span>{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${posterTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* --- MAIN FEED AREA --- */}
                <main className="max-w-7xl mx-auto px-6 pb-40 pt-4">


                    {/* REGULAR FEED HEADER */}
                    <div className="flex flex-col gap-10">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg ${role === UserRole.POSTER ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
                                    {role === UserRole.POSTER ? <LayoutDashboard size={20} /> : <Sparkles size={20} strokeWidth={2.5} />}
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">
                                        {role === UserRole.POSTER
                                            ? (posterTab === 'HISTORY'
                                                ? (language === 'en' ? 'History' : 'इतिहास')
                                                : (language === 'en' ? 'My Directory' : 'मेरी निर्देशिका'))
                                            : (workerTab === 'FIND'
                                                ? (language === 'en' ? 'Discover' : 'खोजें')
                                                : workerTab === 'ACTIVE'
                                                    ? (language === 'en' ? 'Active Jobs' : 'सक्रिय काम')
                                                    : (language === 'en' ? 'History' : 'इतिहास'))}
                                    </h2>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                        {role === UserRole.POSTER
                                            ? (language === 'en' ? 'Manage Your Job Posts' : 'अपनी जॉब पोस्ट प्रबंधित करें')
                                            : (language === 'en' ? 'Explore Latest Opportunities' : 'नवीनतम अवसरों की खोज करें')}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleRefresh} className={`relative w-12 h-12 bg-gray-50 dark:bg-gray-900 text-gray-400 rounded-xl border-2 border-white dark:border-gray-800 shadow-sm transition-all flex items-center justify-center group hover:text-emerald-500 overflow-hidden ${isRevalidating ? 'ring-2 ring-emerald-500/20' : ''}`}>
                                <RotateCw size={18} strokeWidth={3} className={loading || isRevalidating ? 'animate-spin' : 'group-hover:rotate-45 transition-transform'} />
                                {isRevalidating && <span className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
                            </button>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {[1, 2, 3, 4, 5, 6].map(i => <JobCardSkeleton key={i} />)}
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                {viewMode === 'LIST' ? (
                                    filteredJobs.map(job => (
                                        <div key={job.id} className="h-full transform hover:-translate-y-2 transition-transform duration-500">
                                            <JobCard
                                                job={job}
                                                currentUserId={user.id}
                                                userRole={role}
                                                distance={job.distance}
                                                language={language}
                                                onBid={onBid}
                                                onViewBids={onViewBids}
                                                onChat={onChat}
                                                onEdit={onEdit}
                                                onClick={() => onClick(job)}
                                                onReplyToCounter={onReplyToCounter}
                                                onWithdrawBid={onWithdrawBid}
                                                onHide={hideJob}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full">
                                        <Suspense fallback={
                                            <div className="h-[500px] w-full bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center">
                                                <Loader2 className="animate-spin text-emerald-500" size={48} />
                                            </div>
                                        }>
                                            <JobMap
                                                jobs={filteredJobs}
                                                onJobClick={onClick}
                                                userLocation={user.coordinates}
                                            />
                                        </Suspense>
                                        <p className="text-center text-gray-400 text-xs mt-4 font-bold uppercase tracking-widest animate-pulse">
                                            Showing {filteredJobs.length} jobs on map
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : jobsError ? (
                            <div className="flex flex-col items-center justify-center py-20 px-10 bg-red-50/50 dark:bg-red-900/10 rounded-[3rem] border-4 border border-red-100 dark:border-red-900/30 animate-pop">
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-500">
                                    <XCircle size={40} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                                    {language === 'en' ? 'Oops! Something went wrong' : 'ओह! कुछ गलत हो गया'}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-center max-w-xs font-medium text-sm">
                                    {jobsError}
                                </p>
                                <button
                                    onClick={() => handleRefresh()}
                                    className="flex items-center gap-2 px-10 py-4 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all text-white mt-8 bg-red-600 shadow-red-600/20"
                                >
                                    <RotateCw size={14} />
                                    {language === 'en' ? 'Retry Loading' : 'पुनः प्रयास करें'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 px-10 bg-white/50 dark:bg-gray-900/50 rounded-[3rem] border-4 border-dashed border-gray-100 dark:border-gray-800 animate-pop">
                                <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-8 text-gray-300">
                                    <Sparkles size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                                    {language === 'en' ? 'No jobs found' : 'कोई काम नहीं मिला'}
                                </h3>
                                <p className="text-gray-500 text-center max-w-xs font-medium">
                                    {language === 'en'
                                        ? 'Try adjusting your filters or search query to find more opportunities.'
                                        : 'अधिक अवसर खोजने के लिए अपने फ़िल्टर या खोज क्वेरी को समायोजित करने का प्रयास करें।'}
                                </p>
                                <button
                                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setFilterLocation(''); setFilterMinBudget(''); setFilterMaxDistance(''); }}
                                    className={`px-12 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all text-white mt-10 ${role === UserRole.POSTER ? 'bg-blue-600 shadow-blue-600/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}
                                >
                                    {language === 'en' ? 'Clear All Filters' : 'सभी फ़िल्टर साफ़ करें'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Load More Button */}
                    {hasMore && !loading && (
                        <div className="flex justify-center mt-12 pb-10">
                            <button
                                onClick={fetchMoreJobs}
                                disabled={isLoadingMore}
                                className={`px-12 py-6 rounded-[2.5rem] border-4 font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all active:scale-95 flex items-center gap-6 ${role === UserRole.POSTER ? 'border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                            >
                                {isLoadingMore ? <Loader2 size={24} className="animate-spin" /> : <RotateCw size={24} strokeWidth={3} />}
                                {isLoadingMore ? t.loading : t.loadMore}
                            </button>
                        </div>
                    )}
                </main>
            </div>

            {/* FLOATING ACTION BUTTONS */}
            {
                role === UserRole.POSTER && (
                    <button
                        onClick={() => navigate('/post')}
                        className="fixed bottom-32 right-8 w-18 h-18 bg-blue-600 text-white rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] flex items-center justify-center active:scale-90 transition-all z-[60] md:hidden border-4 border-white dark:border-gray-900 group"
                    >
                        <Plus size={36} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
                        <div className="absolute right-full mr-4 bg-gray-900 text-white text-[10px] font-black px-4 py-2 rounded-xl opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all whitespace-nowrap shadow-xl">
                            {language === 'en' ? 'POST A NEW JOB' : 'नया काम पोस्ट करें'}
                        </div>
                    </button>
                )
            }
        </div >
    );
};
