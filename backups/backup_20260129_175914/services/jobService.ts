import { supabase, waitForSupabase } from '../lib/supabase';
import { safeFetch, safeRPC } from './fetchUtils';
import { Job, Bid, JobStatus, Review, DashboardStats } from '../types';
import { logger } from '../lib/logger';

interface DbJob {
  id: string;
  poster_id: string;
  poster_name: string;
  poster_phone: string;
  poster_photo?: string;
  poster_rating?: number;
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
  hired_worker_id?: string;
  is_recommended?: boolean;
  translations?: Record<string, {
    title: string;
    description: string;
    cached_at: number;
  }>;
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
    status: (dbJob.status || 'OPEN') as JobStatus,
    acceptedBidId: dbJob.accepted_bid_id || undefined,
    image: dbJob.image || undefined,
    createdAt: new Date(dbJob.created_at).getTime(),
    bids,
    bidCount: Number(dbJob.bid_count || bids.length || 0),
    myBidId: dbJob.my_bid_id,
    myBidStatus: dbJob.my_bid_status,
    myBidAmount: dbJob.my_bid_amount,
    myBidLastNegotiationBy: dbJob.my_bid_last_negotiation_by,
    hiredWorkerId: dbJob.hired_worker_id,
    isRecommended: !!dbJob.is_recommended,
    translations: dbJob.translations ? Object.entries(dbJob.translations).reduce((acc, [lang, data]) => ({
      ...acc,
      [lang]: {
        title: data.title,
        description: data.description,
        cachedAt: data.cached_at
      }
    }), {}) : undefined
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
  logger.log(`[JobService] Broadcast ${eventType} skipped (using postgres_changes instead)`);
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
    feedMode?: string;
    sortBy?: string;
    minBudget?: number;
    maxDistance?: number;
    userLat?: number;
    userLng?: number;
  }
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  logger.log(`[JobService] Fetching HOME FEED for user ${userId} (offset: ${offset}, filters: ${JSON.stringify(filters)})...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use RPC for efficient Server-Side Filtering
    const { data: rpcData, error: rpcError } = await safeRPC<any[]>(
      'get_home_feed',
      {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
        p_category: filters?.category !== 'All' ? filters?.category : null,
        p_search_query: filters?.searchQuery || null,
        p_feed_mode: filters?.feedMode || 'RECOMMENDED',
        p_sort_by: filters?.sortBy || 'NEWEST',
        p_min_budget: filters?.minBudget || null,
        p_max_distance: filters?.maxDistance || null,
        p_user_lat: filters?.userLat || null,
        p_user_lng: filters?.userLng || null
      }
    );

    if (rpcError) {
      logger.error(`[JobService] RPC get_home_feed failed:`, rpcError);
      throw new Error(`Feed fetch failed: ${rpcError.message || 'Unknown error'}`);
    }

    const data = rpcData || [];
    logger.log(`[JobService] RPC Data received: ${data?.length || 0} rows`);

    const jobs = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name || 'Unknown',
      posterPhoto: row.poster_photo,
      posterRating: Number(row.poster_rating),
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
      status: (row.status || 'OPEN').toString().toUpperCase() as JobStatus,
      image: row.image,
      createdAt: new Date(row.created_at).getTime(),
      bidCount: row.bid_count || 0,
      hasMyReview: false, // Discovery jobs aren't reviewed yet
      isRecommended: row.is_recommended || false, // Map RPC field
      translations: row.translations || undefined, // Map translations
      bids: [] // Bids are not needed for the card view, saved bandwidth
    } as Job));

    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    logger.error('[JobService] fetchHomeFeed error:', error);
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
  logger.log(`[JobService] Fetching POSTER feed for user ${userId}...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use RPC to get computed fields like last_bid_negotiation_by
    const { data: rpcData, error: rpcError } = await safeRPC<any[]>(
      'get_my_jobs_feed',
      {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset
      }
    );

    if (rpcError) {
      logger.error(`[JobService] RPC get_my_jobs_feed failed:`, rpcError);
      return fetchMyJobsFeedFallback(userId, limit, offset);
    }

    const data = rpcData || [];

    // Map RPC result to Job objects
    const jobs: Job[] = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name || 'Me',
      posterPhoto: row.poster_photo,
      posterRating: Number(row.poster_rating),
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: row.budget,
      status: (row.status || 'OPEN').toString().toUpperCase() as JobStatus,
      createdAt: new Date(row.created_at).getTime(),
      image: row.image,
      bidCount: Number(row.bid_count || 0),
      acceptedBidId: row.accepted_bid_id,
      myBidLastNegotiationBy: row.my_bid_last_negotiation_by,
      hasAgreement: row.has_agreement || false,
      hasNewBid: row.has_new_bid || false,
      actionRequiredCount: Number(row.action_required_count || 0),
      hasMyReview: row.has_my_review || false,
      hiredWorkerName: row.hired_worker_name,
      hiredWorkerPhone: row.hired_worker_phone,
      hiredWorkerId: row.hired_worker_id,
      translations: row.translations || undefined, // Map translations
      bids: [],
      reviews: []
    } as Job));

    logger.log(`[JobService] ✅ POSTER feed complete: ${jobs.length} jobs found`);
    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    logger.error('[JobService] fetchMyJobsFeed error:', error);
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
  logger.log(`[JobService] Fetching my applications feed for user ${userId} (limit: ${limit}, offset: ${offset})...`);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Use Optimized RPC
    const { data: rpcData, error: rpcError } = await safeRPC<any[]>(
      'get_my_applications_feed',
      {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset
      }
    );

    if (rpcError) {
      logger.error(`[JobService] RPC get_my_applications_feed failed:`, rpcError);
      return fetchMyApplicationsFeedFallback(userId, limit, offset);
    }

    const data = rpcData || [];
    logger.log(`[JobService] RPC Data received: ${data?.length || 0} applications`);

    const jobs: Job[] = (data || []).map((row: any) => ({
      id: row.id,
      posterId: row.poster_id,
      posterName: row.poster_name || 'Employer',
      posterPhone: row.poster_phone,
      posterPhoto: row.poster_photo,
      posterRating: Number(row.poster_rating),
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      coordinates: row.latitude && row.longitude
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : undefined,
      jobDate: row.job_date,
      duration: row.duration,
      budget: row.budget,
      status: (row.status || 'OPEN').toString().toUpperCase() as JobStatus,
      createdAt: new Date(row.created_at).getTime(),
      image: row.image,
      bidCount: Number(row.bid_count || 1),
      myBidId: row.my_bid_id,
      myBidStatus: (row.my_bid_status || 'PENDING').toString().toUpperCase() as any,
      myBidAmount: row.my_bid_amount,
      myBidLastNegotiationBy: row.my_bid_last_negotiation_by,
      acceptedBidId: row.accepted_bid_id,
      hasMyReview: row.has_my_review || false,
      translations: row.translations || undefined, // Map translations
      bids: [],
      reviews: []
    } as Job));

    logger.log(`[JobService] ✅ Applications feed optimized: ${jobs.length} jobs loaded via single RPC`);
    return { jobs, hasMore: jobs.length === limit };
  } catch (error: any) {
    logger.error('[JobService] fetchMyApplicationsFeed exception:', error?.message || error);
    return { jobs: [], hasMore: false };
  }
};

