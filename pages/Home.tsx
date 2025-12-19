import React, { useState } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { JobCard } from '../components/JobCard';
import { JobCardSkeleton } from '../components/Skeleton';
import { Job, UserRole, JobStatus } from '../types';
import { calculateDistance } from '../utils/geo';
import { CATEGORIES, CATEGORY_TRANSLATIONS } from '../constants';
import { Search, SlidersHorizontal, CheckCircle2, Mic, MicOff, Briefcase, RotateCw, Loader2 } from 'lucide-react';

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

import { FilterModal } from '../components/FilterModal';

export const Home: React.FC<HomeProps> = ({
    onBid, onViewBids, onChat, onEdit, onClick, onReplyToCounter, onWithdrawBid,
    setShowFilterModal: _setShowFilterModal, showAlert
}) => {
    const { user, role, setRole, t, language, notifications } = useUser();
    const { jobs, loading, error, refreshJobs, fetchMoreJobs, hasMore, isLoadingMore } = useJobs();

    // Poster Dashboard State
    const [dashboardTab, setDashboardTab] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

    // Local state for search/filter within Home
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isSearchingVoice, setIsSearchingVoice] = useState(false);
    const [showMyBidsOnly, setShowMyBidsOnly] = useState(false);

    // Filter Logic integrated
    const [filterLocation, setFilterLocation] = useState('');
    const [filterMinBudget, setFilterMinBudget] = useState('');
    const [filterMaxDistance, setFilterMaxDistance] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const toggleVoiceInput = () => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) { showAlert("Voice input not supported", 'error'); return; }
        if (isSearchingVoice) { setIsSearchingVoice(false); try { (window as any).recognition?.stop(); } catch (e) { } return; }

        setIsSearchingVoice(true);
        try {
            const recognition = new SpeechRecognition();
            (window as any).recognition = recognition;
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
            recognition.onresult = (event: any) => { setSearchQuery(event.results[0][0].transcript); setIsSearchingVoice(false); };
            recognition.onerror = () => setIsSearchingVoice(false);
            recognition.onend = () => setIsSearchingVoice(false);
            recognition.start();
        } catch (e) { setIsSearchingVoice(false); }
    };

    return (
        <div className="p-4 animate-fade-in pb-24 md:pb-6">
            <FilterModal
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                currentFilters={{ location: filterLocation, minBudget: filterMinBudget, maxDistance: filterMaxDistance }}
                onApply={(f) => {
                    setFilterLocation(f.location);
                    setFilterMinBudget(f.minBudget);
                    setFilterMaxDistance(f.maxDistance);
                }}
            />

            {/* Mode Switcher (Global Role Toggle) */}
            <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex mb-6">
                <button
                    onClick={() => setRole(UserRole.WORKER)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${role === UserRole.WORKER
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <Briefcase size={18} />
                    {language === 'en' ? 'Find Work' : 'काम ढूंढे'}
                </button>
                <button
                    onClick={() => setRole(UserRole.POSTER)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${role === UserRole.POSTER
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <CheckCircle2 size={18} />
                    {language === 'en' ? 'Hire / My Jobs' : 'हायर / मेरे जॉब्स'}
                </button>
            </div>

            {/* Header Title (Dynamic based on Mode) */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                    {role === UserRole.POSTER
                        ? (language === 'en' ? 'My Job Dashboard' : 'मेरा जॉब डैशबोर्ड')
                        : (showMyBidsOnly ? t.myApplications : t.jobsNearMe)
                    }
                    <button onClick={refreshJobs} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-full" title="Refresh Jobs">
                        <div className={loading ? 'animate-spin' : ''}><RotateCw size={16} /></div>
                    </button>
                </h2>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={refreshJobs} className="font-bold underline">Retry</button>
                </div>
            )}

            {/* Search/Filter Bar */}
            <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            style={{ colorScheme: 'light', backgroundColor: '#ffffff', color: '#000000', caretColor: '#000000' }}
                            type="text"
                            placeholder={role === UserRole.WORKER ? t.searchWork : (language === "en" ? "Search my jobs..." : "मेरे जॉब्स खोजें...")}
                            className="w-full pl-10 pr-10 py-2.5 appearance-none bg-white text-black border border-emerald-100 rounded-xl text-sm outline-none shadow-sm placeholder-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <button
                            onClick={toggleVoiceInput}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isSearchingVoice ? 'bg-red-50 text-red-500 animate-pulse' : 'hover:bg-gray-100 text-gray-400'}`}
                        >
                            {isSearchingVoice ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                    </div>
                    <button onClick={() => setShowFilters(true)} className={`p-2.5 rounded-xl border transition-colors shadow-sm ${filterLocation || filterMinBudget || filterMaxDistance ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-gray-500'}`}>
                        <SlidersHorizontal size={20} />
                        {(filterLocation || filterMinBudget || filterMaxDistance) && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white transform translate-x-1 -translate-y-1"></span>}
                    </button>
                </div>
                <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                    {role === UserRole.WORKER && (
                        <button onClick={() => setShowMyBidsOnly(!showMyBidsOnly)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border ${showMyBidsOnly ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                            <CheckCircle2 size={12} /> {t.myBids}
                        </button>
                    )}
                    {['All', ...CATEGORIES].map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}>
                            {cat === 'All' ? t.allJobs : (CATEGORY_TRANSLATIONS[cat]?.[language] || cat)}
                        </button>
                    ))}
                </div>
            </div>

            {/* POSTER DASHBOARD: Status Tabs & Stats */}
            {role === UserRole.POSTER && (
                <div className="mb-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center">
                            <h3 className="text-2xl font-bold text-blue-700">
                                {jobs.filter(j => j.posterId === user.id && j.status === 'OPEN').length}
                            </h3>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Open</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                            <h3 className="text-2xl font-bold text-amber-700">
                                {jobs.filter(j => j.posterId === user.id && j.status === 'IN_PROGRESS').length}
                            </h3>
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">In Progress</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center">
                            <h3 className="text-2xl font-bold text-emerald-700">
                                {jobs.filter(j => j.posterId === user.id && j.status === 'COMPLETED').length}
                            </h3>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Completed</p>
                        </div>
                    </div>

                    {/* Dashboard Tabs */}
                    <div className="flex p-1 bg-gray-100 rounded-xl overflow-x-auto no-scrollbar">
                        {(['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setDashboardTab(tab)}
                                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${dashboardTab === tab
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab === 'ALL' ? (language === 'en' ? 'All Jobs' : 'सभी') :
                                    tab === 'OPEN' ? (language === 'en' ? 'Open' : 'ओपन') :
                                        tab === 'IN_PROGRESS' ? (language === 'en' ? 'Active' : 'सक्रिय') :
                                            (language === 'en' ? 'Done' : 'पूर्ण')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Job List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map(j => ({ ...j, distance: (user.coordinates && j.coordinates) ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng) : undefined }))
                    .filter(j => {
                        // POSTER MODE: Show My Jobs (Filtered by Dashboard Tab)
                        if (role === UserRole.POSTER) {
                            if (j.posterId !== user.id) return false;
                            if (dashboardTab !== 'ALL' && j.status !== dashboardTab) return false;
                            return true;
                        }

                        // WORKER MODE: Show Nearby Jobs / Applications
                        const isMyJob = j.posterId === user.id;
                        const myBid = j.bids.find(b => b.workerId === user.id);

                        if (isMyJob) return false; // Don't show own jobs in finder
                        if (showMyBidsOnly && !myBid) return false;
                        if (j.status !== JobStatus.OPEN && !myBid) return false;

                        // Apply Filters
                        if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                        if (selectedCategory !== 'All' && j.category !== selectedCategory) return false;
                        if (filterLocation && !(j.location || '').toLowerCase().includes(filterLocation.toLowerCase())) return false;
                        if (filterMinBudget && j.budget < parseInt(filterMinBudget)) return false;
                        if (filterMaxDistance && j.distance !== undefined && j.distance > parseInt(filterMaxDistance)) return false;

                        return true;
                    }).map(job => (
                        <div key={job.id} className="animate-fade-in-up h-full">
                            <JobCard job={job} currentUserId={user.id} userRole={role} distance={job.distance} language={language}
                                hasUnreadBids={notifications.some(n =>
                                    n.relatedJobId === job.id &&
                                    !n.read &&
                                    n.title === 'New Bid'
                                )}
                                onBid={(id) => onBid(id)}
                                onViewBids={(j) => onViewBids(j)}
                                onChat={onChat}
                                onEdit={onEdit}
                                onClick={() => onClick(job)}
                                onReplyToCounter={onReplyToCounter}
                                onWithdrawBid={onWithdrawBid}
                            />
                        </div>
                    ))}
            </div>

            {/* Load More Button */}
            {hasMore && !loading && (
                <div className="mt-8 mb-10 flex justify-center">
                    <button
                        onClick={fetchMoreJobs}
                        disabled={isLoadingMore}
                        className={`px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 ${isLoadingMore
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white border-2 border-emerald-100 text-emerald-800 hover:bg-emerald-50 active:scale-95'
                            }`}
                    >
                        {isLoadingMore ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-emerald-600" />
                                {language === 'en' ? 'Loading...' : 'लोड हो रहा है...'}
                            </>
                        ) : (
                            <>
                                <RotateCw size={18} className="text-emerald-600" />
                                {language === 'en' ? 'Load More Jobs' : 'और जॉब देखें'}
                            </>
                        )}
                    </button>
                </div>
            )}

            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <JobCardSkeleton key={i} />)}
                </div>
            )}

            {jobs.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    <Briefcase size={48} className="mx-auto mb-2 opacity-50" />
                    <p>{t.noJobsFound}</p>
                </div>
            )}
        </div>
    );
};
