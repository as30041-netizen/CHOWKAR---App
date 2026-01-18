import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobs } from '../contexts/JobContextDB';
import { useUser } from '../contexts/UserContextDB';
import { JobCard } from '../components/JobCard';
import { JobCardSkeleton } from '../components/Skeleton';
import { CATEGORY_CONFIG } from '../constants';
import { ArrowLeft, MapPin } from 'lucide-react';
import { calculateDistance } from '../utils/geo';

export const CategoryJobs: React.FC = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const { user, language, role } = useUser();
    const { jobs, loading, refreshJobs } = useJobs();

    // scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const categoryConfig = CATEGORY_CONFIG.find(c => c.id === categoryId);
    const categoryLabel = categoryConfig ? (categoryConfig.label[language] || categoryConfig.label.en) : categoryId;

    const filteredJobs = useMemo(() => {
        if (!jobs) return [];
        return jobs
            .filter(j => j.category === categoryId && j.status === 'OPEN')
            .map(j => ({
                ...j,
                distance: (user.coordinates && j.coordinates)
                    ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng)
                    : undefined
            }))
            .sort((a, b) => {
                // Default to nearest for category feed
                if (a.distance !== undefined && b.distance !== undefined) {
                    return a.distance - b.distance;
                }
                return b.createdAt - a.createdAt;
            });
    }, [jobs, categoryId, user.coordinates]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 pt-safe">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                        {categoryLabel}
                    </h1>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {filteredJobs.length} {language === 'en' ? 'Jobs Available' : 'काम उपलब्ध'}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-4">
                {/* Location Status */}
                {!user.coordinates && (
                    <div className="mb-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                                {language === 'en' ? 'Enable location to see nearby jobs first.' : 'आस-पास के काम देखने के लिए लोकेशन चालू करें'}
                            </p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map(i => <JobCardSkeleton key={i} />)}
                    </div>
                ) : filteredJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredJobs.map(job => (
                            <JobCard
                                key={job.id}
                                job={job}
                                currentUserId={user.id}
                                userRole={role} // Pass role safely
                                distance={job.distance}
                                language={language}
                                onBid={() => navigate('/')} // Redirect to home for mechanics simplicity or implement modal here
                                onViewBids={() => { }}
                                onChat={() => { }}
                                onEdit={() => { }}
                                onClick={() => { }}
                                onReplyToCounter={() => { }}
                                onWithdrawBid={() => { }}
                                onHide={() => { }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <categoryConfig.icon size={32} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                            {language === 'en' ? 'No jobs yet' : 'अभी कोई काम नहीं है'}
                        </h3>
                        <p className="text-gray-500 text-sm max-w-[200px]">
                            {language === 'en' ? 'Check back later or try another category.' : 'बाद में देखें या दूसरी श्रेणी आज़माएं'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
