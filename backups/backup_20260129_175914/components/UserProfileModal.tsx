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
    const [activeTab, setActiveTab] = useState<'ABOUT' | 'REVIEWS'>('ABOUT');

    // Swipe Gesture State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 75;

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
            setUser(null);
            setActiveTab('ABOUT'); // Reset Tab
        }
    }, [isOpen, userId]);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance < -minSwipeDistance) onClose(); // Right Swipe to Close
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none md:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg pointer-events-auto transition-opacity" onClick={onClose} />
            <div
                className="w-full h-full md:w-[900px] md:h-[85vh] bg-white dark:bg-gray-950 md:rounded-[2.5rem] p-0 pointer-events-auto animate-in slide-in-from-right duration-300 relative overflow-hidden flex flex-col md:flex-row transition-all shadow-2xl pt-safe pb-safe md:pt-0 md:pb-0 border-0 md:border border-white/10 dark:border-gray-800/50"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Navigation: Back Button (Top Left) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-50 p-2.5 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all active:scale-90 border border-white/20 shadow-sm mt-safe md:mt-0"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>

                {/* Premium Badge (Top Right) */}
                {user?.isPremium && (
                    <div className="absolute top-6 right-6 bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg border border-amber-300/50 z-20">
                        <Crown size={12} fill="currentColor" /> Premium
                    </div>
                )}

                {/* === LEFT PANEL (Desktop Sidebar / Mobile Header) === */}
                <div className="md:w-[320px] md:h-full md:border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 relative">
                    {/* Hero Header - Compact Version */}
                    <div className="h-32 relative shrink-0 bg-gray-900 group/header">
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/40 to-black/60 z-10" />
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop')] bg-cover bg-center opacity-20" />

                        {/* Avatar Overlap - Adjusted */}
                        <div className="absolute -bottom-10 left-6 z-20">
                            <div className="w-20 h-20 rounded-[1.5rem] bg-white dark:bg-gray-950 p-1 shadow-xl">
                                <div className="w-full h-full rounded-[1.25rem] overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    {user?.profilePhoto ? (
                                        <img src={user.profilePhoto} className="w-full h-full object-cover" alt={user.name} />
                                    ) : (
                                        <span className="text-2xl font-black text-gray-300">{(user?.name || userName || '?').charAt(0)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Sidebar Content (Name & Contact) */}
                    <div className="hidden md:flex flex-col p-6 pt-12 flex-1">
                        {loading ? (
                            <Loader2 className="animate-spin text-emerald-500" />
                        ) : user ? (
                            <>
                                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{user.name}</h1>

                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 mb-6">
                                    <MapPin size={12} className="text-emerald-500" />
                                    {user.location || 'Location hidden'}
                                </div>

                                <div className="space-y-3 mt-auto mb-6">
                                    <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500">Member Since</span>
                                        <span className="text-xs font-black text-gray-900 dark:text-white">{new Date(user.joinDate || Date.now()).getFullYear()}</span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500">Jobs Completed</span>
                                        <span className="text-xs font-black text-gray-900 dark:text-white">{user.jobsCompleted || 0}</span>
                                    </div>
                                </div>

                                {phoneNumber && (
                                    <a href={`tel:${phoneNumber}`} className="flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                        <Phone size={18} strokeWidth={3} /> {t.callNow || "Call Now"}
                                    </a>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>

                {/* === RIGHT PANEL (Scrollable Content) === */}
                <div className="flex-1 overflow-y-auto px-6 pb-24 md:pb-8 pt-12 md:pt-8 bg-white dark:bg-gray-950">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 size={32} className="animate-spin text-emerald-600" />
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Fetching Profile...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 text-red-500 font-bold">{error}</div>
                    ) : user ? (
                        <div className="flex flex-col">
                            {/* Mobile-Only Header Info (Name etc.) */}
                            <div className="md:hidden mb-6">
                                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{user.name}</h1>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                                    <MapPin size={12} className="text-emerald-500" />
                                    {user.location || 'Location hidden'}
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span>Member since {new Date(user.joinDate || Date.now()).getFullYear()}</span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex flex-wrap gap-3 mb-8">
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-center flex-1 min-w-[100px]">
                                    <div className="text-xl font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                                        {user.rating.toFixed(1)} <Star size={14} className="fill-amber-400 text-amber-400" />
                                    </div>
                                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{t.rating}</div>
                                </div>

                                {user.jobsCompleted > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-center flex-1 min-w-[100px]">
                                        <div className="text-xl font-black text-gray-900 dark:text-white">
                                            {user.jobsCompleted}
                                        </div>
                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{t.jobsDone}</div>
                                    </div>
                                )}

                                {user.experience && Number(user.experience) > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-center flex-1 min-w-[100px]">
                                        <div className="text-xl font-black text-gray-900 dark:text-white">
                                            {user.experience} <span className="text-xs text-gray-400">Yr</span>
                                        </div>
                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{t.experience}</div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Tabs */}
                            <div className="sticky top-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl z-30 flex mb-6 border-b border-gray-100 dark:border-gray-800 -mx-6 px-6 pt-2">
                                <button
                                    onClick={() => setActiveTab('ABOUT')}
                                    className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ABOUT' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {t.aboutMe}
                                </button>
                                <button
                                    onClick={() => setActiveTab('REVIEWS')}
                                    className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'REVIEWS' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {t.reviews} ({user.reviews?.length || 0})
                                </button>
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'ABOUT' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {user.bio || "No bio available."}
                                        </p>
                                    </div>

                                    {user.skills && user.skills.length > 0 && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Skills</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {user.skills.map((s, i) => (
                                                    <span key={i} className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'REVIEWS' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    {user.reviews && user.reviews.length > 0 ? (
                                        user.reviews.map((review, i) => (
                                            <div key={review.id || i} className="bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white">{review.reviewerName}</span>
                                                    <div className="flex gap-0.5">
                                                        {[...Array(5)].map((_, starI) => (
                                                            <Star key={starI} size={10} className={starI < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{review.comment}"</p>
                                                <p className="text-[9px] font-bold text-gray-300 uppercase mt-2">{new Date(review.date).toLocaleDateString()}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 text-gray-400 text-xs italic">No reviews yet.</div>
                                    )}
                                </div>
                            )}

                        </div>
                    ) : null}
                </div>

                {/* Sticky Action Footer */}
                {user && phoneNumber && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 z-40 pb-safe md:hidden">
                        <a href={`tel:${phoneNumber}`} className="flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-[1.25rem] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                            <Phone size={18} strokeWidth={3} /> {t.callNow || "Call Now"}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};
