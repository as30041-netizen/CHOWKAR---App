import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { JobCard } from '../components/JobCard';
import { ActiveJobsRail } from '../components/ActiveJobsRail';
import { StickyTabs } from '../components/StickyTabs';
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
import { useNavigate, useLocation } from 'react-router-dom';

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

import { PosterHome } from '../components/PosterHome';
import { FilterPills } from '../components/FilterPills';
import { WorkerActiveJobCard } from '../components/WorkerActiveJobCard';
import { CategoryHero } from '../components/CategoryHero';

export const Home: React.FC<HomeProps> = ({
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid,
    setShowFilterModal: _setShowFilterModal, showAlert
}) => {
    const { user, role, setRole, t, language, isAuthLoading, hasInitialized } = useUser();
    const { notifications } = useNotification();
    const { jobs, loading, isRevalidating, refreshJobs, fetchMoreJobs, hasMore, isLoadingMore, loadFeed, hideJob, error: jobsError, stats, searchQuery, setSearchQuery } = useJobs();
    const [posterTab, setPosterTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

    const navigate = useNavigate();
    const location = useLocation();

    // Worker Tabs - Sync with URL
    const [workerTab, setWorkerTab] = useState<'FIND' | 'ACTIVE' | 'HISTORY'>(
        location.pathname === '/find' ? 'FIND' : 'ACTIVE'
    );

    // Effect to handle URL based tab switching
    useEffect(() => {
        if (role === UserRole.WORKER) {
            if (location.pathname === '/find') {
                setWorkerTab('FIND');
            } else if (workerTab === 'FIND') {
                // If we are on home but tab is FIND, reset to ACTIVE
                setWorkerTab('ACTIVE');
            }
        }
    }, [location.pathname, role]);

    // State
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterMinBudget, setFilterMinBudget] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>(user.coordinates ? 'NEAREST' : 'NEWEST');
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

    // Quick Filters
    const [quickFilters, setQuickFilters] = useState({
        nearby: false,
        highPay: false,
        urgent: false,
        today: false
    });

    const toggleQuickFilter = (type: keyof typeof quickFilters) => {
        setQuickFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    useEffect(() => {
        if (!hasInitialized || isAuthLoading || !user.id) return;

        const loadData = async () => {
            const type = role === UserRole.POSTER ? 'POSTER' : (workerTab === 'FIND' ? 'HOME' : 'WORKER_APPS');
            loadFeed(type, 0, user.id);
        };

        loadData();
    }, [role, workerTab, posterTab, loadFeed, user.id, isAuthLoading, hasInitialized]);

    // Handle explicit refresh
    const handleRefresh = async () => {
        if (user.id) {
            await refreshJobs(user.id);
        } else {
            await refreshJobs();
        }
    };

    // Separate state for the "Active Jobs Rail" (since main "jobs" feed lacks bid details in discovery mode)
    const [activeRailJobs, setActiveRailJobs] = useState<Job[]>([]);

    useEffect(() => {
        if (role === UserRole.WORKER && user.id) {
            import('../services/jobService').then(({ fetchMyApplicationsFeed }) => {
                fetchMyApplicationsFeed(user.id, 5, 0).then(({ jobs }) => {
                    setActiveRailJobs(jobs);
                });
            });
        }
    }, [role, user.id, isRevalidating]); // Refresh when main jobs refresh

    // Check for pending bid return (from Wallet recharge)
    useEffect(() => {
        const pendingJobId = sessionStorage.getItem('pendingBidJobId');
        if (pendingJobId && !loading && jobs.length > 0) {
            const job = jobs.find(j => j.id === pendingJobId);
            if (job) {
                // Clear it so it doesn't trigger again
                sessionStorage.removeItem('pendingBidJobId');
                // Re-open the bid modal directly
                onBid(pendingJobId);
            }
        }
    }, [loading, jobs, onBid]);



    // 1. Memoize jobs with distance calculated
    const jobsWithDistance = useMemo(() => {
        return jobs.map(j => ({
            ...j,
            distance: (user.coordinates && j.coordinates)
                ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng)
                : undefined
        }));
    }, [jobs, user.coordinates]);

    // 2. Final Filtering & Sorting (cheap, safe for search typing)
    const filteredJobs = useMemo(() => {
        return jobsWithDistance
            .filter(j => {
                // Common Filters
                if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                if (selectedCategory !== 'All' && j.category !== selectedCategory) return false;
                if (filterLocation && !(j.location || '').toLowerCase().includes(filterLocation.toLowerCase())) return false;
                if (filterMinBudget && j.budget < parseInt(filterMinBudget)) return false;
                if (filterMaxDistance && j.distance !== undefined && j.distance > parseInt(filterMaxDistance)) return false;

                // QUICK FILTERS
                if (quickFilters.nearby && (j.distance === undefined || j.distance > 5)) return false;
                if (quickFilters.highPay && j.budget < 800) return false;
                if (quickFilters.urgent && !j.title.toLowerCase().includes('urgent') && !j.description.toLowerCase().includes('urgent')) return false;
                if (quickFilters.today) {
                    const jobDate = new Date(j.jobDate).toDateString();
                    const today = new Date().toDateString();
                    if (jobDate !== today) return false;
                }

                // QUICK FILTERS
                if (quickFilters.nearby && (j.distance === undefined || j.distance > 5)) return false;
                if (quickFilters.highPay && j.budget < 800) return false;
                if (quickFilters.urgent && !j.title.toLowerCase().includes('urgent') && !j.description.toLowerCase().includes('urgent')) return false;
                if (quickFilters.today) {
                    const jobDate = new Date(j.jobDate).toDateString();
                    const today = new Date().toDateString();
                    if (jobDate !== today) return false;
                }

                // QUICK FILTERS
                if (quickFilters.nearby && (j.distance === undefined || j.distance > 5)) return false;
                if (quickFilters.highPay && j.budget < 800) return false;
                if (quickFilters.urgent && !j.title.toLowerCase().includes('urgent') && !j.description.toLowerCase().includes('urgent')) return false;
                if (quickFilters.today) {
                    const jobDate = new Date(j.jobDate).toDateString();
                    const today = new Date().toDateString();
                    if (jobDate !== today) return false;
                }

                // POSTER LOGIC (For Dashboard)
                // Even though we have an early return, we calculate filteredJobs *before* it, so we need to handle Poster case here.
                if (role === UserRole.POSTER) {
                    const isMyJob = j.posterId && user.id && j.posterId.toLowerCase() === user.id.toLowerCase();
                    if (!isMyJob) return false;

                    if (posterTab === 'ACTIVE') {
                        return j.status === JobStatus.OPEN || j.status === JobStatus.IN_PROGRESS;
                    } else {
                        return j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED;
                    }
                }

                // WORKER LOGIC
                // Exclude my own jobs if I somehow have them
                if (j.posterId === user.id) return false;
                const myBidId = j.myBidId || j.bids.find(b => b.workerId === user.id)?.id;
                const myBidStatus = j.myBidStatus || j.bids.find(b => b.workerId === user.id)?.status;

                if (workerTab === 'FIND') {
                    // Find: OPEN jobs I haven't bid on
                    if (j.status !== JobStatus.OPEN || myBidId) return false;
                } else if (workerTab === 'ACTIVE') {
                    // Active: OPEN jobs with PENDING/ACCEPTED bid OR IN_PROGRESS jobs where I won (or am accepted)
                    if (!myBidId) return false;
                    const isWinner = (j.status === JobStatus.IN_PROGRESS && j.acceptedBidId === myBidId);
                    // Fallback: If job is in progress and my bid is ACCEPTED, I'm the winner (handles data inconsistency)
                    const isWinnerFallback = (j.status === JobStatus.IN_PROGRESS && myBidStatus === 'ACCEPTED');
                    const isOpenAndRelevant = j.status === JobStatus.OPEN && (myBidStatus === 'PENDING' || myBidStatus === 'ACCEPTED');

                    if (!isWinner && !isWinnerFallback && !isOpenAndRelevant) return false;
                } else {
                    // History: REJECTED bids, LOST jobs (won by others), COMPLETED/CANCELLED jobs
                    if (!myBidId) return false;
                    const isFinished = j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED;
                    const isRejected = myBidStatus === 'REJECTED';
                    // Lost: Job not open, and I am NOT the winner (checked via ID and Status)
                    const isLost = j.status !== JobStatus.OPEN && j.acceptedBidId !== myBidId && myBidStatus !== 'ACCEPTED';

                    if (!isFinished && !isRejected && !isLost) return false;
                }

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
    }, [jobsWithDistance, role, posterTab, workerTab, user.id, searchQuery, selectedCategory, filterLocation, filterMinBudget, filterMaxDistance, sortBy]);

    const unreadNotificationsCount = notifications.filter(n => !n.read).length;

    if (role === UserRole.POSTER) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-500 overflow-x-hidden pt-safe">
                <PosterHome
                    jobs={filteredJobs}
                    loading={loading}
                    error={jobsError}
                    stats={stats}
                    onViewBids={onViewBids}
                    onEdit={onEdit}
                    onHide={hideJob}
                    onRefresh={handleRefresh}
                    posterTab={posterTab}
                    setPosterTab={setPosterTab}
                    onChat={onChat}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen transition-colors duration-500">
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



            {/* --- SUPER APP HUB LAYOUT --- */}
            <main className="flex flex-col pt-0 pb-32">

                {/* 1. Category Shortcuts (Visual Discovery) */}
                {location.pathname === '/find' && role === UserRole.WORKER && (
                    <>
                        {/* Location Warning for Personalization */}
                        {!user.coordinates && (
                            <div className="px-6 mb-4">
                                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300">
                                            <MapPin size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                                {language === 'en' ? 'Where are you?' : 'आप कहाँ हैं?'}
                                            </h4>
                                            <p className="text-[10px] text-blue-800 dark:text-blue-200">
                                                {language === 'en' ? 'Enable location to see nearby jobs.' : 'पास के काम देखने के लिए लोकेशन चालू करें।'}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Link to profile for now, or could trigger permission prompt */}
                                    <button
                                        onClick={() => navigate('/profile')}
                                        className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-lg shadow-blue-500/30"
                                    >
                                        {language === 'en' ? 'Enable' : 'चालू करें'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <CategoryHero />
                    </>
                )}

                {/* 2. Unified Control Bar (Pills + Actions) - Only on /find */}
                {location.pathname === '/find' && (
                    <div className="px-6 mt-2 mb-2 flex items-center justify-between gap-4">
                        {/* Left: Quick Filter Pills */}
                        {role === UserRole.WORKER && (
                            <div className="flex-1 overflow-visible">
                                <FilterPills
                                    activeFilters={quickFilters}
                                    onToggle={toggleQuickFilter}
                                    language={language}
                                />
                            </div>
                        )}

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setViewMode(prev => prev === 'LIST' ? 'MAP' : 'LIST')}
                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 hover:text-emerald-600 transition-all active:scale-95 whitespace-nowrap"
                            >
                                {viewMode === 'LIST' ? <><MapIcon size={14} /> Map</> : <><ListIcon size={14} /> List</>}
                            </button>

                            <button
                                onClick={() => setShowFilters(true)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap ${filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All' ? 'bg-emerald-600 text-white border-transparent' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-emerald-600'}`}
                            >
                                <SlidersHorizontal size={14} />
                                {t.filters}
                                {(filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All') && (
                                    <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Sticky Tabs (Context Switcher) - Hide on /find */}
                {location.pathname !== '/find' && (
                    <div className="sticky top-0 z-20 px-6 pt-0 pb-4 bg-green-50/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-white/5 dark:border-gray-800/50">
                        <StickyTabs
                            currentTab={role === UserRole.WORKER ? workerTab : posterTab}
                            onTabChange={(tab) => {
                                if (role === UserRole.WORKER) setWorkerTab(tab);
                                else setPosterTab(tab);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            tabs={role === UserRole.WORKER ? [
                                {
                                    id: 'ACTIVE',
                                    label: language === 'en' ? 'My Work' : 'मेरा काम',
                                    count: stats?.worker_active || 0
                                },
                                { id: 'HISTORY', label: language === 'en' ? 'History' : 'इतिहास' }
                            ] : [
                                { id: 'ACTIVE', label: t.myJobPosts }, // Poster "Active" is their main dashboard
                                { id: 'HISTORY', label: language === 'en' ? 'History' : 'इतिहास' }
                            ]}
                        />
                    </div>
                )}

                {/* 2. Active Jobs Rail REMOVED (Non-scalable, use My Work tab) */}

                <div className="px-2 mt-2">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1, 2, 3, 4, 5, 6].map(i => <JobCardSkeleton key={i} />)}
                        </div>
                    ) : filteredJobs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {viewMode === 'LIST' ? (
                                filteredJobs.map(job => (
                                    <div key={job.id} className="h-full transform hover:-translate-y-2 transition-transform duration-500">
                                        {(role === UserRole.WORKER && (workerTab === 'ACTIVE' || workerTab === 'HISTORY')) ? (
                                            <WorkerActiveJobCard
                                                job={job}
                                                currentUserId={user.id}
                                                onViewDetails={onClick}
                                                onChat={(j) => onChat(j)}
                                                language={language}
                                                onHide={hideJob}
                                            />
                                        ) : (
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
                                                isPremium={user.isPremium}
                                                userSkills={user.skills}
                                                userBio={user.bio}
                                            />
                                        )}
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
                        <div className="flex flex-col items-center justify-center py-20 px-10 bg-red-50/50 dark:bg-red-900/10 rounded-[3rem] border border-red-100 dark:border-red-900/30 animate-pop">
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
                        <div className="flex flex-col items-center justify-center py-32 px-10 bg-white/50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 animate-pop">
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
                                className="px-12 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all text-white mt-10 bg-emerald-600 shadow-emerald-600/20"
                            >
                                {language === 'en' ? 'Clear All Filters' : 'सभी फ़िल्ter साफ़ करें'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Load More Button */}
                {
                    hasMore && !loading && (
                        <div className="flex justify-center mt-12 pb-10">
                            <button
                                onClick={fetchMoreJobs}
                                disabled={isLoadingMore}
                                className="px-12 py-6 rounded-[2.5rem] border font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all active:scale-95 flex items-center gap-6 border-emerald-500 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                            >
                                {isLoadingMore ? <Loader2 size={24} className="animate-spin" /> : <RotateCw size={24} strokeWidth={3} />}
                                {isLoadingMore ? t.loading : t.loadMore}
                            </button>
                        </div>
                    )
                }
            </main >

        </div >
    );
};
