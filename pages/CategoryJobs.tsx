import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobs } from '../contexts/JobContextDB';
import { useUser } from '../contexts/UserContextDB';
import { Job } from '../types';
import { JobCard } from '../components/JobCard';
import { JobCardSkeleton } from '../components/Skeleton';
import { CATEGORY_CONFIG } from '../constants';
import { ArrowLeft, MapPin, List as ListIcon, Map as MapIcon, RotateCw, Search, Loader2 } from 'lucide-react';
import { calculateDistance } from '../utils/geo';
import { FilterPills } from '../components/FilterPills';

// Lazy load map to avoid loading Leaflet until needed
const JobMap = React.lazy(() => import('../components/JobMap').then(m => ({ default: m.JobMap })));

interface CategoryJobsProps {
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

export const CategoryJobs: React.FC<CategoryJobsProps> = ({
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid
}) => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const { user, language, role, t } = useUser();
    const { jobs, loading, refreshJobs, loadFeed, hasMore, fetchMoreJobs, isLoadingMore } = useJobs();

    // Local state for view & filters
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
    const [searchQuery, setSearchQuery] = useState('');
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const [quickFilters, setQuickFilters] = useState({
        nearby: false,
        highPay: false,
        urgent: false,
        today: false
    });

    const toggleQuickFilter = (type: keyof typeof quickFilters) => {
        setQuickFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    // scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const categoryConfig = CATEGORY_CONFIG.find(c => c.id === categoryId);
    const categoryLabel = categoryConfig ? (categoryConfig.label[language] || categoryConfig.label.en) : categoryId;

    // Handle Search Input Change with Debounce
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        searchDebounceRef.current = setTimeout(() => {
            if (categoryId && user.id) {
                loadFeed('HOME', 0, user.id, {
                    category: categoryId,
                    searchQuery: val
                });
            }
        }, 500);
    };

    // Initial Load (and when category changes)
    useEffect(() => {
        if (categoryId && user.id) {
            // CRITICAL: Pass category filter to Server
            // Reset search query on category change
            setSearchQuery('');
            loadFeed('HOME', 0, user.id, { category: categoryId });
        }
    }, [categoryId, user.id]); // loadFeed is stable

