import { supabase } from '../lib/supabase';
import { Job, Bid, JobStatus } from '../types';

// Helper to convert database job to app Job type
const dbJobToApp = (dbJob: any, bids: Bid[] = []): Job => {
  return {
    id: dbJob.id,
    posterId: dbJob.poster_id,
    posterName: dbJob.poster_name,
    posterPhone: dbJob.poster_phone,
    posterPhoto: dbJob.poster_photo || undefined,
    title: dbJob.title,
    description: dbJob.description,
    category: dbJob.category,
    location: dbJob.location,
    coordinates: dbJob.latitude && dbJob.longitude
      ? { lat: Number(dbJob.latitude), lng: Number(dbJob.longitude) }
      : undefined,
    jobDate: dbJob.job_date,
    duration: dbJob.duration,
    budget: dbJob.budget,
    status: dbJob.status as JobStatus,
    acceptedBidId: dbJob.accepted_bid_id || undefined,
    image: dbJob.image || undefined,
    createdAt: new Date(dbJob.created_at).getTime(),
    bids
  };
};

// Helper to convert database bid to app Bid type
const dbBidToApp = (dbBid: any): Bid => {
  return {
    id: dbBid.id,
    jobId: dbBid.job_id,
    workerId: dbBid.worker_id,
    workerName: dbBid.worker_name,
    workerPhone: dbBid.worker_phone,
    workerRating: Number(dbBid.worker_rating),
    workerLocation: dbBid.worker_location,
    workerCoordinates: dbBid.worker_latitude && dbBid.worker_longitude
      ? { lat: Number(dbBid.worker_latitude), lng: Number(dbBid.worker_longitude) }
      : undefined,
    workerPhoto: dbBid.worker_photo || undefined,
    amount: dbBid.amount,
    message: dbBid.message,
    status: dbBid.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
    negotiationHistory: dbBid.negotiation_history || [],
    createdAt: new Date(dbBid.created_at).getTime(),
    posterId: dbBid.poster_id
  };
};

// Check and expire bids that missed the 24-hour payment deadline
export const checkExpiredBidDeadlines = async (): Promise<{ expiredCount: number; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('check_expired_bid_deadlines');

    if (error) {
      console.warn('[JobService] Error checking expired bids:', error);
      return { expiredCount: 0, error: error.message };
    }

    if (data > 0) {
      console.log(`[JobService] Expired ${data} bids that missed 24hr deadline`);
    }

    return { expiredCount: data || 0 };
  } catch (err: any) {
    console.error('[JobService] Failed to check expired bids:', err);
    return { expiredCount: 0, error: err.message };
  }
};

/**
 * [SECURITY] Securely fetches contact details for a job
 * Only works if you are the Poster or the Accepted Worker
 */
export const fetchJobContact = async (jobId: string) => {
  const { data, error } = await supabase.rpc('get_job_contact', { p_job_id: jobId });
  if (error) throw error;
  return data;
};

// Fetch jobs with pagination (optimized for scale)
export const fetchJobs = async (limit: number = 100, offset: number = 0): Promise<{ jobs: Job[]; error?: string; hasMore?: boolean }> => {
  try {
    console.log(`[JobService] Fetching jobs (limit: ${limit}, offset: ${offset})...`);

    // Step 1: Fetch paginated jobs first
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobsError) {
      console.error('[JobService] Error fetching jobs:', jobsError);
      throw jobsError;
    }

    const jobIds = jobsData?.map(j => j.id) || [];

    // Step 2: Only fetch bids for the jobs we just loaded (major optimization!)
    let bidsData: any[] = [];
    if (jobIds.length > 0) {
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (bidsError) {
        console.error('[JobService] Error fetching bids:', bidsError);
        // Continue without bids rather than failing completely
      } else {
        bidsData = bids || [];
      }
    }

    console.log(`[JobService] Fetched ${jobsData?.length || 0} jobs and ${bidsData?.length || 0} bids.`);

    // Group bids by job_id
    const bidsByJob = new Map<string, Bid[]>();
    bidsData?.forEach(dbBid => {
      try {
        const bid = dbBidToApp(dbBid);
        if (!bidsByJob.has(bid.jobId)) {
          bidsByJob.set(bid.jobId, []);
        }
        bidsByJob.get(bid.jobId)!.push(bid);
      } catch (e) {
        console.warn('Skipping invalid bid:', dbBid.id, e);
      }
    });

    // Combine jobs with their bids
    const jobs = jobsData?.map(dbJob => {
      try {
        return dbJobToApp(dbJob, bidsByJob.get(dbJob.id) || []);
      } catch (e) {
        console.error('Error mapping job:', dbJob.id, e);
        return null; // Filter out bad jobs rather than breaking completely
      }
    }).filter(j => j !== null) as Job[];

    // Check if there are more jobs (for infinite scroll)
    const hasMore = jobsData && jobsData.length === limit;

    return { jobs, hasMore };
  } catch (error) {
    console.error('[JobService] Critical error fetching jobs:', error);
    return { jobs: [], error: 'Failed to fetch jobs', hasMore: false };
  }
};

