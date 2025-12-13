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
    createdAt: new Date(dbBid.created_at).getTime()
  };
};

// Fetch all jobs with their bids
export const fetchJobs = async (): Promise<{ jobs: Job[]; error?: string }> => {
  try {
    // Fetch all jobs
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (jobsError) throw jobsError;

    // Fetch all bids
    const { data: bidsData, error: bidsError } = await supabase
      .from('bids')
      .select('*')
      .order('created_at', { ascending: false });

    if (bidsError) throw bidsError;

    // Group bids by job_id
    const bidsByJob = new Map<string, Bid[]>();
    bidsData?.forEach(dbBid => {
      const bid = dbBidToApp(dbBid);
      if (!bidsByJob.has(bid.jobId)) {
        bidsByJob.set(bid.jobId, []);
      }
      bidsByJob.get(bid.jobId)!.push(bid);
    });

    // Combine jobs with their bids
    const jobs = jobsData?.map(dbJob =>
      dbJobToApp(dbJob, bidsByJob.get(dbJob.id) || [])
    ) || [];

    return { jobs };
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return { jobs: [], error: 'Failed to fetch jobs' };
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

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error creating bid:', error);
    return { success: false, error: 'Failed to create bid' };
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
