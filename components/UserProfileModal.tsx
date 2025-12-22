import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB'; // For translations
import { User, Review } from '../types';
import { getUserProfile } from '../services/authService';
import { REVIEW_TAGS_TRANSLATIONS } from '../constants';
import { X, MapPin, Star, Award, Briefcase, CheckCircle2, UserCircle, Phone, Loader2 } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-emerald-600 dark:bg-emerald-700 p-4 flex justify-between items-start text-white relative">
                    <button onClick={onClose} className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                    <div className="absolute top-12 left-0 right-0 flex justify-center">
                        <div className="w-24 h-24 bg-white dark:bg-gray-800 p-1.5 rounded-full shadow-lg overflow-hidden">
                            {user?.profilePhoto ? (
                                <img src={user.profilePhoto} className="w-full h-full object-cover rounded-full bg-gray-200" alt={user.name} />
                            ) : (
                                <div className="w-full h-full bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                                    {(user?.name || userName || '?').charAt(0)}
                                </div>
                            )}
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
                        <div className="flex flex-col items-center space-y-6">

                            {/* Name & Location */}
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                                    {user.name}
                                    {user.isPremium && <span className="text-amber-500 text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1"><Award size={10} fill="currentColor" /> Premium</span>}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-1 mt-1">
                                    <MapPin size={14} /> {user.location || 'Unknown Location'}
                                </p>
                                {phoneNumber && (
                                    <a href={`tel:${phoneNumber}`} className="inline-flex items-center gap-2 mt-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                                        <Phone size={16} /> {phoneNumber}
                                    </a>
                                )}
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-3 w-full">
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                                    <div className="text-emerald-600 dark:text-emerald-500 mb-1 flex justify-center"><Star size={18} fill="currentColor" /></div>
                                    <div className="font-bold text-gray-900 dark:text-white">{user.rating.toFixed(1)}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">{t.rating}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                                    <div className="text-blue-600 dark:text-blue-500 mb-1 flex justify-center"><CheckCircle2 size={18} /></div>
                                    <div className="font-bold text-gray-900 dark:text-white">{user.jobsCompleted || 0}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">{t.jobsDone}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                                    <div className="text-purple-600 dark:text-purple-500 mb-1 flex justify-center"><Briefcase size={18} /></div>
                                    <div className="font-bold text-gray-900 dark:text-white">{user.experience || 'N/A'}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">{t.experience}</div>
                                </div>
                            </div>

                            {/* Bio */}
                            <div className="w-full">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{t.aboutMe}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                    {user.bio || "No bio available."}
                                </p>
                            </div>

                            {/* Skills */}
                            {user.skills && user.skills.length > 0 && (
                                <div className="w-full">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{t.skills}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {user.skills.map((s, i) => (
                                            <span key={i} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-100 dark:border-emerald-800">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="text-center py-10">User not found</div>
                    )}
                </div>
            </div>
        </div>
    );
};