/**
 * Fallback for my applications feed using direct REST
 */
const fetchMyApplicationsFeedFallback = async (
  userId: string,
  limit: number,
  offset: number
): Promise<{ jobs: Job[]; hasMore: boolean }> => {
  const { data, error } = await supabase
    .from('bids')
    .select(`
      job_id,
      status, 
      amount,
      negotiation_history,
      jobs (*)
    `)
    .eq('worker_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { jobs: [], hasMore: false };

  // Map to Job objects
  const jobs: Job[] = data.map((row: any) => {
    const job = dbJobToApp(row.jobs as DbJob);
    return {
      ...job,
      myBidId: row.id,
      myBidStatus: (row.status || 'PENDING').toUpperCase(),
      myBidAmount: row.amount,
      myBidLastNegotiationBy: row.negotiation_history && row.negotiation_history.length > 0 ? row.negotiation_history[row.negotiation_history.length - 1]?.by : null
    };
  });

  return { jobs, hasMore: jobs.length === limit };
};

/**
 * Fetch dashboard counts for tabs (Active, History, etc.)
 */
export const fetchDashboardStats = async (userId: string): Promise<DashboardStats> => {
  try {
    const { safeRPC } = await import('../lib/supabase');
    const { data, error } = await safeRPC('get_dashboard_stats', { p_user_id: userId });

    if (error) throw error;
    return data || { poster_active: 0, poster_history: 0, worker_active: 0, worker_history: 0, discover_active: 0 };
  } catch (error) {
    logger.error('[JobService] fetchDashboardStats error:', error);
    return { poster_active: 0, poster_history: 0, worker_active: 0, worker_history: 0, discover_active: 0 };
  }
};



/**
 * [OPTIMIZED] Fetch full job details including all bids - Direct REST API
 * Called when user clicks on a job to view details/bids
 */
export const fetchJobFullDetails = async (jobId: string): Promise<{ job: Job | null; error?: string }> => {
  try {
    logger.log(`[JobService] Fetching full details for job: ${jobId}`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const { safeRPC } = await import('../lib/supabase');
    const { user } = await import('../contexts/UserContextDB').then(m => {
      // This is a service, so we might not have access to Context. 
      // We should ideally pass userId to this function.
      // But for now, let's try to get current session.
      return { user: null };
    });

    // Get current user session for RPC
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

    // 1. Fetch Job + Poster + MyBid Details in ONE RPC call
    const { data: rpcData, error: rpcError } = await safeRPC('get_job_details', {
      p_job_id: jobId,
      p_user_id: userId
    });

    if (rpcError || !rpcData || rpcData.length === 0) {
      logger.error('[JobService] Job RPC failed:', rpcError);
      // Fallback to minimal REST fetch for backward compatibility
      const jobResponse = await safeFetch(`${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`);
      if (!jobResponse.ok) return { job: null, error: 'Job not found' };
      const fallbackData = await jobResponse.json();
      if (!fallbackData || fallbackData.length === 0) return { job: null, error: 'Job not found' };
      // Map minimal data
      var jobBase = dbJobToApp(fallbackData[0] as DbJob);
    } else {
      const row = rpcData[0];
      var jobBase: Job = {
        id: row.id,
        posterId: row.poster_id,
        posterName: row.poster_name,
        posterPhone: row.poster_phone,
        posterPhoto: row.poster_photo,
        posterRating: Number(row.poster_rating),
        title: row.title,
        description: row.description,
        category: row.category,
        location: row.location,
        coordinates: row.latitude && row.longitude ? { lat: Number(row.latitude), lng: Number(row.longitude) } : undefined,
        jobDate: row.job_date,
        duration: row.duration,
        budget: row.budget,
        status: row.status as JobStatus,
        acceptedBidId: row.accepted_bid_id,
        image: row.image,
        createdAt: new Date(row.created_at).getTime(),
        bidCount: Number(row.bid_count || 0),
        myBidId: row.my_bid_id,
        myBidStatus: row.my_bid_status,
        hasAgreement: row.has_agreement,
        hasMyReview: row.has_my_review !== undefined ? row.has_my_review : false,
        bids: [],
        reviews: []
      };

      // [CRITICAL FALLBACK] If RPC hasn't been updated with has_my_review field,
      // or to double check for completed jobs, do a quick REST check.
      if (row.has_my_review === undefined && jobBase.status === JobStatus.COMPLETED) {
        try {
          const reviewCheck = await safeFetch(`${supabaseUrl}/rest/v1/reviews?job_id=eq.${jobId}&reviewer_id=eq.${userId}&select=id`);
          if (reviewCheck.ok) {
            const reviews = await reviewCheck.json();
            jobBase.hasMyReview = reviews.length > 0;
            logger.log(`[JobService] REST Fallback: User has reviewed job? ${jobBase.hasMyReview}`);
          }
        } catch (e) {
          logger.warn('[JobService] Review fallback check failed');
        }
      }
    }

    // Fetch bids for this job (Exclude REJECTED bids to match UI behavior)
    // [FIX] Use RPC to fetch bids to avoid RLS recursion issues
    // Only fetch if user is poster or has a bid to prevent 400 errors
    let bidsData: any[] = [];

    // Check access rights before calling RPC to avoid "Access Denied" logs
    const isPoster = jobBase.posterId === userId;
    const hasBid = !!jobBase.myBidId;

    if (isPoster || hasBid) {
      const { data: bidsRpcData, error: bidsRpcError } = await safeRPC('get_job_bids', { p_job_id: jobId });

      if (!bidsRpcError && bidsRpcData) {
        bidsData = bidsRpcData;
        logger.log(`[JobService] RPC get_job_bids success: ${bidsData.length} bids`);
      } else {
        logger.warn(`[JobService] RPC get_job_bids failed:`, bidsRpcError);
        // Fallback to legacy REST (just in case RPC isn't deployed yet)
        const bidsUrl = `${supabaseUrl}/rest/v1/bids?job_id=eq.${jobId}&status=neq.REJECTED&order=created_at.desc`;
        logger.log(`[JobService] Fallback fetching bids from: ${bidsUrl}`);
        const bidsResponse = await safeFetch(bidsUrl);
        if (bidsResponse.ok) {
          bidsData = await bidsResponse.json();
        }
      }
    } else {
      logger.log(`[JobService] Skipping get_job_bids (User is not poster/bidder)`);
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
      ...jobBase,
      bids,
      reviews,
      // Ensure bidCount is accurate from the bids we just loaded if RPC was null
      bidCount: jobBase.bidCount || bids.length
    };

    logger.log(`[JobService] Loaded full details for ${job.id}: ${job.title} with ${bids.length} bids`);
    return { job };
  } catch (error: any) {
    logger.error('[JobService] fetchJobFullDetails error:', error?.message || error);
    return { job: null, error: error?.message || 'Failed to fetch job details' };
  }
};

// ============================================================================
// LEGACY FETCH (Kept for backward compatibility)
// ============================================================================

// Fetch jobs with pagination (optimized for scale)
export const fetchJobs = async (limit: number = 100, offset: number = 0): Promise<{ jobs: Job[]; error?: string; hasMore?: boolean }> => {
  try {
    logger.log(`[JobService] Fetching jobs (limit: ${limit}, offset: ${offset})...`);

    // Step 1: Fetch paginated jobs first
    logger.log(`[JobService] fetchJobs: Querying 'jobs' table...`);
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobsError) {
      logger.error('[JobService] Error fetching jobs from table:', jobsError);
      throw jobsError;
    }

    logger.log(`[JobService] fetchJobs: Found ${jobsData?.length || 0} jobs.`);
    const jobIds = jobsData?.map(j => j.id) || [];

    // Step 2: Only fetch bids for the jobs we just loaded
    let bidsData: any[] = [];
    if (jobIds.length > 0) {
      logger.log(`[JobService] fetchJobs: Querying 'bids' for ${jobIds.length} jobs...`);
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (bidsError) {
        logger.error('[JobService] Error fetching bids:', bidsError);
        // Continue without bids rather than failing completely
      } else {
        bidsData = bids || [];
      }
    }

    logger.log(`[JobService] Fetched ${jobsData?.length || 0} jobs and ${bidsData?.length || 0} bids.`);

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
        logger.warn('Skipping invalid bid:', dbBid.id, e);
      }
    });

    // Combine jobs with their bids
    const jobs = jobsData?.map(dbJob => {
      try {
        return dbJobToApp(dbJob, bidsByJob.get(dbJob.id) || []);
      } catch (e) {
        logger.error('Error mapping job:', dbJob.id, e);
        return null; // Filter out bad jobs rather than breaking completely
      }
    }).filter(j => j !== null) as Job[];

    // Check if there are more jobs (for infinite scroll)
    const hasMore = jobsData && jobsData.length === limit;

    return { jobs, hasMore };
  } catch (error) {
    logger.error('[JobService] Critical error fetching jobs:', error);
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

    logger.log('[JobService] Creating job with payload:', JSON.stringify(payload, null, 2));

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
      logger.error('[JobService] Job creation failed:', response.status, errorText);
      throw new Error(`Job creation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No data returned from insert');
    }

    const jobId = data[0].id;
    logger.log('[JobService] ✅ Job created successfully with ID:', jobId);
    return { success: true, data: { id: jobId } };
  } catch (error: any) {
    logger.error('[JobService] ❌ Error creating job:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to create job';
    return { success: false, error: errorMessage };
  }
};

// Update a job
export const updateJob = async (job: Job): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.log('[JobService] Attempting to update job:', job.id);

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
      logger.error('[JobService] Update error:', error);
      throw error;
    }

    logger.log('[JobService] Update successful. Rows modified:', count);

    if (count === 0) {
      logger.warn('[JobService] Update returned 0 rows. Possible RLS violation, ID mismatch, or no changes.');
    }

    return { success: true };
  } catch (error: any) {
    logger.error('[JobService] Error updating job:', error);
    return { success: false, error: error.message || 'Failed to update job' };
  }
};

// Save a translation to the database (Single-Fetch Caching)
export const saveJobTranslation = async (jobId: string, lang: string, title: string, description: string): Promise<boolean> => {
  try {
    const { safeRPC } = await import('../lib/supabase');
    const { error } = await safeRPC('action_save_job_translation', {
      p_job_id: jobId,
      p_lang: lang,
      p_translated_title: title,
      p_translated_desc: description
    });

    if (error) {
      console.error('[JobService] Failed to save translation:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[JobService] Exception saving translation:', e);
    return false;
  }
};

// Delete a job (ONLY if OPEN and no accepted bids) - OPTIMIZED: Uses REST API
export const deleteJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.log('[JobService] Attempting to delete job:', jobId);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // 1. First check job status - only OPEN jobs can be deleted (using REST API)
    const fetchResponse = await safeFetch(
      `${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}&select=status,accepted_bid_id,title`
    );

    if (!fetchResponse.ok) {
      logger.error('[JobService] Error fetching job for deletion:', fetchResponse.status);
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
      logger.error('[JobService] Soft-hide error:', hideError);
      throw new Error(`Hide failed: ${hideError.message || 'Unknown error'}`);
    }

    logger.log('[JobService] ✅ Job hidden (soft-deleted):', job.title);

    // Broadcast update (subscriber will handle hiding it in UI)
    broadcastRefresh('job_updated', { id: jobId, status: 'HIDDEN' });

    return { success: true };
  } catch (error: any) {
    logger.error('[JobService] ❌ Error deleting job:', error);
    return { success: false, error: error.message || 'Failed to delete job' };
  }
};

/**
 * Archive/Hide a job from the user's view (Poster or Worker)
 * This does NOT delete data, just hides it from feeds.
 */
export const archiveJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { safeRPC } = await import('../lib/supabase');
    logger.log('[JobService] Archiving job:', jobId);

    const { error } = await safeRPC('hide_job_for_user', { p_job_id: jobId });

    if (error) throw error;

    // Broadcast update so UI removes it immediately
    broadcastRefresh('job_updated', { id: jobId, status: 'HIDDEN' });

    return { success: true };
  } catch (error: any) {
    logger.error('[JobService] Archive failed:', error);
    return { success: false, error: error.message };
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
    logger.log('[JobService] Bid created successfully via RPC');

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
    logger.error('[JobService] Error creating bid:', error);
    return { success: false, error: error.message || 'Failed to create bid' };
  }
};

// Update a bid (Smart Handler) - Direct REST API
export const updateBid = async (bid: Bid, _accessToken?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.log('[JobService] Updating bid:', bid.id, 'Status:', bid.status, 'Amount:', bid.amount);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // If status is ACCEPTED, use the Atomic RPC (use safeRPC to avoid blocking)
    if (bid.status === 'ACCEPTED') {
      logger.log('[JobService] Accepting bid via RPC...');
      const { safeRPC } = await import('../lib/supabase');
      const { data, error } = await safeRPC('action_accept_bid', {
        p_bid_id: bid.id
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to accept bid');
      }

      logger.log('[JobService] Bid accepted successfully');

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

    // For counter/negotiation: Use RPC for security and integrity
    logger.log('[JobService] Sending counter-offer via RPC...');

    const { safeRPC } = await import('../lib/supabase');
    const { data: rpcData, error: rpcError } = await safeRPC('action_counter_bid', {
      p_bid_id: bid.id,
      p_amount: bid.amount,
      p_message: bid.message
    });

    if (rpcError) throw rpcError;
    if (rpcData && !rpcData.success) {
      throw new Error(rpcData.error || 'Failed to submit counter offer');
    }

    logger.log('[JobService] Counter-offer sent successfully');

    // BROADCAST: Notify others about the counter-offer
    // Note: The RPC updates the DB, so Realtime will eventually catch it,
    // but we broadcast for instant UI feel.
    broadcastRefresh('bid_updated', {
      id: bid.id,
      job_id: bid.jobId,
      worker_id: bid.workerId,
      status: 'PENDING', // RPC resets status to PENDING
      amount: bid.amount,
      negotiation_history: bid.negotiationHistory, // Optimistic: assumes appended correctly
      created_at: new Date().toISOString(),
      poster_id: bid.posterId
    });

    return { success: true };
  } catch (error: any) {
    logger.error('[JobService] Error updating bid:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to update bid' };
  }
};

// Reject a bid
// Reject a bid
export const rejectBid = async (bidId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.log('[JobService] Attempting to reject bid:', bidId);

    const { safeRPC } = await import('../lib/supabase');
    const { data: rpcData, error: rpcError } = await safeRPC('action_reject_bid', {
      p_bid_id: bidId
    });

    if (rpcError) throw rpcError;
    // RPC returns { success: boolean, error?: string }
    if (rpcData && !rpcData.success) {
      throw new Error(rpcData.error || 'Failed to reject bid (Server Error)');
    }

    logger.log('[JobService] Bid rejected successfully via RPC.');

    // Broadcast the update immediately
    // Note: RPC doesn't return job_id/worker_id, so we can't broadcast full details without a pre-fetch.
    // However, the RPC handles the notification for the user. 
    // For local UI update, just returning success should trigger a refetch if implemented correctly.
    // Ideally we would fetch the bid first to know who to broadcast to, but preserving performance is better.
    // A simple refresh signal is safer.
    broadcastRefresh('bid_updated', {
      id: bidId,
      status: 'REJECTED',
      created_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    logger.error('[JobService] Error rejecting bid:', error?.message || error);
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

/**
 * Save a generated translation to the job cache
 */

