
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { useNotification } from '../contexts/NotificationContext';
import { Job, JobStatus, UserRole } from '../types';
import { cancelJob as cancelJobService } from '../services/jobService';

export const useJobActions = () => {
    const { user, t, showAlert } = useUser();
    const { addNotification } = useNotification();
    const { jobs, updateJob, updateBid, refreshJobs, getJobWithFullDetails } = useJobs();
    const navigate = useNavigate();

    const completeJob = async (job: Job, onReviewNeeded?: (data: any) => void) => {
        try {
            console.log('[JobActions] Marking job as completed:', job.id);
            const updatedJob = { ...job, status: JobStatus.COMPLETED };

            // Update DB and wait for response
            await updateJob(updatedJob);

            // Prompt for review if there's an accepted worker
            const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);
            if (acceptedBid && onReviewNeeded) {
                onReviewNeeded({
                    isOpen: true,
                    revieweeId: acceptedBid.workerId,
                    revieweeName: acceptedBid.workerName,
                    jobId: job.id
                });
            }

            showAlert(t.jobCompletedAlert, 'success');
            return true;
        } catch (err: any) {
            console.error('[JobActions] Error in completeJob:', err);
            showAlert(`${t.jobCompletionError}: ${err.message || 'Unknown error'} `, 'error');
            return false;
        }
    };

    const cancelJob = async (jobId: string) => {
        try {
            const result = await cancelJobService(jobId);

            if (result.success) {
                showAlert(t.jobCancelledRefunded || 'Job cancelled successfully.', 'success');
                // Refresh jobs to update the UI
                await refreshJobs();
                return true;
            } else {
                showAlert(result.error || 'Failed to cancel job', 'error');
                return false;
            }
        } catch (error: any) {
            console.error('[JobActions] Cancel job error:', error);
            showAlert(`${t.cancellationError || 'Error during cancellation'}: ${error.message || 'Unknown error'} `, 'error');
            return false;
        }
    };

    const withdrawBid = async (jobId: string, bidId: string) => {
        if (!confirm(t.withdrawBidPrompt)) return false;
        try {
            const job = jobs.find(j => j.id === jobId);
            if (!job) return false;

            // Persist withdrawal to DB by marking as REJECTED (using RPC for safety)
            const { safeRPC } = await import('../lib/supabase'); // Dynamic import to avoid cycles?
            const { data, error } = await safeRPC('withdraw_from_job', { p_job_id: jobId, p_bid_id: bidId });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || data?.error || 'Failed to withdraw bid');
            }

            // Local update (Optimistic)
            const updatedJob = { ...job, bids: job.bids.filter(b => b.id !== bidId) };
            await updateJob(updatedJob);

            showAlert(t.bidWithdrawn, 'info');
            return true;
        } catch (err) {
            showAlert(t.withdrawBidError, 'error');
            return false;
        }
    };

    const replyToCounter = async (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => {
        let job = jobs.find(j => j.id === jobId);

        // Robust Fetch
        if (!job) {
            try {
                const fetched = await getJobWithFullDetails(jobId, true);
                if (fetched) job = fetched;
            } catch (e) {
                console.error("Failed to fetch job for reply", e);
            }
        }

        if (!job) {
            showAlert(t.jobNotFound || "Job not found", 'error');
            return false;
        }

        try {
            let bid = job.bids.find(b => b.id === bidId);
            // Robust Fetch Bid
            if (!bid) {
                const fetched = await getJobWithFullDetails(jobId, true);
                if (fetched) {
                    job = fetched;
                    bid = fetched.bids.find(b => b.id === bidId);
                }
            }

            if (!bid) {
                showAlert(t.bidNotFound || "Bid not found", 'error');
                return false;
            }

            if (action === 'ACCEPT') {
                const updatedBid = {
                    ...bid,
                    status: 'PENDING' as const,
                    negotiationHistory: [...(bid.negotiationHistory || []), {
                        amount: bid.amount,
                        by: UserRole.WORKER,
                        timestamp: Date.now(),
                        agreed: true
                    }]
                };
                await updateBid(updatedBid);
                showAlert(t.waitingForPosterFinalize || "Offer accepted! Waiting for Employer to finalize.", 'success');

            } else if (action === 'REJECT') {
                if (!confirm(t.declineCounterPrompt)) return false;
                const updatedBid = { ...bid, status: 'REJECTED' as const };
                await updateBid(updatedBid);

                await addNotification(
                    job.posterId,
                    "Offer Declined",
                    `${bid.workerName} declined your offer for "${job.title}".You can try other workers!`,
                    "WARNING",
                    jobId
                );
                showAlert(t.counterDeclined, 'info');

            } else if (action === 'COUNTER' && amount) {
                const updatedBid = { ...bid, amount, negotiationHistory: [...(bid.negotiationHistory || []), { amount, by: UserRole.WORKER, timestamp: Date.now() }] };
                await updateBid(updatedBid);
                // Note: Notifications handled by DB triggers
            }
            return true;
        } catch (err: any) {
            console.error('[JobActions] Reply Error:', err);
            showAlert(`${t.genericError}${err.message || 'Unknown error'} `, 'error');
            return false;
        }
    };

    const editJobLink = (job: Job) => {
        if (job.bids.length > 0) {
            showAlert(t.alertCantEdit, 'error');
            return;
        }
        navigate('/post', { state: { jobToEdit: job } });
    };

    return {
        completeJob,
        cancelJob,
        withdrawBid,
        replyToCounter,
        editJobLink
    };
};
