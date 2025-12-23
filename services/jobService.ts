import { supabase } from '../lib/supabase';
import { Job, Bid, JobStatus, Review } from '../types';

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

// ============================================================================
// OPTIMIZED DATA FETCHING (NEW - Uses RPCs for better performance)
// ============================================================================

/**
 * [OPTIMIZED] Fetch home feed with pre-computed bid counts
 * This is the PRIMARY method for loading jobs - much lighter than fetchJobs
 */
export const fetchHomeFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0,
  excludeCompleted: boolean = false
): Promise<{ jobs: Job[]; error?: string; hasMore?: boolean }> => {
  try {
    console.log(`[JobService] Fetching optimized home feed (limit: ${limit}, offset: ${offset})...`);

    const { data, error } = await supabase.rpc('get_home_feed', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
      p_exclude_completed: excludeCompleted
    });

    if (error) {
      console.error('[JobService] get_home_feed RPC error:', error);
      throw error;
    }

    const jobs: Job[] = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name,
      posterPhone: '', // Not included in feed for privacy - loaded on demand
      posterPhoto: row.poster_photo || undefined,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: Number(row.budget),
      status: row.status as JobStatus,
      createdAt: new Date(row.created_at).getTime(),
      acceptedBidId: row.accepted_bid_id || undefined,
      image: row.image || undefined,
      // FEED OPTIMIZATION: Pre-computed values (no need to load all bids!)
      bids: [], // Empty - will be lazy loaded when needed
      bidCount: Number(row.bid_count),
      myBidId: row.my_bid_id || undefined,
      myBidStatus: row.my_bid_status || undefined,
      myBidAmount: row.my_bid_amount ? Number(row.my_bid_amount) : undefined
    }));

    console.log(`[JobService] Fetched ${jobs.length} jobs via optimized feed`);
    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchHomeFeed error:', error);
    // FALLBACK: If RPC fails (e.g., not deployed yet), use legacy method
    console.warn('[JobService] Falling back to legacy fetchJobs...');
    return fetchJobs(limit, offset);
  }
};

/**
 * [OPTIMIZED] Fetch feed of jobs posted by the current user
 */
export const fetchMyJobsFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  try {
    const { data, error } = await supabase.rpc('get_my_jobs_feed', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;

    const jobs: Job[] = (data || []).map((row: any) => ({
      ...row,
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: Number(row.budget),
      status: row.status as JobStatus,
      createdAt: new Date(row.created_at).getTime(),
      acceptedBidId: row.accepted_bid_id || undefined,
      image: row.image || undefined,
      bids: [],
      bidCount: Number(row.bid_count),
      myBidId: undefined, // Posters don't have their own bids on their jobs
    }));

    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchMyJobsFeed error:', error);
    // Legacy mapping fallback
    const { jobs: allJobs } = await fetchJobs(100, 0);
    const filtered = allJobs.filter(j => j.posterId === userId).slice(offset, offset + limit);
    return { jobs: filtered, hasMore: filtered.length === limit };
  }
};

/**
 * [OPTIMIZED] Fetch feed of jobs the current user has applied for
 */
export const fetchMyApplicationsFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  try {
    const { data, error } = await supabase.rpc('get_my_applications_feed', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;

    const jobs: Job[] = (data || []).map((row: any) => ({
      ...row,
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: Number(row.budget),
      status: row.status as JobStatus,
      createdAt: new Date(row.created_at).getTime(),
      acceptedBidId: row.accepted_bid_id || undefined,
      image: row.image || undefined,
      bids: [],
      bidCount: Number(row.bid_count),
      myBidId: row.my_bid_id || undefined,
      myBidStatus: row.my_bid_status || undefined,
      myBidAmount: row.my_bid_amount ? Number(row.my_bid_amount) : undefined
    }));

    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchMyApplicationsFeed error:', error);
    // Legacy fallback
    const { jobs: allJobs } = await fetchJobs(100, 0);
    const filtered = allJobs.filter(j => j.bids.some(b => b.workerId === userId)).slice(offset, offset + limit);
    return { jobs: filtered, hasMore: filtered.length === limit };
  }
};

/**
 * [OPTIMIZED] Fetch full job details including all bids
 * Called when user clicks on a job to view details/bids
 */
export const fetchJobFullDetails = async (jobId: string): Promise<{ job: Job | null; error?: string }> => {
  try {
    console.log(`[JobService] Fetching full details for job: ${jobId}`);

    const { data, error } = await supabase.rpc('get_job_full_details', { p_job_id: jobId });

    if (error) {
      console.error('[JobService] get_job_full_details RPC error:', error);
      throw error;
    }

    if (!data?.job) {
      return { job: null, error: 'Job not found' };
    }

    // Map database format to app format
    const bids: Bid[] = (data.bids || []).map((dbBid: any) => dbBidToApp(dbBid));
    const job: Job = {
      ...dbJobToApp(data.job, bids),
      reviews: data.reviews || [],
      bidCount: bids.length,
      myBidId: undefined, // Would need userId to compute
      myBidStatus: undefined,
      myBidAmount: undefined
    };

    console.log(`[JobService] Loaded full details: ${job.title} with ${bids.length} bids and ${job.reviews?.length || 0} reviews`);
    return { job };
  } catch (error: any) {
    console.error('[JobService] fetchJobFullDetails error:', error);
    // FALLBACK: Direct query if RPC not available
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      const { data: bidsData } = await supabase
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, profiles!reviewer_id(name)')
        .eq('job_id', jobId);

      const bids = (bidsData || []).map(dbBidToApp);
      const reviews: Review[] = (reviewsData || []).map((r: any) => ({
        id: r.id,
        reviewerId: r.reviewer_id,
        reviewerName: r.profiles?.name || 'Unknown',
        revieweeId: r.reviewee_id,
        rating: r.rating,
        comment: r.comment,
        date: new Date(r.created_at).getTime()
      }));

      return { job: { ...dbJobToApp(jobData, bids), reviews } };
    } catch (fallbackError: any) {
      return { job: null, error: fallbackError.message };
    }
  }
};

// ============================================================================
// LEGACY FETCH (Kept for backward compatibility)
// ============================================================================

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
export const createBid = async (bid: Bid): Promise<{ success: boolean; error?: string; data?: { id: string } }> => {
  try {
    const { data, error } = await supabase
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
      })
      .select('id')
      .single();

    if (error) {
      console.error('[JobService] Error creating bid:', error);

      // Handle RLS violation (which presents as "new row violates row-level security policy")
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        return { success: false, error: 'Job is is closed or no longer accepting bids.' };
      }

      throw error;
    }

    console.log('[JobService] Bid created successfully');
    return { success: true, data: { id: data.id } };
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
