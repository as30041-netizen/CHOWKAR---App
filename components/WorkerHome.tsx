import React from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Briefcase, Clock, MapPin } from 'lucide-react';
import { CategoryHero } from './CategoryHero';
import { FilterPills } from './FilterPills';
import { SkillNudgeCard } from './SkillNudgeCard';
import { WorkerActiveJobCard } from './WorkerActiveJobCard';
import { JobCard } from './JobCard';
import { JobCardSkeleton } from './Skeleton';
import { useNavigate } from 'react-router-dom';
import { Job, UserRole } from '../types';
import { Loader2, List as ListIcon, Map as MapIcon, SlidersHorizontal, RotateCw, LayoutGrid, Sparkles } from 'lucide-react';

const JobMap = React.lazy(() => import('../components/JobMap').then(m => ({ default: m.JobMap })));

import { StatCard } from './StatCard';

interface WorkerHomeProps {
    workerTab: 'FIND' | 'ACTIVE' | 'HISTORY';
    setWorkerTab: (tab: 'FIND' | 'ACTIVE' | 'HISTORY') => void;
    filteredJobs: (Job & { distance?: number })[];
    loading: boolean;
    error: string | null;
    stats: any; // Using granular stats from useJobs
    onBid: (jobId: string) => void;
    onViewBids: (job: Job) => void;
    onChat: (job: Job) => void;
    onEdit: (job: Job) => void;
    onClick: (job: Job) => void;
    onReplyToCounter: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
    onWithdrawBid: (jobId: string, bidId: string) => void;
    hideJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
    quickFilters: any;
    toggleQuickFilter: any;
    viewMode: 'LIST' | 'MAP';
    setViewMode: any;
    showFilters: boolean;
    setShowFilters: any;
    filterLocation: string;
    filterMinBudget: string;
    filterMaxDistance: string;
    selectedCategory: string;
    hasMore: boolean;
    isLoadingMore: boolean;
    fetchMoreJobs: () => Promise<void>;
    onClearFilters?: () => void;
    searchQuery: string;
    feedMode: 'RECOMMENDED' | 'ALL';
    setFeedMode: (mode: 'RECOMMENDED' | 'ALL') => void;
}

