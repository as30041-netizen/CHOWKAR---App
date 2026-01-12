import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB'; // For translations
import { User, Review } from '../types';
import { getUserProfile } from '../services/authService';
import { REVIEW_TAGS_TRANSLATIONS } from '../constants';
import { ArrowLeft, MapPin, Star, Award, Briefcase, CheckCircle2, UserCircle, Phone, Loader2, Crown } from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName?: string; // Optimistic name while loading
    phoneNumber?: string; // Optional: Only passed if the viewer is allowed to see it (e.g. active job)
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, userId, userName, phoneNumber }) => {
    const { t, language } = useUser();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            getUserProfile(userId).then(({ user, error }) => {
                if (error) {
                    setError('Failed to load profile');
                } else {
                    setUser(user);
                }
                setLoading(false);
            });
        } else {
            // Reset when closed
            setUser(null);
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in transition-colors" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-[0_-8px_32px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[90vh] animate-slide-up sm:animate-pop transition-colors pb-safe" onClick={e => e.stopPropagation()}>

                {/* Header Banner */}
                <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 h-32 relative shrink-0">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                    <button onClick={onClose} className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 backdrop-blur-md p-2.5 rounded-2xl text-white transition-all active:scale-95 group z-20">
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    {user?.isPremium && (
                        <div className="absolute top-6 right-6 bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg border border-amber-300/50 z-20">
                            <Crown size={12} fill="currentColor" /> Premium
                        </div>
                    )}

                    {/* Floating Avatar */}
                    <div className="absolute -bottom-12 left-0 right-0 flex justify-center z-10">
                        <div className="w-28 h-28 bg-white dark:bg-gray-900 p-2 rounded-[2.25rem] shadow-2xl overflow-hidden group/avatar">
                            <div className="w-full h-full rounded-[1.75rem] overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center border-2 border-gray-100 dark:border-gray-800">
                                {user?.profilePhoto ? (
                                    <img src={user.profilePhoto} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500" alt={user.name} />
                                ) : (
                                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{(user?.name || userName || '?').charAt(0)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="pt-16 px-6 pb-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3">
                            <Loader2 size={32} className="animate-spin text-emerald-600" />
                            <p className="text-gray-500 text-sm">Loading profile...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500">{error}</div>
                    ) : user ? (
                        <div className="flex flex-col items-center w-full">

                            {/* Name & Location */}
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
                                    {user.name}
                                </h2>
                                <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-gray-50 dark:bg-gray-800/50 px-4 py-1.5 rounded-full border border-gray-100 dark:border-gray-800">
                                    <MapPin size={12} className="text-emerald-500" /> {user.location || 'Location not set'}
                                </div>
                                {phoneNumber && (
                                    <a href={`tel:${phoneNumber}`} className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-8 rounded-2xl font-black text-xs uppercase tracking-widest mt-6 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                                        <Phone size={16} strokeWidth={3} /> {phoneNumber}
                                    </a>
                                )}
                            </div>

                            {/* Stats Grid - Modernized */}
                            <div className="grid grid-cols-3 gap-3 w-full mb-8">
                                {[
                                    { icon: Star, value: user.rating.toFixed(1), label: t.rating, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                    { icon: CheckCircle2, value: user.jobsCompleted || 0, label: t.jobsDone, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                    { icon: Briefcase, value: user.experience || 'New', label: t.experience, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white dark:bg-gray-900 p-4 rounded-3xl text-center border border-gray-100 dark:border-gray-800 shadow-sm transition-transform hover:scale-105">
                                        <div className={`${stat.bg} ${stat.color} w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2`}>
                                            <stat.icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div className="font-black text-gray-900 dark:text-white text-base tracking-tight">{stat.value}</div>
                                        <div className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Bio Modernized */}
                            <div className="w-full mb-8">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 ml-1">
                                    <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                                    {t.aboutMe}
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {user.bio || "No bio available."}
                                    </p>
                                </div>
                            </div>

                            {/* Skills Modernized */}
                            {user.skills && user.skills.length > 0 && (
                                <div className="w-full mb-8">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 ml-1">
                                        <span className="w-1 h-3 bg-teal-500 rounded-full" />
                                        {t.skills}
                                    </h3>
                                    <div className="flex flex-wrap gap-2.5">
                                        {user.skills.map((s, i) => (
                                            <span key={i} className="bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reviews Modernized */}
                            <div className="w-full mb-4">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                                    <span className="w-1 h-3 bg-amber-500 rounded-full" />
                                    {t.reviews || "Reviews"} ({user.reviews?.length || 0})
                                </h3>
                                <div className="space-y-6">
                                    {user.reviews && user.reviews.length > 0 ? (
                                        user.reviews.map((review, i) => (
                                            <div key={review.id || i} className="group/review relative pl-4 border-l-2 border-gray-100 dark:border-gray-800 pb-1">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <span className="font-black text-sm text-gray-900 dark:text-white block mb-0.5">{review.reviewerName}</span>
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(review.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-800/50">
                                                        <Star size={12} fill="orange" className="text-orange-400" />
                                                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 ml-1">{review.rating}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 italic font-medium leading-relaxed">
                                                    "{review.comment}"
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                            <p className="text-xs text-gray-400 dark:text-gray-600 font-medium italic">No reviews yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center py-10">User not found</div>
                    )}
                </div>
            </div>
        </div>
    );
};