    // Filter from global state AND apply client-side quick filters on top
    const filteredJobs = useMemo(() => {
        if (!jobs) return [];

        let result = jobs
            // Ensure we strictly filter by category again client-side to be safe 
            // (though server returns only matching ones usually)
            .filter(j => {
                if (j.category !== categoryId || j.status !== 'OPEN') return false;
                if (j.posterId === user.id) return false;
                const hasMyBid = j.myBidId || (j.bids && j.bids.some(b => b.workerId === user.id));
                return !hasMyBid;
            })
            .map(j => ({
                ...j,
                distance: (user.coordinates && j.coordinates)
                    ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng)
                    : undefined
            }));

        // Apply Quick Filters (Client-Side)
        if (quickFilters.nearby) {
            result = result.filter(j => (j.distance || 0) < 5);
        }
        if (quickFilters.highPay) {
            result = result.filter(j => j.budget >= 800);
        }
        if (quickFilters.urgent) {
            result = result.filter(j => j.description?.toLowerCase().includes('urgent') || j.title?.toLowerCase().includes('urgent'));
        }
        if (quickFilters.today) {
            const today = new Date().toDateString();
            result = result.filter(j => j.jobDate && new Date(j.jobDate).toDateString() === today);
        }

        return result.sort((a, b) => {
            // Default to nearest if coordinates exist, otherwise newest
            if (a.distance !== undefined && b.distance !== undefined) {
                return a.distance - b.distance;
            }
            return b.createdAt - a.createdAt;
        });
    }, [jobs, categoryId, user.coordinates, quickFilters]);

    return (
        <div className="min-h-screen bg-background pb-20 pt-safe font-sans text-text-primary">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-border shadow-sm transition-all duration-300">
                {/* Top Row: Back, Title, Map Toggle */}
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 rounded-xl hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-black text-text-primary leading-tight tracking-tight">
                                {categoryLabel}
                            </h1>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                {filteredJobs.length} {language === 'en' ? 'Jobs' : 'काम'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (categoryId && user.id) {
                                    loadFeed('HOME', 0, user.id, {
                                        category: categoryId,
                                        searchQuery: searchQuery // Maintain search
                                    });
                                }
                            }}
                            className="p-2 rounded-xl bg-surface border border-border text-text-muted hover:text-primary active:scale-95 transition-all"
                        >
                            <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setViewMode(viewMode === 'LIST' ? 'MAP' : 'LIST')}
                            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl shadow-sm border border-border text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-primary transition-all active:scale-95"
                        >
                            {viewMode === 'LIST'
                                ? <><MapIcon size={14} /> {language === 'en' ? 'Map' : 'नक्शा'}</>
                                : <><ListIcon size={14} /> {language === 'en' ? 'List' : 'सूची'}</>
                            }
                        </button>
                    </div>
                </div>

                {/* Search Bar Row */}
                <div className="px-4 pb-2">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder={language === 'en' ? `Search in ${categoryLabel}...` : `${categoryLabel} में खोजें...`}
                            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-text-muted"
                        />
                        <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                    </div>
                </div>

                {/* Filter Pills Row */}
                <div className="px-4 pb-3 overflow-x-auto no-scrollbar">
                    <FilterPills
                        activeFilters={quickFilters}
                        onToggle={toggleQuickFilter}
                        language={language}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative">
                {/* Location Warning */}
                {!user.coordinates && viewMode === 'MAP' && (
                    <div className="absolute top-4 left-4 right-4 z-[1000]">
                        <div className="p-4 rounded-2xl bg-surface/90 backdrop-blur-md border border-red-500/20 shadow-lg flex items-center gap-3">
                            <MapPin className="text-red-500" size={20} />
                            <p className="text-xs font-bold text-red-500">
                                {language === 'en' ? 'Location required for map view.' : 'मैप के लिए लोकेशन जरूरी है।'}
                            </p>
                        </div>
                    </div>
                )}

                {viewMode === 'MAP' ? (
                    <div className="h-[calc(100vh-200px)] w-full relative">
                        <React.Suspense fallback={<div className="w-full h-full bg-surface animate-pulse" />}>
                            <JobMap
                                jobs={filteredJobs}
                                onJobClick={(job) => {
                                    // Switch to list and highlight or generic click
                                    onClick(job);
                                }}
                                userLocation={user.coordinates}
                            />
                        </React.Suspense>
                    </div>
                ) : (
                    <div className="px-4 py-4">
                        {loading && filteredJobs.length === 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {[1, 2, 3].map(i => <JobCardSkeleton key={i} />)}
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                {filteredJobs.map(job => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        currentUserId={user.id}
                                        userRole={role}
                                        distance={job.distance}
                                        language={language}
                                        onBid={() => onBid(job.id)}
                                        onViewBids={() => onViewBids(job)}
                                        onChat={() => onChat(job)}
                                        onEdit={() => onEdit(job)}
                                        onClick={() => onClick(job)}
                                        onReplyToCounter={onReplyToCounter}
                                        onWithdrawBid={onWithdrawBid}
                                        onHide={() => { }}
                                    />
                                ))}

                                {/* Load More Button */}
                                {hasMore && !loading && (
                                    <div className="col-span-full flex justify-center mt-6">
                                        <button
                                            onClick={fetchMoreJobs}
                                            disabled={isLoadingMore}
                                            className="px-8 py-4 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-black uppercase tracking-widest shadow-lg hover:bg-primary/10 active:scale-95 transition-all flex items-center gap-3"
                                        >
                                            {isLoadingMore ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                                            {language === 'en' ? 'Load More Jobs' : 'और काम देखें'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-4 text-text-muted shadow-inner">
                                    <categoryConfig.icon size={32} />
                                </div>
                                <h3 className="font-bold text-text-primary mb-1">
                                    {language === 'en' ? 'No jobs found' : 'कोई काम नहीं मिला'}
                                </h3>
                                <p className="text-text-secondary text-sm max-w-[200px]">
                                    {language === 'en' ? 'Try adjusting filters or check back later.' : 'फिल्टर बदलें या बाद में देखें'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