export const WorkerHome: React.FC<WorkerHomeProps> = ({
    workerTab, setWorkerTab, filteredJobs, loading, error, stats,
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid, hideJob,
    quickFilters, toggleQuickFilter, viewMode, setViewMode, showFilters, setShowFilters,
    filterLocation, filterMinBudget, filterMaxDistance, selectedCategory,
    hasMore, isLoadingMore, fetchMoreJobs, onClearFilters, searchQuery,
    feedMode, setFeedMode
}) => {
    const { user, language, t, setShowEditProfile } = useUser();
    const { refreshJobs } = useJobs();
    const navigate = useNavigate();

    const [showRetry, setShowRetry] = React.useState(false);

    React.useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setShowRetry(true), 10000); // 10s timeout
            return () => clearTimeout(timer);
        } else {
            setShowRetry(false);
        }
    }, [loading]);

    const handleForceRetry = async () => {
        setShowRetry(false);
        await refreshJobs('HOME', {}, user.id);
    };

    return (
        <div className="flex flex-col gap-6 pb-32">

            {/* SAFETY: Force Retry Button if stuck loading */}
            {loading && showRetry && (
                <div className="px-6 mt-4 animate-fade-in">
                    <button
                        onClick={handleForceRetry}
                        className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <RotateCw size={16} />
                        {language === 'en' ? 'Taking too long? Tap to Retry' : language === 'hi' ? 'बहुत समय लग रहा है? पुनः प्रयास करें' : 'ਬਹੁਤ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ? ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ'}
                    </button>
                </div>
            )}
            {/* 1. WELCOME HEADER (Only in ACTIVE/HISTORY) */}
            {workerTab !== 'FIND' && (
                <header className="px-6 pt-4">
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black text-text-primary tracking-tighter leading-tight">
                                {language === 'en' ? 'Hello,' : language === 'hi' ? 'नमस्ते,' : 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ,'} <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                                    {user.name?.split(' ')[0] || 'Partner'}
                                </span>
                            </h1>
                            <p className="text-text-secondary text-sm font-medium mt-2">
                                {language === 'en' ? 'Ready to work today?' : language === 'hi' ? 'आज काम करने के लिए तैयार हैं?' : 'ਕੀ ਅੱਜ ਕੰਮ ਲਈ ਤਿਆਰ ਹੋ?'}
                            </p>
                        </div>
                    </div>

                    {/* KPI Stats */}
                    <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                        <StatCard
                            icon={Briefcase}
                            label={language === 'en' ? 'Active Jobs' : language === 'hi' ? 'सक्रिय काम' : 'ਚੱਲ ਰਹੇ ਕੰਮ'}
                            value={stats.worker_active}
                            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                        />
                        <StatCard
                            icon={Clock}
                            label={language === 'en' ? 'Completed' : language === 'hi' ? 'पूरा किया' : 'ਪੂਰੇ ਹੋਏ'}
                            value={stats.worker_history || 0}
                            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                        />
                    </div>
                </header>
            )}

            {/* 3. CATEGORY HERO & LOCATION WARNING (Only on FIND tab) */}
            {workerTab === 'FIND' && (
                <>
                    {/* Simplified Location Warning */}
                    {!user.coordinates && (
                        <div className="px-6 mb-4 flex items-center justify-between bg-red-50 dark:bg-red-900/10 p-3 rounded-xl mx-6 border border-red-100 dark:border-red-900/30">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <MapPin size={14} />
                                <span className="text-xs font-bold">{language === 'en' ? 'Location not set' : language === 'hi' ? 'लोकेशन सेट नहीं है' : 'ਲੋਕੇਸ਼ਨ ਸੈੱਟ ਨਹੀਂ ਹੈ'}</span>
                            </div>
                            <button onClick={() => navigate('/profile')} className="text-[10px] font-black uppercase tracking-wider text-red-500 underline decoration-2 underline-offset-2">
                                {language === 'en' ? 'Fix' : language === 'hi' ? 'ठीक करें' : 'ਠੀਕ ਕਰੋ'}
                            </button>
                        </div>
                    )}

                    <div className="px-6 mb-4">
                        <h3 className="text-lg font-black text-text-primary tracking-tight">
                            {language === 'en' ? 'Explore Categories' : language === 'hi' ? 'श्रेणियाँ खोजें' : 'ਸ਼੍ਰੇਣੀਆਂ ਦੇਖੋ'}
                        </h3>
                    </div>
                    <CategoryHero />
                    <SkillNudgeCard onClick={() => setShowEditProfile(true)} />

                    {/* Unified Sticky Control Bar */}
                    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50 px-6 py-3 mt-0 mb-4 flex flex-col gap-3 shadow-sm transition-all -mx-0">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 overflow-hidden">
                                <FilterPills
                                    activeFilters={quickFilters}
                                    onToggle={toggleQuickFilter}
                                    language={language}
                                />
                            </div>
                            <div className="flex items-center gap-2 shrink-0 border-l border-border pl-3 ml-1">
                                <button
                                    onClick={() => setViewMode(viewMode === 'LIST' ? 'MAP' : 'LIST')}
                                    className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl shadow-sm border border-border text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-primary transition-all active:scale-95 whitespace-nowrap"
                                >
                                    {viewMode === 'LIST' ? <><MapIcon size={14} /> Map</> : <><ListIcon size={14} /> List</>}
                                </button>

                                <button
                                    onClick={() => setShowFilters(true)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-sm border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap ${filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All' ? 'bg-primary text-white border-transparent' : 'bg-surface border-border text-text-secondary hover:text-primary'}`}
                                >
                                    <SlidersHorizontal size={14} />
                                    {(filterLocation || filterMinBudget || filterMaxDistance || selectedCategory !== 'All') && (
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse absolute top-2 right-2" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Feed Switcher (For You / Recent) */}
                        <div className="flex items-center justify-center">
                            <div className="flex bg-surface-dark/5 p-1 rounded-2xl border border-border/50 backdrop-blur-md w-full max-w-[400px]">
                                <button
                                    onClick={() => setFeedMode('RECOMMENDED')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${feedMode === 'RECOMMENDED' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    <Sparkles size={12} className={feedMode === 'RECOMMENDED' ? 'text-primary' : ''} />
                                    {language === 'en' ? 'For You' : language === 'hi' ? 'आपके लिए' : 'ਤੁਹਾਡੇ ਲਈ'}
                                </button>
                                <button
                                    onClick={() => setFeedMode('ALL')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${feedMode === 'ALL' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    <ListIcon size={12} className={feedMode === 'ALL' ? 'text-primary' : ''} />
                                    {language === 'en' ? 'Recent' : language === 'hi' ? 'हाल के' : 'ਹਾਲ ਹੀ ਵਿੱਚ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}



            {/* 5. JOB LIST HEADER & INFO */}
            {workerTab === 'FIND' && !loading && filteredJobs.length > 0 && (
                <div className="px-6 flex items-center justify-between mb-1 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping [animation-duration:3s]" />
                            <div className="w-2 h-2 bg-emerald-500 rounded-full relative z-10" />
                        </div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted flex items-center gap-1.5">
                            <span className="text-text-primary">{filteredJobs.length}</span>
                            {language === 'en' ? 'Jobs Available' : language === 'hi' ? 'काम उपलब्ध हैं' : 'ਕੰਮ ਉਪਲਬਧ ਹਨ'}
                            {selectedCategory !== 'All' && (
                                <span className="text-primary/70"> • {selectedCategory}</span>
                            )}
                        </h2>
                    </div>
                    {/* Location/Category Context or Reset */}
                    {onClearFilters && (selectedCategory !== 'All' || filterLocation || filterMinBudget || filterMaxDistance || searchQuery) ? (
                        <button
                            onClick={onClearFilters}
                            className="bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                        >
                            <LayoutGrid size={10} strokeWidth={3} />
                            {language === 'en' ? 'See All Jobs' : language === 'hi' ? 'सभी काम देखें' : 'ਸਾਰੇ ਕੰਮ ਦੇਖੋ'}
                        </button>
                    ) : (
                        user.location && !filterLocation && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface rounded-full border border-border/50 text-[9px] font-bold text-text-muted shadow-sm">
                                <MapPin size={10} className="text-primary" />
                                <span className="truncate max-w-[120px]">{user.location}</span>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* 5. JOB LIST */}
            <div className="px-6 mt-2">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map(i => <JobCardSkeleton key={i} />)}
                    </div>
                ) : filteredJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {viewMode === 'LIST' ? (
                            filteredJobs.map(job => (
                                <div key={job.id} className="h-full transform hover:-translate-y-2 transition-transform duration-500">
                                    {(workerTab === 'ACTIVE' || workerTab === 'HISTORY') ? (
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
                                            userRole={UserRole.WORKER}
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
                                <React.Suspense fallback={
                                    <div className="h-[500px] w-full bg-surface rounded-3xl flex items-center justify-center">
                                        <Loader2 className="animate-spin text-primary" size={48} />
                                    </div>
                                }>
                                    <JobMap
                                        jobs={filteredJobs}
                                        onJobClick={onClick}
                                        userLocation={user.coordinates}
                                    />
                                </React.Suspense>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-24 h-24 bg-surface rounded-[2.5rem] flex items-center justify-center mb-8 border border-border shadow-sm transform rotate-6 hover:rotate-0 transition-transform duration-500">
                            <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] animate-pulse" />
                            <Briefcase className="text-text-muted relative z-10" size={40} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-text-primary tracking-tight mb-3">
                            {language === 'en' ? 'No Jobs Found' : language === 'hi' ? 'कोई काम नहीं मिला' : 'ਕੋਈ ਕੰਮ ਨਹੀਂ ਲੱਭਿਆ'}
                        </h3>
                        <p className="text-sm font-medium text-text-secondary max-w-[280px] leading-relaxed mb-10">
                            {language === 'en'
                                ? 'Adjust your filters or categories to discover more earning opportunities.'
                                : language === 'hi' ? 'अधिक कमाई के अवसर खोजने के लिए अपने फ़िल्टर या श्रेणियों को बदलें।'
                                    : 'ਵਧੇਰੇ ਕਮਾਈ ਦੇ ਮੌਕੇ ਲੱਭਣ ਲਈ ਆਪਣੇ ਫਿਲਟਰ ਜਾਂ ਸ਼੍ਰੇਣੀਆਂ ਬਦਲੋ।'}
                        </p>
                        <button
                            onClick={handleForceRetry}
                            className="bg-surface border border-border px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            {language === 'en' ? 'Refresh Feed' : language === 'hi' ? 'फ़ीड रीफ़्रेश करें' : 'ਫੀਡ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ'}
                        </button>
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {hasMore && !loading && (
                <div className="flex justify-center mt-6 pb-10">
                    <button
                        onClick={fetchMoreJobs}
                        disabled={isLoadingMore}
                        className="px-12 py-6 rounded-[2.5rem] border font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all active:scale-95 flex items-center gap-6 border-primary text-primary hover:bg-primary hover:text-white"
                    >
                        {isLoadingMore ? <Loader2 size={24} className="animate-spin" /> : <RotateCw size={24} strokeWidth={3} />}
                        {isLoadingMore ? t.loading : t.loadMore}
                    </button>
                </div>
            )}

        </div>
    );
};
