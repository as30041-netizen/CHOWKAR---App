import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, AlertCircle, Home } from 'lucide-react';
import { useJobs } from '../contexts/JobContextDB';
import { useUser } from '../contexts/UserContextDB';
import { Job } from '../types';

// Lazy load the heavy modal component for reuse
const JobDetailsModal = React.lazy(() => import('../components/JobDetailsModal').then(m => ({ default: m.JobDetailsModal })));

export const JobPage: React.FC = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const { getJobWithFullDetails, jobs } = useJobs();
    const { user, role, t, language, isAuthLoading } = useUser();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<Job | null>(null);

    // Fetch job on mount
    useEffect(() => {
        if (!jobId) {
            setError('Invalid job ID');
            setIsLoading(false);
            return;
        }

        const loadJob = async () => {
            setIsLoading(true);
            setError(null);
            try {
                await getJobWithFullDetails(jobId, true);
            } catch (err) {
                console.error('[JobPage] Error fetching job:', err);
                setError('Job not found or an error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        loadJob();
    }, [jobId, getJobWithFullDetails]);

    // Sync job from context when jobs array updates
    useEffect(() => {
        if (jobId) {
            const foundJob = jobs.find(j => j.id === jobId);
            if (foundJob) {
                setJob(foundJob);
                setError(null);
            } else if (!isLoading && !error) {
                // Job not in context after load, show error
                setError('Job not found');
            }
        }
    }, [jobId, jobs, isLoading, error]);

    // SEO data
    const seoTitle = job ? `${job.title} | Chowkar` : 'Job Not Found | Chowkar';
    const seoDescription = job?.description?.substring(0, 155) || 'Find local jobs on Chowkar - India\'s #1 Marketplace for daily wage work.';

    // Handler implementations - navigate with state for App.tsx to handle modals
    const handleClose = () => navigate(-1); // Go back in history

    const handleBid = (targetJobId: string) => {
        // Navigate to home and let App.tsx open BidModal
        navigate('/', { state: { openBid: targetJobId } });
    };

    const handleViewBids = (targetJob: Job) => {
        navigate('/', { state: { openViewBids: targetJob.id } });
    };

    const handleChat = (targetJob: Job) => {
        navigate('/', { state: { openChat: targetJob.id } });
    };

    const handleEdit = (targetJob: Job) => {
        navigate('/post', { state: { editJob: targetJob } });
    };

    const handleDelete = (targetJobId: string) => {
        // For delete, show confirmation and navigate back
        if (confirm(language === 'en' ? 'Are you sure you want to delete this job?' : 'क्या आप वाकई इस काम को हटाना चाहते हैं?')) {
            console.log('[JobPage] Delete confirmed for:', targetJobId);
            // TODO: Call delete API then navigate
            navigate('/');
        }
    };

    const handleViewProfile = (userId: string, name?: string, phoneNumber?: string) => {
        navigate('/', { state: { openProfile: userId, profileName: name, profilePhone: phoneNumber } });
    };

    const showAlert = (message: string, type: 'success' | 'error' | 'info') => {
        // For now, use browser alert - App-level alerts aren't accessible here
        alert(message);
    };

    // Loading State
    if (isLoading || isAuthLoading) {
        return (
            <>
                <Helmet>
                    <title>Loading... | Chowkar</title>
                </Helmet>
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
                    <Loader2 size={40} className="text-primary animate-spin mb-4" />
                    <p className="text-text-secondary font-medium">
                        {language === 'en' ? 'Loading job details...' : 'काम का विवरण लोड हो रहा है...'}
                    </p>
                </div>
            </>
        );
    }

    // Error / Not Found State
    if (error || !job) {
        return (
            <>
                <Helmet>
                    <title>Job Not Found | Chowkar</title>
                    <meta name="robots" content="noindex" />
                </Helmet>
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle size={40} className="text-red-500" />
                    </div>
                    <h1 className="text-2xl font-black text-text-primary mb-2">
                        {language === 'en' ? 'Job Not Found' : 'काम नहीं मिला'}
                    </h1>
                    <p className="text-text-secondary mb-8 max-w-md">
                        {language === 'en'
                            ? 'This job may have been removed, expired, or the link is incorrect.'
                            : 'यह काम हटाया जा सकता है, समाप्त हो सकता है, या लिंक गलत है।'}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                    >
                        <Home size={18} />
                        {language === 'en' ? 'Go to Home' : 'होम पर जाएं'}
                    </button>
                </div>
            </>
        );
    }

    // Success: Render Job Details
    return (
        <>
            <Helmet>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDescription} />
                <meta property="og:title" content={seoTitle} />
                <meta property="og:description" content={seoDescription} />
                <meta property="og:type" content="website" />
                {job.image && <meta property="og:image" content={job.image} />}
            </Helmet>

            {/* Page Header (Mobile) */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-border/50 md:hidden">
                <div className="flex items-center gap-3 px-4 py-3 pt-safe">
                    <button
                        onClick={handleClose}
                        className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-text-primary transition-all active:scale-95"
                    >
                        <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-sm font-black uppercase tracking-widest text-text-primary truncate flex-1">
                        {language === 'en' ? 'Job Details' : 'कार्य का विवरण'}
                    </h1>
                </div>
            </div>

            {/* Reuse JobDetailsModal content but in page context */}
            <React.Suspense fallback={
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="text-primary animate-spin" />
                </div>
            }>
                <div className="pb-safe">
                    <JobDetailsModal
                        job={job}
                        onClose={handleClose}
                        onBid={handleBid}
                        onViewBids={handleViewBids}
                        onChat={handleChat}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onViewProfile={handleViewProfile}
                        showAlert={showAlert}
                    />
                </div>
            </React.Suspense>
        </>
    );
};

export default JobPage;
