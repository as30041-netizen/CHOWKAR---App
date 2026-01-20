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
}

import { useNotification } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';

import { PosterHome } from '../components/PosterHome';
import { WorkerHome } from '../components/WorkerHome';
import { FilterPills } from '../components/FilterPills';
import { WorkerActiveJobCard } from '../components/WorkerActiveJobCard';
import { CategoryHero } from '../components/CategoryHero';

export const Home: React.FC<HomeProps> = ({
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid,
    setShowFilterModal: _setShowFilterModal
}) => {
    const { user, role, setRole, t, language, isAuthLoading, hasInitialized } = useUser();
    const { notifications } = useNotification();
    const { showAlert } = useToast();
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
    const [feedMode, setFeedMode] = useState<'RECOMMENDED' | 'ALL'>('RECOMMENDED');

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

            // For HOME (FIND tab), we rely on the more detailed filter effect below
            // to avoid double loading on startup.
            if (type === 'HOME') return;

            loadFeed(type, 0, user.id);
        };

        loadData();
    }, [role, workerTab, posterTab, loadFeed, user.id, isAuthLoading, hasInitialized]);

    // Handle explicit refresh
    const handleRefresh = async () => {
        const type = role === UserRole.WORKER ? 'HOME' : 'POSTER';
        await refreshJobs(type, {
            category: selectedCategory,
            searchQuery: searchQuery,
            feedMode: feedMode
        }, user.id || undefined);
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

    // Trigger refresh when feed mode or filters change
    useEffect(() => {
        if (role === UserRole.WORKER && workerTab === 'FIND' && hasInitialized && user.id) {
            // Map Quick Filters to API params
            const effectiveMinBudget = quickFilters.highPay ? 800 : (filterMinBudget ? Number(filterMinBudget) : undefined);
            const effectiveMaxDistance = quickFilters.nearby ? 5 : (filterMaxDistance ? Number(filterMaxDistance) : undefined);

            refreshJobs('HOME', {
                category: selectedCategory,
                searchQuery: searchQuery,
                feedMode: feedMode,
                sortBy: sortBy,
                minBudget: effectiveMinBudget,
                maxDistance: effectiveMaxDistance,
                userLat: user.coordinates?.lat,
                userLng: user.coordinates?.lng
            }, user.id);
        }
    }, [feedMode, selectedCategory, searchQuery, sortBy, filterMinBudget, filterMaxDistance, quickFilters.nearby, quickFilters.highPay, quickFilters.urgent, quickFilters.today, user.coordinates?.lat, user.coordinates?.lng, role, workerTab, hasInitialized, user.id]);



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
                // 1. Discovery/Find Mode: Trust Server Filtering
                // The server already excludes: my own jobs, jobs I've bid on, and non-OPEN jobs.
                if (workerTab === 'FIND') {
                    // Final safety only: exclude my own if I'm the poster
                    if (j.posterId === user.id) return false;
                    return true;
                }

                // 2. Active/History Mode: Pull from same Applications Feed
                const myBidId = j.myBidId || j.bids.find(b => b.workerId === user.id)?.id;
                const myBidStatus = j.myBidStatus || j.bids.find(b => b.workerId === user.id)?.status;

                if (!myBidId) return false;

                if (workerTab === 'ACTIVE') {
                    // Active: PENDING/ACCEPTED bids on OPEN jobs OR IN_PROGRESS where I am the winner
                    const isWinner = (j.status === JobStatus.IN_PROGRESS && j.acceptedBidId === myBidId);
                    const isWinnerFallback = (j.status === JobStatus.IN_PROGRESS && myBidStatus === 'ACCEPTED');
                    const isOpenAndRelevant = j.status === JobStatus.OPEN && (myBidStatus === 'PENDING' || myBidStatus === 'ACCEPTED');

                    return isWinner || isWinnerFallback || isOpenAndRelevant;
                }

                // History: REJECTED bids, LOST jobs, or FINISHED jobs
                const isFinished = j.status === JobStatus.COMPLETED || j.status === JobStatus.CANCELLED;
                const isRejected = myBidStatus === 'REJECTED';
                const isLost = j.status !== JobStatus.OPEN && j.acceptedBidId !== myBidId && myBidStatus !== 'ACCEPTED';

                return isFinished || isRejected || isLost;
            })
            .sort((a, b) => {
                if (role === UserRole.POSTER) return b.createdAt - a.createdAt;

                // 1. Discovery/Find Mode: Trust Server Sequence
                // The server already sorts by Relevancy (Recommended) or SortBy (All)
                if (workerTab === 'FIND') return 0;

                // 2. Active/History Mode: Sort by newest status change / creation
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
    }, [jobsWithDistance, role, posterTab, workerTab, user.id, searchQuery, selectedCategory, filterLocation, filterMinBudget, filterMaxDistance, sortBy, feedMode]);

    const unreadNotificationsCount = notifications.filter(n => !n.read).length;

    if (role === UserRole.POSTER) {
        return (
            <div className="min-h-screen bg-background transition-colors duration-500 overflow-x-hidden pt-safe">
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
                    onClick={onClick}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background transition-colors duration-500">
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
            <main className="flex flex-col pt-0 pb-0">
                <WorkerHome
                    workerTab={workerTab}
                    setWorkerTab={setWorkerTab}
                    filteredJobs={filteredJobs}
                    loading={loading}
                    error={jobsError}
                    stats={stats}
                    onBid={onBid}
                    onViewBids={onViewBids}
                    onChat={onChat}
                    onEdit={onEdit}
                    onClick={onClick}
                    onReplyToCounter={onReplyToCounter}
                    onWithdrawBid={onWithdrawBid}
                    hideJob={hideJob}
                    quickFilters={quickFilters}
                    toggleQuickFilter={toggleQuickFilter}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                    filterLocation={filterLocation}
                    filterMinBudget={filterMinBudget}
                    filterMaxDistance={filterMaxDistance}
                    selectedCategory={selectedCategory}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    fetchMoreJobs={fetchMoreJobs}
                    searchQuery={searchQuery}
                    feedMode={feedMode}
                    setFeedMode={setFeedMode}
                    onClearFilters={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setFilterLocation('');
                        setFilterMinBudget('');
                        setFilterMaxDistance('');
                        setQuickFilters({
                            nearby: false,
                            highPay: false,
                            urgent: false,
                            today: false
                        });
                        setFeedMode('RECOMMENDED');
                    }}
                />
            </main>
        </div>
    );
};
