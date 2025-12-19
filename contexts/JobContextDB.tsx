import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Job, Bid, JobStatus } from '../types';
import { fetchJobs, createJob as createJobDB, updateJob as updateJobDB, deleteJob as deleteJobDB, createBid as createBidDB, updateBid as updateBidDB } from '../services/jobService';
import { supabase } from '../lib/supabase';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => Promise<string | undefined>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  addBid: (bid: Bid) => Promise<void>;
  updateBid: (bid: Bid) => Promise<void>;
  refreshJobs: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

// --- Surgical Sync Helpers ---
// Convert a DB job row to our App Job type (without bids, they are handled separately)
const dbJobToAppJob = (dbJob: any): Omit<Job, 'bids'> => ({
  id: dbJob.id,
  posterId: dbJob.poster_id,
  posterName: dbJob.poster_name,
  posterPhone: dbJob.poster_phone,
  posterPhoto: dbJob.poster_photo || undefined,
  title: dbJob.title,
  description: dbJob.description,
  category: dbJob.category,
  location: dbJob.location,
  coordinates: dbJob.latitude && dbJob.longitude ? { lat: Number(dbJob.latitude), lng: Number(dbJob.longitude) } : undefined,
  jobDate: dbJob.job_date,
  duration: dbJob.duration,
  budget: dbJob.budget,
  status: dbJob.status as JobStatus,
  acceptedBidId: dbJob.accepted_bid_id || undefined,
  image: dbJob.image || undefined,
  createdAt: new Date(dbJob.created_at).getTime(),
});

