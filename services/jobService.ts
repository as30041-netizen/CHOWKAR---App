import { supabase, waitForSupabase } from '../lib/supabase';
import { safeFetch } from './fetchUtils';
import { Job, Bid, JobStatus, Review } from '../types';

interface DbJob {
  id: string;
  poster_id: string;
  poster_name: string;
  poster_phone: string;
  poster_photo?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  latitude?: number;
  longitude?: number;
  job_date: string;
  duration: string;
  budget: number;
  status: string;
  accepted_bid_id?: string;
  image?: string;
  created_at: string;
  bid_count?: number;
  my_bid_id?: string;
  my_bid_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  my_bid_amount?: number;
  my_bid_last_negotiation_by?: any; // Enum/String
  has_agreement?: boolean;
}

interface DbBid {
  id: string;
  job_id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  worker_rating: number;
  worker_location: string;
  worker_latitude?: number;
  worker_longitude?: number;
  worker_photo?: string;
  amount: number;
  message: string;
  status: string;
  negotiation_history: any[];
  created_at: string;
  poster_id?: string;
}

// Helper to convert database job to app Job type
const dbJobToApp = (dbJob: DbJob, bids: Bid[] = []): Job => {
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
    bids,
    bidCount: Number(dbJob.bid_count || bids.length || 0),
    myBidId: dbJob.my_bid_id,
    myBidStatus: dbJob.my_bid_status,
    myBidAmount: dbJob.my_bid_amount,
    myBidLastNegotiationBy: dbJob.my_bid_last_negotiation_by,
    hasAgreement: !!dbJob.has_agreement
  };
};

// Helper to convert database bid to app Bid type
const dbBidToApp = (dbBid: DbBid): Bid => {
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

/**
 * HELPER: Broadcast a change to all connected clients
 * This ensures the UI updates instantly even if postgres replication is slow or blocked
 * NOTE: Disabled to avoid deprecation warnings. postgres_changes subscriptions handle updates.
 */
const broadcastRefresh = async (eventType: 'job_updated' | 'bid_updated' | 'bid_inserted' | 'job_deleted', payload: any) => {
  // Disabled - rely on postgres_changes subscriptions instead
  // This avoids Supabase deprecation warnings for send() method
  console.log(`[JobService] Broadcast ${eventType} skipped (using postgres_changes instead)`);
  return;
};


// ============================================================================
// OPTIMIZED DATA FETCHING (NEW - Uses RPCs for better performance)
// ============================================================================

/**
 * [SIMPLIFIED] Fetch home feed - Direct REST API fetch
 * Excludes jobs the worker has already bid on
 */
export const fetchHomeFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0,
  filters?: {
    category?: string;
    searchQuery?: string;
  }
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  console.log(`[JobService] Fetching HOME FEED for user ${userId} (offset: ${offset}, filters: ${JSON.stringify(filters)})...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use RPC for efficient Server-Side Filtering
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/rpc/get_home_feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset,
          p_category: filters?.category !== 'All' ? filters?.category : null,
          p_search_query: filters?.searchQuery || null
        })
      }
    );

    if (!response.ok) {
      console.error(`[JobService] RPC get_home_feed failed: ${response.status}`);
      console.error(`[JobService] Full error response:`, await response.text());
      throw new Error(`Feed fetch failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[JobService] RPC Data received: ${data?.length || 0} rows`);

    const jobs = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name || 'Unknown',
      posterPhoto: row.poster_photo,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: row.latitude, lng: row.longitude }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: row.budget,
      status: row.status as JobStatus,
      image: row.image,
      createdAt: new Date(row.created_at).getTime(),
      bidCount: row.bid_count || 0,
      bids: [] // Bids are not needed for the card view, saved bandwidth
    } as Job));

    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchHomeFeed error:', error);
    return { jobs: [], hasMore: false };
  }
};

/**
 * [PRODUCTION] Fetch feed of jobs posted by the current user
 * Uses RPC to get computed negotiation status fields
 */
export const fetchMyJobsFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  console.log(`[JobService] Fetching POSTER feed for user ${userId}...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use RPC to get computed fields like last_bid_negotiation_by
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/rpc/get_my_jobs_feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset
        })
      }
    );

    if (!response.ok) {
      console.error(`[JobService] RPC get_my_jobs_feed failed: ${response.status}, falling back to REST...`);
      // Fallback to direct query
      return fetchMyJobsFeedFallback(userId, limit, offset);
    }

    const data = await response.json();

    // Map RPC result to Job objects
    const jobs = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: row.latitude, lng: row.longitude }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: row.budget,
      status: row.status as any,
      createdAt: new Date(row.created_at).getTime(),
      image: row.image,
      bidCount: row.bid_count || 0,
      acceptedBidId: row.accepted_bid_id,
      // Poster-specific fields from RPC
      myBidLastNegotiationBy: row.last_bid_negotiation_by,
      hasAgreement: row.has_agreement || false,
      hasNewCounter: row.has_new_counter || false,
      actionRequiredCount: row.action_required_count || 0,
      bids: [] // Will be populated when user clicks "View Bids"
    } as Job));

    console.log(`[JobService] ✅ POSTER feed complete: ${jobs.length} jobs found`);
    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchMyJobsFeed error:', error);
    return { jobs: [], hasMore: false };
  }
};

