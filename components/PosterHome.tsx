import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Briefcase, Zap, ChevronRight, XCircle, RotateCw, Sparkles, LayoutDashboard } from 'lucide-react';
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
}

export const PosterHome: React.FC<PosterHomeProps> = ({
    jobs, loading, error, stats, onViewBids, onEdit, onHide, onRefresh, posterTab, setPosterTab, onChat
}) => {
    const navigate = useNavigate();
    const { user, language } = useUser();

    // Premium Stat Card
    const StatCard = ({ icon: Icon, label, value, gradient }: { icon: any, label: string, value: number | string, gradient: string }) => (
        <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl border border-white/60 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm min-w-[140px] flex-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gradient} text-white shadow-lg shadow-gray-200 dark:shadow-none`}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white leading-none tracking-tight">{value}</p>
                <p className="text-[10px] uppercase font-bold text-gray-400 mt-1.5 tracking-widest">{label}</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 pb-32">

            {/* 1. WELCOME & STATS HEADER */}
            <header className="px-6 pt-2">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">
                            {language === 'en' ? 'Welcome back,' : 'वापसी पर स्वागत है,'} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                {user.name?.split(' ')[0] || 'Partner'}
                            </span>
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-2">
                            {language === 'en' ? 'Here is your hiring overview' : 'यहाँ आपका काम का अवलोकन है'}
                        </p>
                    </div>
                    {/* User Avatar Placeholder or Settings shortcut could go here */}
                </div>

                {/* KPI Stats - Holographic Style */}
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

            {/* 2. HERO ACTION: POST JOB - Rich Mesh Gradient (HIDDEN) */}
            <div className="hidden">
                <button
                    onClick={() => navigate('/post')}
                    className="w-full relative group overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all duration-300"
                >
                    {/* Ambient Background Effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 animate-pulse-subtle" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/2" />

                    {/* Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="text-left space-y-4">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-inner">
                                <Plus size={28} strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black leading-none mb-2 tracking-tight">
                                    {language === 'en' ? 'Post a New Job' : 'नया काम पोस्ट करें'}
                                </h2>
                                <p className="text-blue-100 text-sm font-semibold opacity-90">
                                    {language === 'en' ? 'Find specific workers in minutes' : 'मिनटों में वर्कर खोजें'}
                                </p>
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:text-blue-600 transition-all duration-300 shadow-lg">
                            <ChevronRight size={28} strokeWidth={3} className="-mr-1" />
                        </div>
                    </div>
                </button>
            </div>

            {/* 3. MANAGEMENT TABS - Segmented Control Pill Style */}
            <div className="px-6 sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm py-2 -mx-6 md:mx-0">
                <div className="mx-6 bg-gray-200/50 dark:bg-gray-800/50 p-1.5 rounded-2xl flex relative max-w-md">
                    <button
                        onClick={() => setPosterTab('ACTIVE')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${posterTab === 'ACTIVE'
                            ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <Sparkles size={14} strokeWidth={2.5} className={posterTab === 'ACTIVE' ? 'fill-blue-600/20' : ''} />
                        {language === 'en' ? 'Active Posts' : 'सक्रिय पोस्ट'}
                    </button>
                    <button
                        onClick={() => setPosterTab('HISTORY')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${posterTab === 'HISTORY'
                            ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <RotateCw size={14} strokeWidth={2.5} />
                        {language === 'en' ? 'History' : 'इतिहास'}
                    </button>
                </div>
            </div>

            {/* 4. MANAGEMENT LIST */}
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
                ) : jobs.length === 0 ? (
                    <div className="py-20 text-center opacity-50">
                        <LayoutDashboard size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" strokeWidth={1} />
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {posterTab === 'ACTIVE' ? (language === 'en' ? 'No active jobs' : 'कोई सक्रिय काम नहीं') : (language === 'en' ? 'No history yet' : 'कोई इतिहास नहीं')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">
                            {posterTab === 'ACTIVE' ? 'Post a job above to get started.' : 'Completed jobs will appear here.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
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
                            />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
