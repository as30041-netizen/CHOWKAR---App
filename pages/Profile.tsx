import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContextDB';
import { Pencil, Crown, CheckCircle2, MapPin, Star, Award, Briefcase, LogOut, ChevronRight, Share2, ShieldCheck, Zap, ArrowLeft, TrendingUp } from 'lucide-react';
import { REVIEW_TAGS_TRANSLATIONS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '../services/authService';
import { useWallet } from '../contexts/WalletContext';
import { Trash2, AlertTriangle, X, Wallet as WalletIcon, BrainCircuit } from 'lucide-react';

interface ProfileProps {
    setShowSubscriptionModal: (show: boolean) => void;
    onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ setShowSubscriptionModal, onLogout }) => {
    const navigate = useNavigate();
    const { user, t, language, showAlert, setShowEditProfile } = useUser();
    const { walletBalance } = useWallet();
    const [postedJobsCount, setPostedJobsCount] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    React.useEffect(() => {
        const fetchJobCount = async () => {
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
            if (!isValidUUID) return;

            const { count, error } = await supabase
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .eq('poster_id', user.id);

            if (!error && count !== null) {
                setPostedJobsCount(count);
            }
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

    return (
        <div className="pb-32 md:pb-10 animate-fade-in px-6 max-w-4xl mx-auto space-y-10 pt-8">
            {/* Navigation Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => window.history.back()}
                    className="p-4 bg-white dark:bg-gray-900 rounded-3xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-90 shadow-glass border border-gray-100 dark:border-gray-800 group"
                    title="Go Back"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div>
                    <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em] leading-none mb-1">{t.myProfile || 'Profile'}</h3>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{user.name}</h2>
                </div>
            </div>

            {/* Header Profile Card */}
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-glass border-4 border-white dark:border-gray-800 overflow-hidden transition-all group relative">
                <div className="h-56 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-1000">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                    <div className="absolute top-8 right-8 flex gap-3">
                        <button onClick={handleShareProfile} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3.5 rounded-2xl text-white transition-all active:scale-95 group/share border border-white/10 shadow-lg">
                            <Share2 size={20} className="group-hover/share:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => setShowEditProfile(true)} className="bg-white text-emerald-600 hover:bg-emerald-50 p-3.5 rounded-2xl transition-all active:scale-95 group/edit shadow-lg">
                            <Pencil size={20} className="group-hover/edit:rotate-12 transition-transform" />
                        </button>
                    </div>

                    {user.isPremium && (
                        <div className="absolute top-8 left-8 bg-amber-400 text-amber-950 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl border border-amber-300 animate-pulse-slow">
                            <Crown size={14} fill="currentColor" /> Premium Member
                        </div>
                    )}
                </div>

                <div className="px-8 pb-10 -mt-20 flex flex-col items-center relative z-10">
                    <div className="w-40 h-40 bg-white dark:bg-gray-900 p-2 rounded-[3rem] shadow-2xl mb-6 relative group/avatar">
                        <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center border-4 border-gray-100 dark:border-gray-800">
                            {user.profilePhoto ? (
                                <img src={user.profilePhoto} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-700" alt={user.name} />
                            ) : (
                                <span className="text-5xl font-black text-emerald-600 dark:text-emerald-400">{(user.name || '?').charAt(0)}</span>
                            )}
                        </div>
                        {user.verified && (
                            <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-2xl shadow-xl border-4 border-white dark:border-gray-900">
                                <ShieldCheck size={20} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">{user.name}</h2>
                    <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] bg-gray-50 dark:bg-gray-800/50 px-6 py-2.5 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm">
                        <MapPin size={14} className="text-emerald-500" strokeWidth={3} /> {user.location || 'Location not set'}
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
                    <div key={i} className={`bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border-4 ${stat.border} shadow-glass text-center group hover:-translate-y-2 transition-all duration-300`}>
                        <div className={`${stat.bg} ${stat.color} w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                            <stat.icon size={28} strokeWidth={3} />
                        </div>
                        <div className="font-black text-gray-900 dark:text-white text-2xl tracking-tight mb-1">{stat.value}</div>
                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Wallet & AI Quick Access */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Wallet Balance Card */}
                <div
                    onClick={() => navigate('/wallet')}
                    className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 border-4 border-amber-500/20 dark:border-amber-500/10 shadow-glass cursor-pointer hover:scale-[1.01] active:scale-95 transition-all group overflow-hidden relative"
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-full blur-3xl group-hover:bg-amber-100 transition-colors" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 transition-transform group-hover:rotate-12">
                                <WalletIcon size={28} strokeWidth={3} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none mb-1">My Wallet</h3>
                                <p className="text-2xl font-black text-amber-600 tracking-tight">{walletBalance} <span className="text-xs uppercase tracking-widest text-amber-400">Coins</span></p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <ChevronRight size={24} className="text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                            <span className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest">Add Money</span>
                        </div>
                    </div>
                </div>

                {/* AI usage Tracker Card */}
                <div
                    className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 border-4 border-indigo-500/20 dark:border-indigo-500/10 shadow-glass transition-all group overflow-hidden relative"
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                                <BrainCircuit size={28} strokeWidth={3} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none mb-1">AI Usage</h3>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (user.aiUsageCount || 0) * 10)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-black text-indigo-600">{user.aiUsageCount || 0}/10</span>
                                </div>
                            </div>
                        </div>
                        {user.aiUsageCount >= 10 && !user.isPremium ? (
                            <button
                                onClick={() => setShowSubscriptionModal(true)}
                                className="text-[8px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all"
                            >
                                Get Unlimited
                            </button>
                        ) : (
                            <span className="text-[8px] font-black text-indigo-500/50 uppercase tracking-widest">Credits Used</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Double Column Info Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* About Me */}
                <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 border-4 border-white dark:border-gray-800 shadow-glass space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                        {t.aboutMe}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed font-medium">
                        {user.bio || "No bio added yet. Tell people more about your professional background and service quality."}
                    </p>
                </div>

                {/* Skills */}
                <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 border-4 border-white dark:border-gray-800 shadow-glass space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                        Professional Skills
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {user.skills && user.skills.length > 0 ? user.skills.map((s, i) => (
                            <span key={i} className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800/50 shadow-sm flex items-center gap-2">
                                <Zap size={12} fill="currentColor" /> {s}
                            </span>
                        )) : (
                            <div className="py-2 px-1 text-gray-400 dark:text-gray-600 italic">No skills added yet. Skill up to get noticed!</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-12 border-4 border-white dark:border-gray-800 shadow-glass space-y-10">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                        Community Reviews
                    </h3>
                    <div className="bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-2xl border-2 border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                        <Star size={16} fill="orange" className="text-orange-400" />
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400">{user.reviews?.length || 0} Total</span>
                    </div>
                </div>

                <div className="grid gap-12">
                    {user.reviews && user.reviews.length > 0 ? (
                        user.reviews.map(review => (
                            <div key={review.id} className="relative group/review">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-emerald-600 text-xl">
                                            {review.reviewerName?.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="font-black text-gray-900 dark:text-white block text-lg mb-1">{review.reviewerName}</span>
                                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{new Date(review.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-2xl border-2 border-amber-100 dark:border-amber-900/30">
                                        <Star size={16} fill="orange" className="text-orange-400" />
                                        <span className="text-sm font-black text-amber-600 dark:text-amber-400 ml-1">{review.rating}</span>
                                    </div>
                                </div>

                                {review.tags && review.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4 ml-18 px-1">
                                        {review.tags.map((tag, i) => (
                                            <span key={i} className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                                {REVIEW_TAGS_TRANSLATIONS[tag]?.[language === 'hi' ? 'hi' : 'en'] || tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <blockquote className="text-xl text-gray-600 dark:text-gray-400 italic font-medium leading-relaxed pl-6 border-l-4 border-gray-50 dark:border-gray-800">
                                    "{review.comment}"
                                </blockquote>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/20 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800">
                            <h4 className="text-xl font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest">No Feedback Yet</h4>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-6">
                {!user.isPremium && (
                    <button
                        onClick={() => setShowSubscriptionModal(true)}
                        className="w-full flex items-center justify-between px-10 py-6 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-amber-500/30 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <Crown size={24} fill="currentColor" className="group-hover:rotate-12 transition-transform" />
                            {t.upgradePremium}
                        </div>
                        <ChevronRight size={24} strokeWidth={3} />
                    </button>
                )}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs border-4 border-red-100 dark:border-red-900/20 active:scale-95 transition-all hover:bg-red-600 hover:text-white hover:border-red-600"
                >
                    <LogOut size={22} strokeWidth={3} /> {t.signOut}
                </button>

                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-4 text-gray-400 dark:text-gray-500 py-4 hover:text-red-500 transition-colors font-black uppercase tracking-[0.2em] text-[10px]"
                >
                    <Trash2 size={14} /> {language === 'hi' ? 'खाता हटाएं' : 'Delete Account'}
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in shadow-2xl">
                    <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 max-w-md w-full border-4 border-red-500/20 shadow-2xl space-y-8 animate-scale-in">
                        <div className="flex justify-between items-center text-red-500">
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                                <AlertTriangle size={32} />
                            </div>
                            <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                {language === 'hi' ? 'क्या आप निश्चित हैं?' : 'Are you absolutely sure?'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                {language === 'hi'
                                    ? 'आपका प्रोफ़ाइल डेटा मिटा दिया जाएगा। यह कार्रवाई वापस नहीं ली जा सकती।'
                                    : 'Your profile data will be wiped. This action cannot be undone and you will lose access to your account.'}
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/30 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? (language === 'hi' ? 'मिटा रहा है...' : 'DELETING...') : (language === 'hi' ? 'हाँ, मेरा खाता हटाएं' : 'YES, DELETE MY ACCOUNT')}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-5 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
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
