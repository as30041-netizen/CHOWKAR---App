import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Briefcase, Zap, ChevronRight, XCircle, RotateCw, Sparkles, LayoutDashboard, MapPin, Loader2 } from 'lucide-react';
import { Job, JobStatus, DashboardStats, UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { PosterJobCard } from './PosterJobCard';
import { JobCardSkeleton } from './Skeleton';

interface PosterHomeProps {
    jobs: Job[];
    loading: boolean;
    error: string | null;
    stats: DashboardStats;
    onViewBids: (job: Job) => void;
    onEdit: (job: Job) => void;
    onHide: (jobId: string) => void;
    onRefresh: () => void;
    posterTab: 'ACTIVE' | 'HISTORY';
    setPosterTab: (tab: 'ACTIVE' | 'HISTORY') => void;
    onChat?: (job: Job) => void;
    onClick: (job: Job) => void;
    hasMore: boolean;          // NEW: Infinite Scroll
    onLoadMore: () => void;    // NEW: Trigger Load
    isLoadingMore: boolean;    // NEW: Loading State
}

export const PosterHome: React.FC<PosterHomeProps> = ({
    jobs, loading, error, stats, onViewBids, onEdit, onHide, onRefresh, posterTab, setPosterTab, onChat, onClick,
    hasMore, onLoadMore, isLoadingMore
}) => {
    const navigate = useNavigate();
    const { user, language } = useUser();

    const StatCard = ({ icon: Icon, label, value, gradient }: { icon: any, label: string, value: number | string, gradient: string }) => (
        <div className="bg-surface/80 backdrop-blur-xl border border-border p-4 rounded-2xl flex items-center gap-4 shadow-sm min-w-[140px] flex-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg shadow-black/5`}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-2xl font-black text-text-primary leading-none tracking-tight">{value}</p>
                <p className="text-[10px] uppercase font-bold text-text-muted mt-1.5 tracking-widest">{label}</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 pb-32">
            <header className="px-6 pt-2">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tighter leading-tight">
                            {language === 'en' ? 'Welcome back,' : 'वापसी पर स्वागत है,'} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                {user.name?.split(' ')[0] || 'Partner'}
                            </span>
                        </h1>
                        <p className="text-text-secondary text-sm font-medium mt-2">
                            {language === 'en' ? 'Here is your hiring overview' : 'यहाँ आपका काम का अवलोकन है'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                    <StatCard
                        icon={Briefcase}
                        label={language === 'en' ? 'Active Jobs' : 'सक्रिय काम'}
                        value={stats.poster_active}
                        gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                    />
                    <StatCard
                        icon={Users}
                        label={language === 'en' ? 'Applicants' : 'आवेदक'}
                        value={jobs.reduce((acc, job) => acc + (job.bids?.length || job.bidCount || 0), 0)}
                        gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
                    />
                    <StatCard
                        icon={Zap}
                        label={language === 'en' ? 'Hired' : 'काम पर रखा'}
                        value={stats.poster_history}
                        gradient="bg-gradient-to-br from-orange-500 to-amber-500"
                    />
                </div>
            </header>



            <div className="px-6 sticky top-0 z-30 bg-background/95 backdrop-blur-sm py-2 -mx-6 md:mx-0">
                <div className="mx-6 bg-surface p-1.5 rounded-2xl flex relative max-w-md border border-border">
                    <button
                        onClick={() => setPosterTab('ACTIVE')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${posterTab === 'ACTIVE'
                            ? 'bg-background text-primary shadow-sm ring-1 ring-border'
                            : 'text-text-muted hover:text-text-primary'
                            }`}
                    >
                        <Sparkles size={14} strokeWidth={2.5} className={posterTab === 'ACTIVE' ? 'fill-primary/20' : ''} />
                        {language === 'en' ? 'Active Posts' : 'सक्रिय पोस्ट'}
                    </button>
                    <button
                        onClick={() => setPosterTab('HISTORY')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${posterTab === 'HISTORY'
                            ? 'bg-background text-primary shadow-sm ring-1 ring-border'
                            : 'text-text-muted hover:text-text-primary'
                            }`}
                    >
                        <RotateCw size={14} strokeWidth={2.5} />
                        {language === 'en' ? 'History' : 'इतिहास'}
                    </button>
                </div>
            </div>

            <div className="px-6 min-h-[300px]">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => <JobCardSkeleton key={i} />)}
                    </div>
                ) : error ? (
                    <div className="py-12 text-center bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                        <XCircle size={32} className="mx-auto text-red-500 mb-3" />
                        <p className="text-sm font-bold text-red-600">{error}</p>
                        <button onClick={onRefresh} className="mt-4 px-6 py-2 bg-white dark:bg-gray-800 rounded-full text-xs font-black uppercase shadow-sm text-red-600">Retry</button>
                    </div>
                ) : (jobs.length === 0 && !hasMore) ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-24 h-24 bg-surface rounded-[2.5rem] flex items-center justify-center mb-8 border border-border shadow-sm transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                            <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] animate-pulse" />
                            <LayoutDashboard className="text-text-muted relative z-10" size={40} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-text-primary tracking-tight mb-3">
                            {posterTab === 'ACTIVE'
                                ? (language === 'en' ? 'No Active Jobs' : 'कोई सक्रिय काम नहीं')
                                : (language === 'en' ? 'No History' : 'कोई इतिहास नहीं')}
                        </h3>
                        <p className="text-sm font-medium text-text-secondary max-w-[280px] leading-relaxed mb-10">
                            {posterTab === 'ACTIVE'
                                ? (language === 'en' ? 'Your live job postings will appear here when you create them.' : 'जब आप उन्हें बनाएंगे तो आपकी लाइव जॉब पोस्टिंग यहां दिखाई देंगी।')
                                : (language === 'en' ? 'Completed or cancelled jobs will be stored in your history.' : 'पूरे किए गए या रद्द किए गए काम आपके इतिहास में स्टोर किए जाएंगे।')}
                        </p>
                        {posterTab === 'ACTIVE' && (
                            <button
                                onClick={() => navigate('/post')}
                                className="bg-primary text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-xl shadow-primary/20 active:scale-95"
                            >
                                {language === 'en' ? 'Post Your First Job' : 'अपना पहला काम पोस्ट करें'}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 pb-8">
                        {jobs.map(job => (
                            <PosterJobCard
                                key={job.id}
                                job={job}
                                currentUserId={user.id}
                                language={language}
                                onViewBids={onViewBids}
                                onEdit={onEdit}
                                onHide={onHide}
                                isHistory={posterTab === 'HISTORY'}
                                onChat={onChat}
                                onClick={() => onClick(job)}
                            />
                        ))}

                        {hasMore && (
                            <button
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                                className="w-full py-4 text-sm font-bold text-primary bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                            >
                                {isLoadingMore && <Loader2 className="animate-spin" size={16} />}
                                {language === 'en' ? 'Load More Jobs' : 'अधिक लोड करें'}
                            </button>
                        )}

                        {jobs.length === 0 && hasMore && (
                            <p className="text-center text-xs text-text-muted mt-2">
                                {language === 'en' ? 'No jobs in this batch. Load more...' : 'इस बैच में कोई काम नहीं। और लोड करें...'}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
