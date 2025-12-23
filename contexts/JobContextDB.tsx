import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { Job, Bid, JobStatus } from '../types';
import { fetchJobs, fetchHomeFeed, fetchMyJobsFeed, fetchMyApplicationsFeed, fetchJobFullDetails, createJob as createJobDB, updateJob as updateJobDB, deleteJob as deleteJobDB, createBid as createBidDB, updateBid as updateBidDB, checkExpiredBidDeadlines } from '../services/jobService';
import { supabase } from '../lib/supabase';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => Promise<string | undefined>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  addBid: (bid: Bid) => Promise<string | undefined>;
  updateBid: (bid: Bid) => Promise<void>;
  refreshJobs: () => Promise<void>;
  fetchMoreJobs: () => Promise<void>;
  getJobWithFullDetails: (jobId: string, force?: boolean) => Promise<Job | null>; // NEW: Lazy load full details
  loadFeed: (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset?: number) => Promise<void>; // NEW: Optimized feeds
  clearJobs: () => void; // NEW: Clear jobs on logout
  loading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
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
  // optimization fields
  bidCount: dbJob.bid_count,
  myBidId: dbJob.my_bid_id,
  myBidStatus: dbJob.my_bid_status,
  myBidAmount: dbJob.my_bid_amount,
  myBidLastNegotiationBy: dbJob.my_bid_last_negotiation_by,
  isBoosted: dbJob.is_boosted,
  boostExpiry: dbJob.boost_expiry ? new Date(dbJob.boost_expiry).getTime() : undefined,
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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const lastLoadAttemptRef = useRef<{ type: string, time: number }>({ type: '', time: 0 });
  const subscribedUserIdRef = useRef<string | null>(null);

  const clearJobs = useCallback(() => {
    setJobs([]);
    setError(null);
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
          const converted = dbJobToAppJob(payload.new);
          // Carefully merge: don't overwrite with undefined/empty defaults from partial broadcast
          return {
            ...j,
            ...converted,
            bids: j.bids,
            posterName: converted.posterName || j.posterName,
            posterPhoto: converted.posterPhoto || j.posterPhoto,
            createdAt: converted.createdAt || j.createdAt,
            // Preserve user-specific optimization fields that aren't in broadcasts
            bidCount: converted.bidCount ?? j.bidCount,
            myBidId: converted.myBidId || j.myBidId,
            myBidStatus: converted.myBidStatus || j.myBidStatus,
            myBidAmount: converted.myBidAmount || j.myBidAmount,
            myBidLastNegotiationBy: converted.myBidLastNegotiationBy || j.myBidLastNegotiationBy,
          };
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
          // Remove optimistic bids
          const cleanBids = j.bids.filter(b =>
            !(b.workerId === newBid.workerId && b.id.toString().startsWith('b')) &&
            b.id !== newBid.id
          );

          const isMyBid = currentUserId && newBid.workerId === currentUserId;

          const lastTurn = newBid.negotiationHistory && newBid.negotiationHistory.length > 0
            ? newBid.negotiationHistory[newBid.negotiationHistory.length - 1].by
            : undefined;

          return {
            ...j,
            bids: [newBid, ...cleanBids],
            bidCount: (j.bidCount || 0) + 1,
            myBidId: isMyBid ? newBid.id : j.myBidId,
            myBidStatus: isMyBid ? newBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? newBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewBid: !isMyBid && j.posterId === currentUserId ? true : j.hasNewBid
          };
        }
        return j;
      }));
    } else if (eventType === 'UPDATE' && payload.new) {
      const updatedBid = dbBidToAppBid(payload.new);

      setJobs(prev => prev.map(j => {
        if (j.id === updatedBid.jobId) {
          const isMyBid = currentUserId && updatedBid.workerId === currentUserId;

          const lastTurn = updatedBid.negotiationHistory && updatedBid.negotiationHistory.length > 0
            ? updatedBid.negotiationHistory[updatedBid.negotiationHistory.length - 1].by
            : undefined;

          return {
            ...j,
            bids: j.bids.map(b => b.id === updatedBid.id ? updatedBid : b),
            myBidStatus: isMyBid ? updatedBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? updatedBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewCounter: !isMyBid && j.posterId === currentUserId ? true : j.hasNewCounter // Track if poster got a counter
          };
        }
        return j;
      }));
    } else if (eventType === 'DELETE' && payload.old) {
      setJobs(prev => prev.map(j => {
        // 1. Remove from bids array
        const hasBid = j.bids.some(b => b.id === payload.old.id);

        // 2. Check if this was the accepted bid
        const wasAccepted = j.acceptedBidId === payload.old.id;

        if (hasBid || wasAccepted) {
          return {
            ...j,
            bids: j.bids.filter(b => b.id !== payload.old.id),
            acceptedBidId: wasAccepted ? undefined : j.acceptedBidId,
            status: wasAccepted ? JobStatus.OPEN : j.status
          };
        }
        return j;
      }));
    }
  }, [currentUserId]);

  // Real-time subscription for jobs and bids (HYBRID: Broadcast + postgres_changes)
  // Only subscribe when user is logged in
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('[Realtime] User not logged in, skipping subscription');
        return;
      }

      console.log('[Realtime] Subscribing to jobs and bids with HYBRID Sync...');
      subscribedUserIdRef.current = currentUserId;

      channel = supabase.channel(`job_system_${currentUserId}`)
        // Broadcast listeners for instant updates (bypasses RLS)
        .on('broadcast', { event: 'job_updated' }, (payload) => {
          console.log('[Realtime] Broadcast job_updated received:', payload);
          if (payload.payload) {
            handleJobChange('UPDATE', { new: payload.payload, eventType: 'UPDATE' });
          }
        })
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
          console.log(`[Realtime] Hybrid Sync status for ${currentUserId}: ${status}`);
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            // Optional: retry logic
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        console.log('[Realtime] Cleaning up Hybrid Sync subscription for:', currentUserId);
        supabase.removeChannel(channel);
        subscribedUserIdRef.current = null;
      }
    };
  }, [currentUserId, handleJobChange, handleBidChange]);

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [currentFeedType, setCurrentFeedType] = useState<'HOME' | 'POSTER' | 'WORKER_APPS'>('HOME');

  const loadFeed = useCallback(async (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset: number = 0) => {
    const isInitial = offset === 0;
    try {
      // Prevention of duplicate concurrent loads (within 500ms for same type)
      const now = Date.now();
      if (isInitial && lastLoadAttemptRef.current.type === type && (now - lastLoadAttemptRef.current.time < 500)) {
        console.log(`[JobContext] Duplicate load skipped for ${type}`);
        return;
      }
      lastLoadAttemptRef.current = { type, time: now };

      if (isInitial) {
        setLoading(true);
        setCurrentFeedType(type);
      } else {
        setIsLoadingMore(true);
      }

      setError(null);

      // Get current user ID
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        setIsLoadingMore(false);
        return;
      }

      let result: { jobs: Job[], hasMore?: boolean };

      switch (type) {
        case 'POSTER':
          result = await fetchMyJobsFeed(userId, 20, offset);
          break;
        case 'WORKER_APPS':
          result = await fetchMyApplicationsFeed(userId, 20, offset);
          break;
        case 'HOME':
        default:
          result = await fetchHomeFeed(userId, 20, offset);
          break;
      }

      if (isInitial) {
        setJobs(result.jobs);
      } else {
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const uniqueNewJobs = result.jobs.filter(j => !existingIds.has(j.id));
          return [...prev, ...uniqueNewJobs];
        });
      }
      setHasMore(result.hasMore || false);
    } catch (err: any) {
      console.error(`[JobContext] Error loading ${type} feed:`, err);
      setError(`Failed to load ${type.toLowerCase()} feed`);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, []); // Empty deps - loadFeed doesn't depend on any changing state

  const refreshJobs = useCallback(async () => {
    // Legacy refreshJobs now delegates to loadFeed based on current type
    await loadFeed(currentFeedType, 0);
  }, [loadFeed, currentFeedType]);

  // Listen for auth changes to clear state immediately on logout/switch
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setJobs([]);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        const newUserId = session?.user?.id || null;
        if (newUserId && newUserId !== currentUserId) {
          console.log('[JobContext] User changed/session initialized, refreshing jobs...');
          setJobs([]); // Clear stale data from previous user
          setCurrentUserId(newUserId);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId, refreshJobs]);



  const fetchMoreJobs = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    await loadFeed(currentFeedType, jobs.length);
  }, [loadFeed, currentFeedType, isLoadingMore, hasMore, jobs.length]);

  const addJob = async (job: Job) => {
    const tempId = job.id; // Store temp ID
    try {
      // Optimistically add to state
      setJobs(prev => [job, ...prev]);

      // Save to database
      const { success, error, data } = await createJobDB(job);

      if (!success || error) {
        // Rollback on error
        setJobs(prev => prev.filter(j => j.id !== tempId));
        throw new Error(error || 'Failed to create job');
      }

      // Replace optimistic job with real DB ID to prevent duplicates
      if (data?.id) {
        setJobs(prev => prev.map(j =>
          j.id === tempId ? { ...j, id: data.id } : j
        ));
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
    const tempId = bid.id; // Keep track of the optimistic ID
    try {
      // Optimistically update UI
      setJobs(prev => prev.map(j => {
        if (j.id === bid.jobId) {
          return { ...j, bids: [...j.bids, bid] };
        }
        return j;
      }));

      const { success, error, data } = await createBidDB(bid);

      if (!success || error) {
        // Rollback
        setJobs(prev => prev.map(j => {
          if (j.id === bid.jobId) {
            return { ...j, bids: j.bids.filter(b => b.id !== tempId) };
          }
          return j;
        }));
        throw new Error(error || 'Failed to create bid');
      }

      // Success: Swap temp ID with real DB ID
      if (data?.id) {
        setJobs(prev => prev.map(j => {
          if (j.id === bid.jobId) {
            return {
              ...j,
              bids: j.bids.map(b => b.id === tempId ? { ...b, id: data.id } : b)
            };
          }
          return j;
        }));
      }
      return data?.id; // Return the new Bid ID
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
      } catch (broadcastErr) {
        console.warn('[Bid] Broadcast failed (DB update succeeded):', broadcastErr);
      }
    } catch (err) {
      console.error('Error updating bid:', err);
      throw err;
    }
  };

  const fetchCache = React.useRef<Map<string, number>>(new Map());

  const getJobWithFullDetails = useCallback(async (jobId: string, force = false): Promise<Job | null> => {
    const now = Date.now();
    const lastFetch = fetchCache.current.get(jobId);

    // Return current state version if fetched recently (< 10 seconds) AND not forced
    if (!force && lastFetch && (now - lastFetch < 10000)) {
      const existing = jobs.find(j => j.id === jobId);
      if (existing && existing.bids && existing.bids.length > 0) {
        console.log('[JobContext] Returning cached detailed job:', jobId);
        return existing;
      }
    }

    try {
      // 1. Fetch full details (bids, images, etc.)
      const { job: fullJob, error } = await fetchJobFullDetails(jobId);

      if (fullJob) {
        fetchCache.current.set(jobId, now);
        // Update local state with the fully loaded job
        setJobs(prev => {
          const index = prev.findIndex(j => j.id === jobId);
          if (index !== -1) {
            const newJobs = [...prev];
            newJobs[index] = fullJob;
            return newJobs;
          }
          return [fullJob, ...prev];
        });
        return fullJob;
      }

      if (error) {
        console.warn('[JobContext] Failed to load full details:', error);
      }

      return null;
    } catch (err) {
      console.error('Error fetching full job details:', err);
      return null;
    }
  }, [jobs]);

  return (
    <JobContext.Provider value={{ jobs, setJobs, addJob, updateJob, deleteJob, addBid, updateBid, refreshJobs, fetchMoreJobs, getJobWithFullDetails, loadFeed, clearJobs, loading, isLoadingMore, hasMore, error }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};
