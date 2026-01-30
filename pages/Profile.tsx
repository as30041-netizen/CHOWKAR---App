import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContextDB';
import { Pencil, Crown, CheckCircle2, MapPin, Star, Award, Briefcase, LogOut, ChevronRight, Share2, ShieldCheck, Zap, ArrowLeft, TrendingUp } from 'lucide-react';
import { REVIEW_TAGS_TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '../services/authService';
import { Trash2, AlertTriangle, X, BrainCircuit } from 'lucide-react';
import { ProfileSkeleton } from '../components/Skeleton';

interface ProfileProps {
    setShowSubscriptionModal: (show: boolean) => void;
    onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ setShowSubscriptionModal, onLogout }) => {
    const navigate = useNavigate();
    const { user, t, language, showAlert, setShowEditProfile } = useUser();
    const [postedJobsCount, setPostedJobsCount] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const fetchJobCount = async () => {
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
            if (!isValidUUID) return;

            // Calculate start of current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { count, error } = await supabase
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .eq('poster_id', user.id)
                .gte('created_at', startOfMonth);

            if (!error && count !== null) {
                setPostedJobsCount(count);
            }

            setIsLoading(false);
        };
        if (user.id) fetchJobCount();
    }, [user.id]);

    const handleShareProfile = () => {
        if (navigator.share) {
            navigator.share({
                title: `Check out ${user.name}'s profile on CHOWKAR`,
                text: `Hire expert local services from ${user.name}!`,
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(window.location.href);
            showAlert(language === 'en' ? 'Profile link copied!' : 'प्रोफ़ाइल लिंक कॉपी किया गया!', 'success');
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAccount();
            if (result.success) {
                showAlert(language === 'hi' ? 'आपका खाता सफलतापूर्वक हटा दिया गया है।' : 'Your account has been deleted successfully.', 'success');
                onLogout();
            } else {
                showAlert(result.error || (language === 'hi' ? 'खाता हटाने में विफल।' : 'Failed to delete account.'), 'error');
            }
        } catch (error: any) {
            showAlert(error.message || 'An error occurred', 'error');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (isLoading) return (
        <div className="pb-32 md:pb-10 pt-safe px-6 max-w-4xl mx-auto space-y-10">
            <ProfileSkeleton />
        </div>
    );

    return (
        <div className="pb-32 md:pb-10 animate-fade-in px-6 max-w-4xl mx-auto space-y-10 pt-safe transition-all">
            {/* Navigation Header - Hidden on desktop as main header is visible */}
            <div className="flex md:hidden items-center gap-4 pt-4">
                <button
                    onClick={() => window.history.back()}
                    className="p-4 bg-surface rounded-3xl text-text-secondary hover:text-text-primary transition-all active:scale-90 shadow-glass border border-border group"
                    title="Go Back"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div>
                    <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] leading-none mb-1">{t.myProfile || 'Profile'}</h3>
                    <h2 className="text-xl font-bold text-text-primary tracking-tight leading-none">{user.name}</h2>
                </div>
            </div>

            {/* Header Profile Card */}
            <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden transition-all group relative">
                <div className={`h-56 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-1000 ${user.subscription_plan === 'PRO_POSTER' ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600' :
                    user.subscription_plan === 'WORKER_PLUS' ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-800' :
                        user.subscription_plan === 'SUPER' ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600' :
                            'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700'
                    }`}>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                    {/* Animated Mesh Blob for Extra Premium Feel */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse-slow" />
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-black/10 rounded-full blur-3xl" />

                    <div className="absolute top-8 right-8 flex gap-3">
                        <button onClick={handleShareProfile} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3.5 rounded-2xl text-white transition-all active:scale-95 group/share border border-white/10 shadow-lg">
                            <Share2 size={20} className="group-hover/share:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => setShowEditProfile(true)} className="bg-white text-emerald-600 hover:bg-emerald-50 p-3.5 rounded-2xl transition-all active:scale-95 group/edit shadow-lg">
                            <Pencil size={20} className="group-hover/edit:rotate-12 transition-transform" />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowSubscriptionModal(true)}
                        className={`absolute top-6 left-6 px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-xl border animate-pulse-slow transition-all hover:scale-105 ${user.subscription_plan && user.subscription_plan !== 'FREE'
                            ? 'bg-white text-black border-white/50'
                            : 'bg-black/20 text-white border-white/20 hover:bg-black/30'
                            }`}>
                        <Crown size={12} fill={user.subscription_plan && user.subscription_plan !== 'FREE' ? "currentColor" : "none"} />
                        {user.subscription_plan === 'PRO_POSTER' ? 'Pro Poster' :
                            user.subscription_plan === 'WORKER_PLUS' ? 'Worker Plus' :
                                user.subscription_plan === 'SUPER' ? 'Super Plan' :
                                    'Free Plan (Upgrade)'}
                    </button>
                </div>

                <div className="px-8 pb-10 -mt-20 flex flex-col items-center relative z-10">
                    <div className="w-32 h-32 bg-surface p-1.5 rounded-3xl shadow-xl mb-4 relative group/avatar">
                        <div className="w-full h-full rounded-[1.25rem] overflow-hidden bg-background flex items-center justify-center border-2 border-border">
                            {user.profilePhoto ? (
                                <img src={user.profilePhoto} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-700" alt={user.name} />
                            ) : (
                                <span className="text-4xl font-bold text-primary">{(user.name || '?').charAt(0)}</span>
                            )}
                        </div>
                        {user.verified && (
                            <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-1.5 rounded-xl shadow-lg border-2 border-white dark:border-gray-900">
                                <ShieldCheck size={16} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-2">{user.name}</h2>
                    <div className="flex items-center gap-2 text-text-secondary font-bold text-[9px] uppercase tracking-[0.2em] bg-background px-5 py-2 rounded-full border border-border shadow-sm">
                        <MapPin size={12} className="text-primary" strokeWidth={3} /> {user.location || 'Location not set'}
                    </div>
                </div>
            </div>

            {/* Market Insights Link (Preserved Data Value) - HIDDEN UNTIL CORE FINALIZED */}
            {/* 
            <div 
                onClick={() => navigate('/analytics')}
                className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 border-4 border-emerald-500/20 dark:border-emerald-500/10 shadow-glass cursor-pointer hover:scale-[1.01] active:scale-95 transition-all group overflow-hidden relative"
            >
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl group-hover:bg-emerald-100 transition-colors" />
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 transition-transform group-hover:rotate-12">
                            <TrendingUp size={28} strokeWidth={3} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none mb-1">Market Insights</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Real-time Job Trends & Stats</p>
                        </div>
                    </div>
                    <ChevronRight size={24} className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </div>
            </div>
            */}

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { icon: Star, value: user.rating.toFixed(1), label: t.rating, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-900/30' },
                    { icon: Award, value: user.experience || 'New', label: t.experience, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-100 dark:border-purple-900/30' },
                    { icon: CheckCircle2, value: user.jobsCompleted || 0, label: t.jobsDone, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-900/30' },
                    { icon: Briefcase, value: postedJobsCount, label: t.jobsPosted, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-900/30' }
                ].map((stat, i) => (
                    <div key={i} className={`bg-surface p-6 rounded-3xl border ${stat.border} shadow-sm text-center group hover:-translate-y-1 transition-all duration-300`}>
                        <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                            <stat.icon size={22} strokeWidth={2.5} />
                        </div>
                        <div className="font-bold text-text-primary text-xl tracking-tight mb-0.5">{stat.value}</div>
                        <div className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Membership & AI Usage Trackers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Membership Usage Tracker */}
                <div
                    onClick={() => setShowSubscriptionModal(true)}
                    className={`bg-surface rounded-3xl p-6 border shadow-sm cursor-pointer hover:scale-[1.01] active:scale-95 transition-all group overflow-hidden relative ${user.subscription_plan === 'PRO_POSTER' ? 'border-amber-500/30' : 'border-border'
                        }`}
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl transition-transform group-hover:rotate-12 ${user.subscription_plan === 'PRO_POSTER' ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'
                                    }`}>
                                    <Crown size={24} strokeWidth={2.5} fill={user.subscription_plan === 'PRO_POSTER' ? "currentColor" : "none"} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-text-primary leading-none mb-1">
                                        {user.subscription_plan === 'FREE' ? 'Free Plan' : 'Membership'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                        {user.subscription_plan === 'FREE' ? 'Upgrade to Unlock Limits' : 'Active & Valid'}
                                    </p>
                                    {user.subscription_expiry && user.subscription_plan !== 'FREE' && (
                                        <p className="text-[9px] font-bold text-primary mt-1 uppercase tracking-tight">
                                            Valid Until: {new Date(user.subscription_expiry).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>

                        {/* Usage Bars */}
                        <div className="space-y-3 pt-2">
                            {/* Job Posts Limit */}
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-1.5">
                                    <span className="text-text-secondary">{!user.subscription_plan || user.subscription_plan === 'FREE' ? 'Free Posts' : 'Total Posts'}</span>
                                    <span className="text-text-primary">
                                        {['PRO_POSTER', 'SUPER'].includes(user.subscription_plan || '')
                                            ? <span className="text-emerald-600">Unlimited</span>
                                            : `${postedJobsCount}/3`}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border/50">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${postedJobsCount >= 3 && (!user.subscription_plan || user.subscription_plan === 'FREE') ? 'bg-red-500' : 'bg-primary'
                                            }`}
                                        style={{ width: (!user.subscription_plan || user.subscription_plan === 'FREE') ? `${Math.min(100, (postedJobsCount / 3) * 100)}%` : '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Bids Limit */}
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-1.5">
                                    <span className="text-text-secondary">Weekly Bids</span>
                                    <span className="text-text-primary">
                                        {['WORKER_PLUS', 'SUPER'].includes(user.subscription_plan || '')
                                            ? <span className="text-emerald-600">Unlimited</span>
                                            : `${user.weeklyBidsCount || 0}/5`}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border/50">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${['WORKER_PLUS', 'SUPER'].includes(user.subscription_plan || '') ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-blue-500'}`}
                                        style={{ width: ['WORKER_PLUS', 'SUPER'].includes(user.subscription_plan || '') ? '100%' : `${Math.min(100, ((user.weeklyBidsCount || 0) / 5) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI usage Tracker Card */}
                <div
                    className="bg-surface rounded-3xl p-6 border border-indigo-500/20 dark:border-indigo-500/10 shadow-sm transition-all group overflow-hidden relative"
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                                <BrainCircuit size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-text-primary leading-none mb-1">AI Usage</h3>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (user.aiUsageCount || 0) * 10)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600">
                                        {['PRO_POSTER', 'SUPER'].includes(user.subscription_plan || '')
                                            ? 'Unlimited'
                                            : `${user.aiUsageCount || 0}/${FREE_AI_USAGE_LIMIT}`
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                        {user.aiUsageCount >= FREE_AI_USAGE_LIMIT && (!user.subscription_plan || user.subscription_plan === 'FREE') ? (
                            <button
                                onClick={() => setShowSubscriptionModal(true)}
                                className="text-[8px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all"
                            >
                                Get Unlimited
                            </button>
                        ) : (
                            <span className="text-[8px] font-bold text-indigo-500/50 uppercase tracking-widest">AI Requests</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Double Column Info Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* About Me */}
                <div className="bg-surface rounded-3xl p-8 border border-border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-3 bg-primary rounded-full" />
                        {t.aboutMe}
                    </h3>
                    <p className="text-text-secondary text-base leading-relaxed font-medium">
                        {user.bio || "No bio added yet. Tell people more about your professional background and service quality."}
                    </p>
                </div>

                {/* Skills */}
                <div className="bg-surface rounded-3xl p-8 border border-border shadow-sm space-y-4">
                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-3 bg-primary rounded-full" />
                        Professional Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {user.skills && user.skills.length > 0 ? user.skills.map((s, i) => (
                            <span key={i} className="bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-primary/20 shadow-sm flex items-center gap-1.5">
                                <Zap size={11} fill="currentColor" /> {s}
                            </span>
                        )) : (
                            <div className="py-2 px-1 text-text-muted italic text-sm">No skills added yet. Skill up to get noticed!</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-surface rounded-3xl p-8 border border-border shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-3 bg-amber-500 rounded-full" />
                        Community Reviews
                    </h3>
                    <div className="bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-1.5">
                        <Star size={14} fill="orange" className="text-orange-400" />
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{user.reviews?.length || 0} Total</span>
                    </div>
                </div>

                <div className="grid gap-8">
                    {user.reviews && user.reviews.length > 0 ? (
                        user.reviews.map(review => (
                            <div key={review.id} className="relative group/review">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center font-bold text-primary text-base">
                                            {review.reviewerName?.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="font-bold text-text-primary block text-base mb-0.5">{review.reviewerName}</span>
                                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">{new Date(review.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                        <Star size={14} fill="orange" className="text-orange-400" />
                                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-0.5">{review.rating}</span>
                                    </div>
                                </div>

                                {review.tags && review.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3 pl-13 px-1">
                                        {review.tags.map((tag, i) => (
                                            <span key={i} className="text-[8px] font-bold uppercase tracking-widest text-text-muted bg-background px-2.5 py-1 rounded-lg border border-border">
                                                {REVIEW_TAGS_TRANSLATIONS[tag]?.[language === 'hi' ? 'hi' : 'en'] || tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <blockquote className="text-base text-text-secondary italic font-medium leading-relaxed pl-4 border-l-2 border-border">
                                    "{review.comment}"
                                </blockquote>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-background/50 rounded-2xl border border-dashed border-border">
                            <h4 className="text-lg font-bold text-text-muted uppercase tracking-widest">No Feedback Yet</h4>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-4">
                {!user.isPremium && (
                    <button
                        onClick={() => setShowSubscriptionModal(true)}
                        className="w-full flex items-center justify-between px-8 py-5 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Crown size={20} fill="currentColor" className="group-hover:rotate-12 transition-transform" />
                            {t.upgradePremium}
                        </div>
                        <ChevronRight size={20} strokeWidth={2.5} />
                    </button>
                )}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] border border-red-100 dark:border-red-900/20 active:scale-95 transition-all hover:bg-red-600 hover:text-white hover:border-red-600"
                >
                    <LogOut size={18} strokeWidth={2.5} /> {t.signOut}
                </button>

                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-3 text-text-muted py-3 hover:text-red-500 transition-colors font-bold uppercase tracking-[0.2em] text-[9px]"
                >
                    <Trash2 size={12} /> {language === 'hi' ? 'खाता हटाएं' : 'Delete Account'}
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full border border-red-500/20 shadow-2xl space-y-6 animate-scale-in">
                        <div className="flex justify-between items-center text-red-500">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <AlertTriangle size={28} />
                            </div>
                            <button onClick={() => setShowDeleteConfirm(false)} className="p-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {language === 'hi' ? 'क्या आप निश्चित हैं?' : 'Are you absolutely sure?'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                {language === 'hi'
                                    ? 'आपका प्रोफ़ाइल डेटा मिटा दिया जाएगा। यह कार्रवाई वापस नहीं ली जा सकती।'
                                    : 'Your profile data will be wiped. This action cannot be undone.'}
                            </p>
                        </div>

                        <div className="grid gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? (language === 'hi' ? 'मिटा रहा है...' : 'DELETING...') : (language === 'hi' ? 'हाँ, मेरा खाता हटाएं' : 'YES, DELETE MY ACCOUNT')}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                            >
                                {language === 'hi' ? 'नहीं, वापस जाएं' : 'NO, TAKE ME BACK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
