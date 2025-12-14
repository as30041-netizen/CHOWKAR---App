import React, { useState } from 'react';
import { useJobs } from '../contexts/JobContextDB';
import { useUser } from '../contexts/UserContextDB';
import { Pencil, Crown, CheckCircle2, MapPin, Star, Award, Briefcase, LogOut } from 'lucide-react';
import { REVIEW_TAGS_TRANSLATIONS } from '../constants';

interface ProfileProps {
    onEditProfile: () => void;
    setShowSubscriptionModal: (show: boolean) => void;
    onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onEditProfile, setShowSubscriptionModal, onLogout }) => {
    const { user, t, language, jobsCompleted } = useUser();

    // Note: jobContext might be needed if we want accurate "jobs posted" count. 
    // For now using user.jobsCompleted as a proxy or if we have access to jobs context we can filter.
    // Ideally, we should fetch this or pass it in. 
    // App.tsx had: const postedJobsCount = jobs.filter(j => j.posterId === user.id).length;
    // Let's assume we can get it from context or props. For now, I'll use a placeholder or context if available.

    // We need to access jobs to count posted jobs correctly if not in user object.
    // Since we are decoupling, let's use what's available or pass as prop.
    // Let's pass it as prop? No, let's use the context here if we can.
    // Actually, let's just use useJobs() here too.

    const { jobs } = useJobs();
    const postedJobsCount = jobs.filter((j: any) => j.posterId === user.id).length;

    return (
        <div className="pb-24 animate-fade-in">
            <div className="bg-white rounded-b-3xl shadow-sm border-b border-gray-100 overflow-hidden mb-4">
                <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-500 relative">
                    <button onClick={onEditProfile} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white">
                        <Pencil size={18} />
                    </button>
                    {user.isPremium && (
                        <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                            <Crown size={14} fill="currentColor" /> Premium
                        </div>
                    )}
                </div>
                <div className="px-5 pb-6 -mt-12 flex flex-col items-center">
                    <div className="w-24 h-24 bg-white p-1.5 rounded-full shadow-lg mb-3 relative overflow-hidden animate-pop">
                        {user.profilePhoto ? (
                            <img src={user.profilePhoto} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <div className="w-full h-full bg-emerald-100 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700">
                                {user.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        {user.name} <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" />
                    </h2>
                    <p className="text-gray-500 font-medium text-sm flex items-center gap-1">
                        <MapPin size={14} /> {user.location}
                    </p>
                </div>
            </div>
            <div className="px-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <div className="text-emerald-600 mb-1 flex justify-center"><Star size={20} fill="currentColor" /></div>
                        <div className="font-bold text-gray-900 text-lg">{user.rating}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{t.rating}</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <div className="text-purple-600 mb-1 flex justify-center"><Award size={20} /></div>
                        <div className="font-bold text-gray-900 text-lg">{user.experience || 'N/A'}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{t.experience}</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <div className="text-blue-600 mb-1 flex justify-center"><CheckCircle2 size={20} /></div>
                        <div className="font-bold text-gray-900 text-lg">{user.jobsCompleted || 0}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{t.jobsDone}</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <div className="text-orange-600 mb-1 flex justify-center"><Briefcase size={20} /></div>
                        <div className="font-bold text-gray-900 text-lg">{postedJobsCount}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{t.jobsPosted}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">{t.aboutMe}</h3>
                    <p className="text-gray-600 text-sm">{user.bio || "No bio added yet."}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">{t.skills}</h3>
                    <div className="flex flex-wrap gap-2">
                        {user.skills?.map((s, i) => (
                            <span key={i} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-100">{s}</span>
                        ))}
                        {(!user.skills || user.skills.length === 0) && <span className="text-gray-400 text-sm italic">No skills added.</span>}
                    </div>
                </div>

                {/* Reviews Section */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-gray-900">{t.reviews || "Reviews"} ({user.reviews?.length || 0})</h3>
                    {user.reviews && user.reviews.length > 0 ? (
                        user.reviews.map(review => (
                            <div key={review.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-sm text-gray-800">{review.reviewerName}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(review.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} size={12} fill={star <= review.rating ? "orange" : "transparent"} className={star <= review.rating ? "text-orange-400" : "text-gray-300"} />
                                    ))}
                                </div>
                                {review.tags && review.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {review.tags.map((tag, i) => (
                                            <span key={i} className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded border border-gray-200">
                                                {REVIEW_TAGS_TRANSLATIONS[tag]?.[language === 'hi' ? 'hi' : 'en'] || tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-600 italic">"{review.comment}"</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-400 italic">No reviews yet.</p>
                    )}
                </div>

                {!user.isPremium && (
                    <button onClick={() => setShowSubscriptionModal(true)} className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform">
                        <Crown size={18} fill="currentColor" /> {t.upgradePremium}
                    </button>
                )}
                <button onClick={onLogout} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-100">
                    <LogOut size={18} /> {t.signOut}
                </button>
            </div>
        </div>
    );
};