// Fallback if RPC fails
const fetchMyJobsFeedFallback = async (
  userId: string,
  limit: number,
  offset: number
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await safeFetch(
    `${supabaseUrl}/rest/v1/jobs?poster_id=eq.${userId}&order=created_at.desc&offset=${offset}&limit=${limit}`
  );

  if (!response.ok) {
    return { jobs: [], hasMore: false };
  }

  const data = await response.json();
  const jobs = Array.isArray(data) ? data.map((j: any) => dbJobToApp(j as DbJob)) : [];
  return { jobs, hasMore: jobs.length === limit };
};

/**
 * [SIMPLIFIED] Fetch feed of jobs the current user has applied for - Direct REST API
 * Now includes filtering for hidden jobs (via user_job_visibility table)
 */
export const fetchMyApplicationsFeed = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  console.log(`[JobService] Fetching my applications feed for user ${userId} (limit: ${limit}, offset: ${offset})...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use Optimized RPC
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/rpc/get_my_applications_feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset
        })
      }
    );

    if (!response.ok) {
      console.error(`[JobService] RPC get_my_applications_feed failed: ${response.status}`);
      throw new Error(`Applications fetch failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[JobService] RPC Data received: ${data?.length || 0} applications`);

    const jobs = (data || []).map((row: any) => dbJobToApp(row));

    console.log(`[JobService] ✅ Applications feed optimized: ${jobs.length} jobs loaded via single RPC`);
    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    console.error('[JobService] fetchMyApplicationsFeed exception:', error?.message || error);
    return { jobs: [], hasMore: false };
  }
};



/**
 * [OPTIMIZED] Fetch full job details including all bids - Direct REST API
 * Called when user clicks on a job to view details/bids
 */
export const fetchJobFullDetails = async (jobId: string): Promise<{ job: Job | null; error?: string }> => {
  try {
    console.log(`[JobService] Fetching full details for job: ${jobId}`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Fetch job data
    const jobResponse = await safeFetch(
      `${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`
    );

    if (!jobResponse.ok) {
      console.error('[JobService] Job fetch failed:', jobResponse.status);
      return { job: null, error: 'Failed to fetch job' };
    }

    const jobData = await jobResponse.json();
    if (!jobData || jobData.length === 0) {
      return { job: null, error: 'Job not found' };
    }

    // Fetch bids for this job (Exclude REJECTED bids to match UI behavior)
    // [FIX] Use RPC to fetch bids to avoid RLS recursion issues
    const { safeRPC } = await import('../lib/supabase');
    const { data: bidsRpcData, error: bidsRpcError } = await safeRPC('get_job_bids', { p_job_id: jobId });

    let bidsData: any[] = [];
    if (!bidsRpcError && bidsRpcData) {
      bidsData = bidsRpcData;
      console.log(`[JobService] RPC get_job_bids success: ${bidsData.length} bids`);
    } else {
      console.warn(`[JobService] RPC get_job_bids failed:`, bidsRpcError);
      // Fallback to legacy REST (just in case RPC isn't deployed yet)
      const bidsUrl = `${supabaseUrl}/rest/v1/bids?job_id=eq.${jobId}&status=neq.REJECTED&order=created_at.desc`;
      console.log(`[JobService] Fallback fetching bids from: ${bidsUrl}`);
      const bidsResponse = await safeFetch(bidsUrl);
      if (bidsResponse.ok) {
        bidsData = await bidsResponse.json();
      }
    }

    // Fetch reviews for this job
    const reviewsResponse = await safeFetch(
      `${supabaseUrl}/rest/v1/reviews?job_id=eq.${jobId}`
    );

    let reviewsData: any[] = [];
    if (reviewsResponse.ok) {
      reviewsData = await reviewsResponse.json();
    }

    const bids: Bid[] = (bidsData || []).map((dbBid: any) => dbBidToApp(dbBid));
    const reviews: Review[] = (reviewsData || []).map((r: any) => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      reviewerName: r.reviewer_name || 'Unknown',
      revieweeId: r.reviewee_id,
      rating: r.rating,
      comment: r.comment,
      date: new Date(r.created_at).getTime()
    }));

    const job: Job = {
      ...dbJobToApp(jobData[0] as DbJob, bids),
      reviews,
      bidCount: bids.length
    };

    console.log(`[JobService] Loaded full details: ${job.title} with ${bids.length} bids`);
    return { job };
  } catch (error: any) {
    console.error('[JobService] fetchJobFullDetails error:', error?.message || error);
    return { job: null, error: error?.message || 'Failed to fetch job details' };
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
    console.log(`[JobService] fetchJobs: Querying 'jobs' table...`);
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobsError) {
      console.error('[JobService] Error fetching jobs from table:', jobsError);
      throw jobsError;
    }

    console.log(`[JobService] fetchJobs: Found ${jobsData?.length || 0} jobs.`);
    const jobIds = jobsData?.map(j => j.id) || [];

    // Step 2: Only fetch bids for the jobs we just loaded
    let bidsData: any[] = [];
    if (jobIds.length > 0) {
      console.log(`[JobService] fetchJobs: Querying 'bids' for ${jobIds.length} jobs...`);
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

// Create a new job - OPTIMIZED: Uses REST API to avoid client hanging
export const createJob = async (job: Job): Promise<{ success: boolean; error?: string; data?: { id: string } }> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const payload = {
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
    };

    console.log('[JobService] Creating job with payload:', JSON.stringify(payload, null, 2));

    // Use safeFetch instead of Supabase client to prevent hanging
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/jobs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JobService] Job creation failed:', response.status, errorText);
      throw new Error(`Job creation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No data returned from insert');
    }

    const jobId = data[0].id;
    console.log('[JobService] ✅ Job created successfully with ID:', jobId);
    return { success: true, data: { id: jobId } };
  } catch (error: any) {
    console.error('[JobService] ❌ Error creating job:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to create job';
    return { success: false, error: errorMessage };
  }
};