// Convert a DB bid row to our App Bid type
const dbBidToAppBid = (dbBid: any): Bid => ({
  id: dbBid.id,
  jobId: dbBid.job_id,
  workerId: dbBid.worker_id,
  workerName: dbBid.worker_name,
  workerPhone: dbBid.worker_phone,
  workerRating: Number(dbBid.worker_rating),
  workerLocation: dbBid.worker_location,
  workerCoordinates: dbBid.worker_latitude && dbBid.worker_longitude ? { lat: Number(dbBid.worker_latitude), lng: Number(dbBid.worker_longitude) } : undefined,
  workerPhoto: dbBid.worker_photo || undefined,
  amount: dbBid.amount,
  message: dbBid.message,
  status: dbBid.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
  negotiationHistory: dbBid.negotiation_history || [],
  createdAt: new Date(dbBid.created_at).getTime(),
  posterId: dbBid.poster_id,
});

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs on mount
  useEffect(() => {
    refreshJobs();
  }, []);

  // --- Surgical Sync Handlers ---
  const handleJobChange = useCallback((eventType: string, payload: any) => {
    console.log(`[Realtime] Surgical Job ${eventType}:`, payload.new?.id || payload.old?.id);

    if (eventType === 'INSERT' && payload.new) {
      const newJob: Job = { ...dbJobToAppJob(payload.new), bids: [] };
      setJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)]); // Prepend, avoid duplicates
    } else if (eventType === 'UPDATE' && payload.new) {
      setJobs(prev => prev.map(j => {
        if (j.id === payload.new.id) {
          return { ...dbJobToAppJob(payload.new), bids: j.bids }; // Keep existing bids
        }
        return j;
      }));
    } else if (eventType === 'DELETE' && payload.old) {
      setJobs(prev => prev.filter(j => j.id !== payload.old.id));
    }
  }, []);

  const handleBidChange = useCallback((eventType: string, payload: any) => {
    console.log(`[Realtime] Surgical Bid ${eventType}:`, payload.new?.id || payload.old?.id);

    if (eventType === 'INSERT' && payload.new) {
      const newBid = dbBidToAppBid(payload.new);
      setJobs(prev => prev.map(j => {
        if (j.id === newBid.jobId) {
          // Only add if not already present (avoid duplicates from optimistic UI)
          const exists = j.bids.some(b => b.id === newBid.id);
          return exists ? j : { ...j, bids: [...j.bids, newBid] };
        }
        return j;
      }));
    } else if (eventType === 'UPDATE' && payload.new) {
      const updatedBid = dbBidToAppBid(payload.new);
      setJobs(prev => prev.map(j => {
        if (j.id === updatedBid.jobId) {
          return { ...j, bids: j.bids.map(b => b.id === updatedBid.id ? updatedBid : b) };
        }
        return j;
      }));
    } else if (eventType === 'DELETE' && payload.old) {
      setJobs(prev => prev.map(j => {
        if (j.id === payload.old.job_id) {
          return { ...j, bids: j.bids.filter(b => b.id !== payload.old.id) };
        }
        return j;
      }));
    }
  }, []);

  // Real-time subscription for jobs and bids (HYBRID: Broadcast + postgres_changes)
  useEffect(() => {
    console.log('[Realtime] Subscribing to jobs and bids with HYBRID Sync...');

    const channel = supabase.channel('job_system_hybrid_sync')
      // Broadcast listener for instant bid updates (bypasses RLS)
      .on('broadcast', { event: 'bid_updated' }, (payload) => {
        console.log('[Realtime] Broadcast bid_updated received:', payload);
        if (payload.payload) {
          handleBidChange('UPDATE', { new: payload.payload, eventType: 'UPDATE' });
        }
      })
      .on('broadcast', { event: 'bid_inserted' }, (payload) => {
        console.log('[Realtime] Broadcast bid_inserted received:', payload);
        if (payload.payload) {
          handleBidChange('INSERT', { new: payload.payload, eventType: 'INSERT' });
        }
      })
      // postgres_changes as backup (RLS-dependent)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => handleJobChange(payload.eventType, payload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids' },
        (payload) => handleBidChange(payload.eventType, payload)
      )
      .subscribe((status) => {
        console.log(`[Realtime] Hybrid Sync subscription status: ${status}`);
      });

    return () => {
      console.log('[Realtime] Cleaning up Hybrid Sync subscription');
      supabase.removeChannel(channel);
    };
  }, [handleJobChange, handleBidChange]);

  const refreshJobs = async () => {
    try {
      setLoading(true);
      const { jobs: fetchedJobs, error: fetchError } = await fetchJobs();

      if (fetchError) {
        setError(fetchError);
        console.error('Error loading jobs:', fetchError);
      } else {
        setJobs(fetchedJobs);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const addJob = async (job: Job) => {
    try {
      // Optimistically add to state
      setJobs(prev => [job, ...prev]);

      // Save to database
      const { success, error, data } = await createJobDB(job);

      if (!success || error) {
        // Rollback on error
        setJobs(prev => prev.filter(j => j.id !== job.id));
        throw new Error(error || 'Failed to create job');
      }

      // Return the real DB ID
      return data?.id;
    } catch (err) {
      console.error('Error adding job:', err);
      throw err;
    }
  };

  const updateJob = async (updatedJob: Job) => {
    try {
      // Optimistically update state
      const previousJobs = jobs;
      setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));

      // Save to database
      const { success, error } = await updateJobDB(updatedJob);

      if (!success || error) {
        // Rollback on error
        setJobs(previousJobs);
        throw new Error(error || 'Failed to update job');
      }
    } catch (err) {
      console.error('Error updating job:', err);
      throw err;
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      // Optimistically remove from state
      const previousJobs = jobs;
      setJobs(prev => prev.filter(j => j.id !== jobId));

      // Delete from database
      const { success, error } = await deleteJobDB(jobId);

      if (!success || error) {
        // Rollback on error
        setJobs(previousJobs);
        throw new Error(error || 'Failed to delete job');
      }
    } catch (err) {
      console.error('Error deleting job:', err);
      throw err;
    }
  };

  const addBid = async (bid: Bid) => {
    try {
      // Optimistically update UI
      setJobs(prev => prev.map(j => {
        if (j.id === bid.jobId) {
          return { ...j, bids: [...j.bids, bid] };
        }
        return j;
      }));

      const { success, error } = await createBidDB(bid);

      if (!success || error) {
        // Rollback
        setJobs(prev => prev.map(j => {
          if (j.id === bid.jobId) {
            return { ...j, bids: j.bids.filter(b => b.id !== bid.id) }; // This Rollback relies on ID match
            // If ID was generated by DB, we might have issues matching. 
            // But createBidDB (fixed) uses DB ID.
            // For optimistic UI, we used 'b123'. 
            // If we want perfection, we should update the ID after success.
            // For now, let's keep it simple.
          }
          return j;
        }));
        throw new Error(error || 'Failed to create bid');
      }
    } catch (err) {
      console.error('Error adding bid:', err);
      throw err;
    }
  };

  const updateBid = async (bid: Bid) => {
    try {
      // Optimistically update UI
      setJobs(prev => prev.map(j => {
        if (j.id === bid.jobId) {
          return { ...j, bids: j.bids.map(b => b.id === bid.id ? bid : b) };
        }
        return j;
      }));

      const { success, error } = await updateBidDB(bid);

      if (!success || error) {
        refreshJobs();
        throw new Error(error || 'Failed to update bid');
      }

      // BROADCAST bid update for instant sync to all clients
      try {
        const broadcastPayload = {
          id: bid.id,
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
          negotiation_history: bid.negotiationHistory,
          created_at: new Date(bid.createdAt).toISOString(),
          poster_id: bid.posterId
        };

        const channel = supabase.channel('job_system_hybrid_sync');
        await channel.subscribe();
        await channel.send({
          type: 'broadcast',
          event: 'bid_updated',
          payload: broadcastPayload
        });
        console.log('[Bid] Broadcast sent for bid update:', bid.id);
        // Don't remove channel - it's the shared sync channel
      } catch (broadcastErr) {
        console.warn('[Bid] Broadcast failed (DB update succeeded):', broadcastErr);
      }
    } catch (err) {
      console.error('Error updating bid:', err);
      throw err;
    }
  };

  return (
    <JobContext.Provider value={{ jobs, setJobs, addJob, updateJob, deleteJob, addBid, updateBid, refreshJobs, loading, error }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};