// Create a new job
export const createJob = async (job: Job): Promise<{ success: boolean; error?: string; data?: { id: string } }> => {
  try {
    console.log('[JobService] Creating job:', job.title);
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        // Let database generate UUID, don't send id
        poster_id: job.posterId,
        poster_name: job.posterName,
        poster_phone: job.posterPhone,
        poster_photo: job.posterPhoto,
        title: job.title,
        description: job.description,
        category: job.category,
        location: job.location,
        latitude: job.coordinates?.lat,
        longitude: job.coordinates?.lng,
        job_date: job.jobDate,
        duration: job.duration,
        budget: job.budget,
        status: job.status,
        image: job.image
      })
      .select()
      .single();

    if (error) {
      console.error('[JobService] Supabase error:', error);
      throw error;
    }

    console.log('[JobService] Job created successfully with ID:', data.id);
    return { success: true, data: { id: data.id } };
  } catch (error: any) {
    console.error('[JobService] Error creating job:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to create job';
    return { success: false, error: errorMessage };
  }
};

// Update a job
export const updateJob = async (job: Job): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('jobs')
      .update({
        poster_name: job.posterName,
        poster_phone: job.posterPhone,
        poster_photo: job.posterPhoto,
        title: job.title,
        description: job.description,
        category: job.category,
        location: job.location,
        latitude: job.coordinates?.lat,
        longitude: job.coordinates?.lng,
        job_date: job.jobDate,
        duration: job.duration,
        budget: job.budget,
        status: job.status,
        accepted_bid_id: job.acceptedBidId,
        image: job.image
      })
      .eq('id', job.id);

    if (error) throw error;

    // Update bids if they exist in the job
    if (job.bids && job.bids.length > 0) {
      for (const bid of job.bids) {
        await updateBid(bid);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating job:', error);
    return { success: false, error: 'Failed to update job' };
  }
};

// Delete a job
export const deleteJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting job:', error);
    return { success: false, error: 'Failed to delete job' };
  }
};

// Create a bid
export const createBid = async (bid: Bid): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('bids')
      .insert({
        // Let DB generate UUID for id
        job_id: bid.jobId,
        // REMOVED poster_id - this column doesn't exist in bids table!
        worker_id: bid.workerId,
        worker_name: bid.workerName,
        worker_phone: bid.workerPhone,
        worker_rating: bid.workerRating,
        worker_location: bid.workerLocation,
        worker_latitude: bid.workerCoordinates?.lat,
        worker_longitude: bid.workerCoordinates?.lng,
        worker_photo: bid.workerPhoto,
        amount: bid.amount,
        message: bid.message,
        status: bid.status,
        negotiation_history: bid.negotiationHistory
      });

    if (error) {
      console.error('[JobService] Error creating bid:', error);
      throw error;
    }

    console.log('[JobService] Bid created successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[JobService] Error creating bid:', error);
    return { success: false, error: error.message || 'Failed to create bid' };
  }
};

// Update a bid
export const updateBid = async (bid: Bid): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('bids')
      .update({
        amount: bid.amount,
        message: bid.message,
        status: bid.status,
        negotiation_history: bid.negotiationHistory
      })
      .eq('id', bid.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating bid:', error);
    return { success: false, error: 'Failed to update bid' };
  }
};
// Cancel a job with refund (Poster only)
export const cancelJob = async (jobId: string, reason: string): Promise<{ success: boolean; error?: string; refundAmount?: number; penalty?: boolean }> => {
  try {
    const { data, error } = await supabase.rpc('cancel_job_with_refund', {
      p_job_id: jobId,
      p_reason: reason
    });

    if (error) throw error;

    return {
      success: true,
      refundAmount: data?.refund_amount || 0,
      penalty: data?.penalty || false
    };
  } catch (error: any) {
    console.error('Error cancelling job:', error);
    return { success: false, error: error.message || 'Failed to cancel job' };
  }
};

// Worker withdraws from a job (no refund after payment)
export const withdrawFromJob = async (jobId: string, bidId: string): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    const { data, error } = await supabase.rpc('withdraw_from_job', {
      p_job_id: jobId,
      p_bid_id: bidId
    });

    if (error) throw error;

    return {
      success: true,
      message: data?.message || 'Withdrawn successfully'
    };
  } catch (error: any) {
    console.error('Error withdrawing from job:', error);
    return { success: false, error: error.message || 'Failed to withdraw' };
  }
};

export const chargeWorkerCommission = async (workerId: string, jobId: string, bidAmount: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const { WORKER_COMMISSION_RATE } = await import('../constants');
    const commission = Math.ceil(bidAmount * WORKER_COMMISSION_RATE);

    // Use Secure RPC
    const { data, error } = await supabase.rpc('charge_commission', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_amount: commission
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error charging commission:', error);
    return { success: false, error: error.message };
  }
};