// Update a job
export const updateJob = async (job: Job): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[JobService] Attempting to update job:', job.id);

    // Explicitly update all fields
    const { data, error, count } = await supabase
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

    // Removed .select() to prevent potential hang
    // Removed .select() to prevent potential hang

    if (error) {
      console.error('[JobService] Update error:', error);
      throw error;
    }

    console.log('[JobService] Update successful. Rows modified:', count);

    if (count === 0) {
      console.warn('[JobService] Update returned 0 rows. Possible RLS violation, ID mismatch, or no changes.');
    }

    // Update bids if they exist in the job
    if (job.bids && job.bids.length > 0) {
      for (const bid of job.bids) {
        await updateBid(bid);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[JobService] Error updating job:', error);
    return { success: false, error: error.message || 'Failed to update job' };
  }
};

// Delete a job (ONLY if OPEN and no accepted bids) - OPTIMIZED: Uses REST API
export const deleteJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[JobService] Attempting to delete job:', jobId);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // 1. First check job status - only OPEN jobs can be deleted (using REST API)
    const fetchResponse = await safeFetch(
      `${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}&select=status,accepted_bid_id,title`
    );

    if (!fetchResponse.ok) {
      console.error('[JobService] Error fetching job for deletion:', fetchResponse.status);
      throw new Error('Job not found');
    }

    const jobs = await fetchResponse.json();
    if (!jobs || jobs.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobs[0];

    // 2. Block deletion of IN_PROGRESS jobs (must be cancelled/completed first)
    if (job.status === 'IN_PROGRESS') {
      throw new Error('Cannot delete job that is in progress. Please cancel it first.');
    }
    // COMPLETED jobs can now be deleted by the poster if they wish to clean their history.

    // 3. SOFT HIDE: Call RPC instead of DELETE
    const { safeRPC } = await import('../lib/supabase');
    const { error: hideError } = await safeRPC('hide_job_for_user', { p_job_id: jobId });

    if (hideError) {
      console.error('[JobService] Soft-hide error:', hideError);
      throw new Error(`Hide failed: ${hideError.message || 'Unknown error'}`);
    }

    console.log('[JobService] ✅ Job hidden (soft-deleted):', job.title);

    // Broadcast update (subscriber will handle hiding it in UI)
    broadcastRefresh('job_updated', { id: jobId, status: 'HIDDEN' });

    return { success: true };
  } catch (error: any) {
    console.error('[JobService] ❌ Error deleting job:', error);
    return { success: false, error: error.message || 'Failed to delete job' };
  }
};

// Create a bid
// Create a bid (SAFE RPC)
export const createBid = async (bid: Bid): Promise<{ success: boolean; error?: string; data?: { id: string } }> => {
  try {
    // Use safeRPC to avoid Supabase client hanging after refresh
    const { safeRPC } = await import('../lib/supabase');
    const { data, error } = await safeRPC('action_place_bid', {
      p_job_id: bid.jobId,
      p_amount: bid.amount,
      p_message: bid.message
    });

    if (error) throw error;
    // RPC returns { success: boolean, error?: string, bid_id?: uuid }
    if (data && !data.success) {
      throw new Error(data.error || 'Unknown error from server');
    }

    // If success, data.bid_id should be present
    console.log('[JobService] Bid created successfully via RPC');

    // BROADCAST: Notify others about the new bid
    // We include job_id and worker_id so filters work correctly
    broadcastRefresh('bid_inserted', {
      id: data.bid_id,
      job_id: bid.jobId,
      worker_id: bid.workerId,
      amount: bid.amount,
      status: 'PENDING',
      worker_name: bid.workerName,
      negotiation_history: bid.negotiationHistory
    });

    return { success: true, data: { id: data.bid_id } };
  } catch (error: any) {
    console.error('[JobService] Error creating bid:', error);
    return { success: false, error: error.message || 'Failed to create bid' };
  }
};

// Update a bid (Smart Handler) - Direct REST API
export const updateBid = async (bid: Bid, _accessToken?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[JobService] Updating bid:', bid.id, 'Status:', bid.status, 'Amount:', bid.amount);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // If status is ACCEPTED, use the Atomic RPC (use safeRPC to avoid blocking)
    if (bid.status === 'ACCEPTED') {
      console.log('[JobService] Accepting bid via RPC...');
      const { safeRPC } = await import('../lib/supabase');
      const { data, error } = await safeRPC('action_accept_bid', {
        p_bid_id: bid.id
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to accept bid');
      }

      console.log('[JobService] Bid accepted successfully');

      // BROADCAST: Notify others about the bid acceptance and job status change
      broadcastRefresh('bid_updated', {
        id: bid.id,
        job_id: bid.jobId,
        worker_id: bid.workerId,
        status: 'ACCEPTED'
      });
      broadcastRefresh('job_updated', { id: bid.jobId, status: 'IN_PROGRESS' });

      return { success: true };
    }

    // For counter/negotiation: Use safeFetch for robustness (handles token refresh automatically)
    console.log('[JobService] Sending counter-offer via REST API...');

    const updatePayload: any = {
      amount: bid.amount,
      message: bid.message,
      status: bid.status
    };

    // Only include negotiation_history if it exists
    if (bid.negotiationHistory && bid.negotiationHistory.length > 0) {
      updatePayload.negotiation_history = bid.negotiationHistory;
    }

    console.log('[JobService] Update payload:', JSON.stringify(updatePayload));

    // Use safeFetch instead of manual fetch
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/bids?id=eq.${bid.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(updatePayload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JobService] REST API update failed:', response.status, errorText);
      throw new Error(`Update failed: ${response.status} - ${errorText}`);
    }

    console.log('[JobService] Counter-offer sent successfully');

    // BROADCAST: Notify others about the counter-offer
    broadcastRefresh('bid_updated', {
      id: bid.id,
      job_id: bid.jobId,
      worker_id: bid.workerId,
      status: bid.status,
      amount: bid.amount,
      negotiation_history: bid.negotiationHistory,
      created_at: new Date().toISOString(), // Fallback to now
      poster_id: bid.posterId
    });

    return { success: true };
  } catch (error: any) {
    console.error('[JobService] Error updating bid:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to update bid' };
  }
};

// Reject a bid
export const rejectBid = async (bidId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[JobService] Attempting to reject bid:', bidId);

    const { data, error } = await supabase
      .from('bids')
      .update({ status: 'REJECTED' })
      .eq('id', bidId)
      .select('job_id, worker_id') // Select necessary fields for broadcast
      .single();

    if (error) {
      console.error('[JobService] Reject bid error:', error);
      throw error;
    }

    console.log('[JobService] Bid rejected successfully.');

    // Broadcast the update immediately
    broadcastRefresh('bid_updated', {
      id: bidId,
      job_id: data.job_id,
      worker_id: data.worker_id,
      status: 'REJECTED',
      created_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error('[JobService] Error rejecting bid:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to reject bid' };
  }
};

// Cancel a job (Poster only) - With validation
export const cancelJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[JobService] Cancelling job:', jobId);

    // 1. First check job status - cannot cancel completed jobs
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('status, title')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      throw new Error('Job not found');
    }

    // Block cancellation of completed jobs
    if (job.status === 'COMPLETED') {
      throw new Error('Cannot cancel completed jobs.');
    }

    if (job.status === 'CANCELLED') {
      throw new Error('Job is already cancelled.');
    }

    // 2. Update status to CANCELLED (trigger will send notifications)
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'CANCELLED' })
      .eq('id', jobId);

    if (error) throw error;

    // Broadcast the cancellation
    broadcastRefresh('job_updated', { id: jobId, status: 'CANCELLED' });

    console.log('[JobService] Job cancelled successfully:', job.title);
    return { success: true };
  } catch (error: any) {
    console.error('[JobService] Error cancelling job:', error);
    return { success: false, error: error.message || 'Failed to cancel job' };
  }
};

/**
 * Fetch contact details (phone) for a job
 * Only accessible if job status is IN_PROGRESS and user is part of the job
 */
export const fetchJobContact = async (jobId: string): Promise<{ phone: string | null; error?: string }> => {
  try {
    const { data, error } = await waitForSupabase(async () => {
      return await supabase.rpc('get_job_contact', { p_job_id: jobId });
    });
    if (error) throw error;
    return { phone: data?.phone || null };
  } catch (error: any) {
    console.error('Error fetching job contact:', error);
    return { phone: null, error: error.message };
  }
};

