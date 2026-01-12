import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef, useMemo } from 'react';
import { Job, Bid, JobStatus } from '../types';
import { fetchHomeFeed, fetchMyJobsFeed, fetchMyApplicationsFeed, fetchJobFullDetails, createJob as createJobDB, updateJob as updateJobDB, deleteJob as deleteJobDB, createBid as createBidDB, updateBid as updateBidDB } from '../services/jobService';
import { supabase } from '../lib/supabase';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => Promise<string | undefined>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  addBid: (bid: Bid) => Promise<string | undefined>;
  updateBid: (bid: Bid) => Promise<void>;
  refreshJobs: (userId?: string) => Promise<void>;
  fetchMoreJobs: () => Promise<void>;
  getJobWithFullDetails: (jobId: string, force?: boolean) => Promise<Job | null>; // NEW: Lazy load full details
  loadFeed: (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset?: number, userIdOverride?: string) => Promise<void>; // NEW: Optimized feeds
  clearJobs: () => void; // NEW: Clear jobs on logout
  hideJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  isRevalidating: boolean;
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
  status: (dbJob.status || 'OPEN').toString().toUpperCase() as JobStatus,
  acceptedBidId: dbJob.accepted_bid_id || undefined,
  image: dbJob.image || undefined,
  createdAt: new Date(dbJob.created_at).getTime(),
  // optimization fields
  bidCount: dbJob.bid_count,
  myBidId: dbJob.my_bid_id,
  myBidStatus: dbJob.my_bid_status,
  myBidAmount: dbJob.my_bid_amount,
  myBidLastNegotiationBy: dbJob.my_bid_last_negotiation_by,
  hasAgreement: !!dbJob.has_agreement,
});

// Convert a DB bid row to our App Bid type
const dbBidToAppBid = (dbBid: any): Bid => {
  // Gracefully handle missing dates in broadcast payloads
  const rawDate = dbBid.created_at || dbBid.createdAt;
  const timestamp = rawDate ? new Date(rawDate).getTime() : Date.now();

  return {
    id: dbBid.id,
    jobId: dbBid.job_id || dbBid.jobId,
    workerId: dbBid.worker_id || dbBid.workerId,
    workerName: dbBid.worker_name || dbBid.workerName || 'Worker',
    workerPhone: dbBid.worker_phone || dbBid.workerPhone || '',
    workerRating: Number(dbBid.worker_rating || dbBid.workerRating || 5),
    workerLocation: dbBid.worker_location || dbBid.workerLocation || '',
    workerCoordinates: (dbBid.worker_latitude && dbBid.worker_longitude) || (dbBid.workerCoordinates)
      ? {
        lat: Number(dbBid.worker_latitude || dbBid.workerCoordinates?.lat),
        lng: Number(dbBid.worker_longitude || dbBid.workerCoordinates?.lng)
      }
      : undefined,
    workerPhoto: dbBid.worker_photo || dbBid.workerPhoto || undefined,
    amount: dbBid.amount,
    message: dbBid.message,
    status: dbBid.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
    negotiationHistory: dbBid.negotiation_history || dbBid.negotiationHistory || [],
    createdAt: isNaN(timestamp) ? Date.now() : timestamp,
    posterId: dbBid.poster_id || dbBid.posterId,
  };
};

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IMPORTANT: Do NOT initialize from localStorage!
  // The auth state from Supabase should be the single source of truth.
  // Initializing from localStorage causes a race condition where queries run
  // before the Supabase client's auth session is ready.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const lastLoadAttemptRef = useRef<Record<string, number>>({});
  const lastLoadTypeRef = useRef<string>('');
  const subscribedUserIdRef = useRef<string | null>(null);

  const clearJobs = useCallback(() => {
    setJobs([]);
    setError(null);
    // Clear localStorage cache on logout
    try {
      localStorage.removeItem('chowkar_feed_cache');
    } catch (e) {
      console.warn('[JobContext] Failed to clear localStorage cache:', e);
    }
  }, []);

  // --- Surgical Sync Handlers ---
  // --- Surgical Sync Handlers ---
  const handleJobChange = useCallback((eventType: string, payload: any) => {
    console.log(`[Realtime] Surgical Job ${eventType}:`, payload.new?.id || payload.old?.id);

    const updater = (prev: Job[]) => {
      if (eventType === 'INSERT' && payload.new) {
        const newJob: Job = { ...dbJobToAppJob(payload.new), bids: [] };
        return [newJob, ...prev.filter(j => j.id !== newJob.id)];
      } else if (eventType === 'UPDATE' && payload.new) {
        return prev.map(j => {
          if (j.id === payload.new.id) {
            const converted = dbJobToAppJob(payload.new);
            return {
              ...j,
              ...converted,
              bids: j.bids,
              posterName: converted.posterName || j.posterName,
              posterPhoto: converted.posterPhoto || j.posterPhoto,
              createdAt: converted.createdAt || j.createdAt,
              bidCount: converted.bidCount ?? j.bidCount,
              myBidId: converted.myBidId || j.myBidId,
              myBidStatus: converted.myBidStatus || j.myBidStatus,
              myBidAmount: converted.myBidAmount || j.myBidAmount,
              myBidLastNegotiationBy: converted.myBidLastNegotiationBy || j.myBidLastNegotiationBy,
              // Check if I am the poster (case-insensitive for UUIDs)
              isPoster: currentUserId && j.posterId && j.posterId.toLowerCase() === currentUserId.toLowerCase()
            };
          }
          return j;
        });
      } else if (eventType === 'DELETE' && payload.old) {
        return prev.filter(j => j.id !== payload.old.id);
      }
      return prev;
    };

    setJobs(updater);
    // Update caches
    Object.keys(feedCache.current).forEach(key => {
      feedCache.current[key].jobs = updater(feedCache.current[key].jobs);
    });
  }, []);

  const handleBidChange = useCallback((eventType: string, payload: any) => {
    console.log(`[Realtime] Surgical Bid ${eventType}:`, payload.new?.id || payload.old?.id);

    const bidUpdater = (prev: Job[]) => prev.map(j => {
      if (eventType === 'INSERT' && payload.new) {
        const newBid = dbBidToAppBid(payload.new);
        if (j.id === newBid.jobId) {
          // Check if bid already exists (from optimistic update)
          const bidAlreadyExists = j.bids.some(b => b.id === newBid.id ||
            (b.workerId === newBid.workerId && b.id.toString().startsWith('b'))
          );

          const cleanBids = j.bids.filter(b =>
            !(b.workerId === newBid.workerId && b.id.toString().startsWith('b')) &&
            b.id !== newBid.id
          );
          const isMyBid = currentUserId && newBid.workerId && newBid.workerId.toLowerCase() === currentUserId.toLowerCase();
          const lastTurn = newBid.negotiationHistory?.length > 0
            ? newBid.negotiationHistory[newBid.negotiationHistory.length - 1].by
            : undefined;

          const isPoster = currentUserId && j.posterId && j.posterId.toLowerCase() === currentUserId.toLowerCase();

          return {
            ...j,
            bids: [newBid, ...cleanBids],
            // Only increment if bid didn't already exist (avoids double-count from optimistic + realtime)
            bidCount: bidAlreadyExists ? (j.bidCount || 1) : (j.bidCount || 0) + 1,
            myBidId: isMyBid ? newBid.id : j.myBidId,
            myBidStatus: isMyBid ? newBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? newBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewBid: !isMyBid && isPoster ? true : j.hasNewBid
          };
        }
      } else if (eventType === 'UPDATE' && payload.new) {
        const updatedBid = dbBidToAppBid(payload.new);
        if (j.id === updatedBid.jobId) {
          const isMyBid = currentUserId && updatedBid.workerId === currentUserId;
          const lastTurn = updatedBid.negotiationHistory?.length > 0
            ? updatedBid.negotiationHistory[updatedBid.negotiationHistory.length - 1].by
            : undefined;

          if (updatedBid.status as any === 'DELETED') {
            return {
              ...j,
              bids: j.bids.filter(b => b.id !== updatedBid.id),
              bidCount: Math.max(0, (j.bidCount || 0) - 1),
              myBidId: j.myBidId === updatedBid.id ? undefined : j.myBidId,
              myBidStatus: j.myBidId === updatedBid.id ? undefined : j.myBidStatus
            };
          }

          return {
            ...j,
            bids: j.bids.map(b => b.id === updatedBid.id ? updatedBid : b),
            myBidStatus: isMyBid ? updatedBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? updatedBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewCounter: !isMyBid && currentUserId && j.posterId && j.posterId.toLowerCase() === currentUserId.toLowerCase() ? true : j.hasNewCounter
          };
        }
      } else if (eventType === 'DELETE' && payload.old) {
        const bidId = payload.old.id;
        const targetJobId = payload.old.job_id || payload.old.jobId;

        const hasBid = j.bids.some(b => b.id === bidId);
        const wasAccepted = j.acceptedBidId === bidId;
        const isTargetJob = j.id === targetJobId;

        if (hasBid || wasAccepted || isTargetJob) {
          return {
            ...j,
            bids: j.bids.filter(b => b.id !== bidId),
            bidCount: Math.max(0, (j.bidCount || 0) - (isTargetJob || hasBid ? 1 : 0)),
            acceptedBidId: wasAccepted ? undefined : j.acceptedBidId,
            status: wasAccepted ? JobStatus.OPEN : j.status,
            // Reset myBidId if it was our bid being deleted
            myBidId: j.myBidId === bidId ? undefined : j.myBidId,
            myBidStatus: j.myBidId === bidId ? undefined : j.myBidStatus
          };
        }
      }
      return j;
    });

    setJobs(bidUpdater);
    // Sync all feed caches
    Object.keys(feedCache.current).forEach(key => {
      feedCache.current[key].jobs = bidUpdater(feedCache.current[key].jobs);
    });
  }, [currentUserId]);

  // Real-time subscription for jobs and bids (HYBRID: Broadcast + postgres_changes)
  // Only subscribe when user is logged in AND we have a valid currentUserId
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // CRITICAL: Don't subscribe if currentUserId is not set yet
    // This prevents the CHANNEL_ERROR when the effect runs before auth is ready
    if (!currentUserId) {
      console.log('[Realtime] Skipping subscription - no currentUserId yet');
      return;
    }

    console.log('[Realtime] ✅ currentUserId is set:', currentUserId, '- setting up subscription...');

    const setupRealtime = async () => {
      console.log('[Realtime] setupRealtime() called, checking session...');

      // Use cached token instead of getSession() which can hang
      const { getCachedAccessToken } = await import('../lib/supabase');
      const token = getCachedAccessToken();

      if (!token) {
        console.log('[Realtime] No cached token, skipping subscription');
        return;
      }

      console.log('[Realtime] Subscribing to jobs and bids with HYBRID Sync...');
      subscribedUserIdRef.current = currentUserId;

      channel = supabase.channel('global_sync')
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
            handleBidChange('UPDATE', { new: payload.payload });
          }
        })
        .on('broadcast', { event: 'bid_inserted' }, (payload) => {
          console.log('[Realtime] Broadcast bid_inserted received:', payload);
          if (payload.payload) {
            handleBidChange('INSERT', { new: payload.payload });
          }
        })
        .on('broadcast', { event: 'job_deleted' }, (payload) => {
          console.log('[Realtime] Broadcast job_deleted received:', payload);
          if (payload.payload) {
            handleJobChange('DELETE', { old: payload.payload });
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

  // --- IN-MEMORY FEED CACHE (No localStorage to prevent multi-user data leaks) ---
  const getEmptyCache = () => ({
    HOME: { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    POSTER: { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    WORKER_APPS: { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 }
  });

  const feedCache = useRef<Record<string, any>>(getEmptyCache());

  // CRITICAL: Clear cache when user changes to prevent data leaks between accounts
  // Using a short delay to prevent clearing during transient null states (e.g. session refreshes)
  useEffect(() => {
    if (!currentUserId) {
      const timer = setTimeout(() => {
        console.log(`[JobContext] 🔄 User is null for >500ms. Clearing cache definitively.`);
        feedCache.current = getEmptyCache();
        setJobs([]);
        setHasMore(true);
        setLoading(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      console.log(`[JobContext] 🔄 User changed to: ${currentUserId}. Keeping cache if applicable.`);
      // We don't automatically clear cache if switching between valid users 
      // because getEmptyCache() is called inside if needed, 
      // but usually this happens on login/logout.
      // If the ID changes to a DIFFERENT valid ID, we should clear.
    }
  }, [currentUserId]);

  const loadFeed = useCallback(async (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset: number = 0, userIdOverride?: string) => {
    const isInitial = offset === 0;
    const now = Date.now();
    const CACHE_EXPIRY = 120000; // 2 minutes cache validity for absolute fresh re-fetch

    try {
      // 1. Instant Cache Retrieval
      // If user is asking for page 1 (refresh or tab switch), check if we have valid cache
      if (isInitial) {
        const cached = feedCache.current[type];
        if (cached.jobs.length > 0) {
          console.log(`[JobContext] ⚡ Instant Cache Hit for ${type}. Showing ${cached.jobs.length} items.`);
          setJobs(cached.jobs);
          setHasMore(cached.hasMore);
          setCurrentFeedType(type);

          // If the cache is very fresh, skip the network call entirely to save DB load
          // ALWAYS REVALIDATE IN BACKGROUND
          // We removed the "early return" here to ensure we always fetch fresh data 
          // even if cache exists. This implements true "Stale-While-Revalidate".
          console.log(`[JobContext] 🔄 Using cache for speed, but revalidating ${type} in background...`);
          setIsRevalidating(true);

          // If cache is stale but exists, we show it (instant UI) but re-fetch in background
          console.log(`[JobContext] 🔄 Cache stale. Revalidating ${type} in background...`);
          setIsRevalidating(true);
          // We don't set global loading=true here because we already have valid items to show
        } else {
          setLoading(true);
        }
      } else {
        setIsLoadingMore(true);
      }

      // 2. Prevent concurrent duplicate fetches
      const lastTypeTime = lastLoadAttemptRef.current[type] || 0;
      if (isInitial && (now - lastTypeTime) < 2000) return; // Debounce re-fetches

      lastLoadAttemptRef.current[type] = now;
      lastLoadTypeRef.current = type;
      setCurrentFeedType(type);
      setError(null);

      // 3. Get User ID - prefer the override, then try session
      let userId = userIdOverride;

      if (!userId) {
        // Simple session check
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          userId = session.user.id;
        } else {
          console.warn('[JobContext] No user ID available. Aborting load.');
          setLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      console.log(`[JobContext] Loading ${type} feed for user: ${userId}`);

      // Note: Access token handling is now done automatically inside the service functions via safeFetch
      console.log(`[JobContext] Loading ${type} feed for user: ${userId}`);

      // 4. Execute RPC
      const resultTypeOnStart = type;
      let result: { jobs: any[]; hasMore?: boolean; error?: string };

      switch (type) {
        case 'POSTER': result = await fetchMyJobsFeed(userId, 20, offset); break;
        case 'WORKER_APPS': result = await fetchMyApplicationsFeed(userId, 20, offset); break;
        default: result = await fetchHomeFeed(userId, 20, offset); break;
      }

      console.log(`[JobContext] ✅ ${type} feed loaded: ${result.jobs.length} jobs, hasMore: ${result.hasMore}`);

      // 5. Race condition check
      if (lastLoadTypeRef.current !== resultTypeOnStart) {
        console.log(`[JobContext] ⚠️ Race condition: Expected ${resultTypeOnStart} but current is ${lastLoadTypeRef.current}. Discarding result.`);
        return;
      }

      // 6. Update State & Cache
      if (isInitial) {
        console.log(`[JobContext] Setting ${result.jobs.length} jobs to state`);
        setJobs(result.jobs);
        feedCache.current[type] = {
          jobs: result.jobs,
          hasMore: result.hasMore || false,
          offset: result.jobs.length,
          lastUpdated: Date.now()
        };
      } else {
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const uniqueNewJobs = result.jobs.filter(j => !existingIds.has(j.id));
          const merged = [...prev, ...uniqueNewJobs];

          feedCache.current[type] = {
            jobs: merged,
            offset: merged.length,
            hasMore: result.hasMore || false,
            lastUpdated: Date.now()
          };

          return merged;
        });
      }
      setHasMore(result.hasMore || false);
    } catch (err: any) {
      console.error(`[JobContext] Error loading ${type} feed:`, err);
      if (lastLoadTypeRef.current === type) {
        setError(`Failed to load ${type} feed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      if (lastLoadTypeRef.current === type) {
        setLoading(false);
        setIsRevalidating(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  const refreshJobs = useCallback(async (userIdOverride?: string) => {
    // Force cache invalidation for the current feed
    feedCache.current[currentFeedType].lastUpdated = 0;
    await loadFeed(currentFeedType, 0, userIdOverride);
  }, [loadFeed, currentFeedType]);

  // Listen for auth changes to clear state immediately on logout/switch
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id || null;

      if (event === 'SIGNED_OUT') {
        if (currentUserId !== null) {
          console.log('[JobContext] User signed out, clearing state.');
          setCurrentUserId(null);
          setJobs([]);
          feedCache.current = getEmptyCache();
        }
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (newUserId && newUserId !== currentUserId) {
          console.log(`[JobContext] Auth Event ${event}: User ${newUserId}. Refreshing jobs...`);
          setCurrentUserId(newUserId);
          setJobs([]); // Clear for fresh load
          feedCache.current = getEmptyCache();
          // The refresh will be triggered by Home.tsx's useEffect which depends on user.id
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId]);



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
    const previousJobs = jobs;
    try {
      // 1. Optimistically remove from main state
      const updater = (prev: Job[]) => prev.filter(j => j.id !== jobId);
      setJobs(updater);

      // 2. ALSO purge from internal Feed Cache immediately
      Object.keys(feedCache.current).forEach(type => {
        feedCache.current[type].jobs = updater(feedCache.current[type].jobs);
      });

      // 3. SECURE HIDE: Instead of deleting row, we record it as hidden for this user
      // This preserves data for business planning while cleaning up the user's view
      const { safeRPC } = await import('../lib/supabase');

      // Execute both hide_job and hide_chat in parallel
      const results = await Promise.all([
        safeRPC('hide_job_for_user', { p_job_id: jobId }),
        safeRPC('delete_chat', { p_job_id: jobId })
      ]);

      const error = results.find(r => r.error)?.error;
      if (error) {
        throw new Error(error.message || 'Failed to hide job/chat');
      }

      console.log(`[JobContext] ✅ Job ${jobId} and its chat hidden successfully (Data preserved in DB)`);
      return { success: true };
    } catch (err: any) {
      console.error('Error hiding job:', err);
      // Rollback main state
      setJobs(previousJobs);
      return { success: false, error: err.message || 'Failed to hide job' };
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

      const { success, error } = await updateBidDB(bid, (await supabase.auth.getSession()).data.session?.access_token);

      if (!success || error) {
        refreshJobs();
        throw new Error(error || 'Failed to update bid');
      }
    } catch (err) {
      console.error('Error updating bid:', err);
      throw err;
    }
  };

  const fetchCache = React.useRef<Map<string, number>>(new Map());
  const inFlightFetches = React.useRef<Set<string>>(new Set());

  const getJobWithFullDetails = useCallback(async (jobId: string, force = false): Promise<Job | null> => {
    const now = Date.now();
    const lastFetch = fetchCache.current.get(jobId) || 0;

    // 1. Hard throttle: Even if forced, don't fetch more than once every 2 seconds
    if (now - lastFetch < 2000) {
      console.log(`[JobContext] ⏹️ getJobWithFullDetails hard throttled for ${jobId}`);
      return jobs.find(j => j.id === jobId) || null;
    }

    // 2. Cache check: If not forced and fetched in last 30s, return cached
    if (!force && lastFetch && (now - lastFetch < 30000)) {
      const existing = jobs.find(j => j.id === jobId);
      if (existing) {
        console.log(`[JobContext] ⏹️ getJobWithFullDetails using cache for ${jobId}`);
        return existing;
      }
    }

    // Prevent duplicate in-flight requests for the same job
    if (inFlightFetches.current.has(jobId)) {
      // Wait a bit and return existing
      return jobs.find(j => j.id === jobId) || null;
    }

    try {
      inFlightFetches.current.add(jobId);

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
    } finally {
      inFlightFetches.current.delete(jobId);
    }
  }, [jobs]);

  const hideJob = async (jobId: string) => {
    try {
      // Optimistically remove from UI
      setJobs(prev => prev.filter(j => j.id !== jobId));

      // Update DB using safeRPC
      const { safeRPC } = await import('../lib/supabase');

      // Parallel hide/delete
      const results = await Promise.all([
        safeRPC('hide_job_for_user', { p_job_id: jobId }),
        safeRPC('delete_chat', { p_job_id: jobId })
      ]);

      const error = results.find(r => r.error)?.error;
      if (error) throw error;

      console.log(`[JobContext] ✅ Job ${jobId} and chat hidden`);
      return { success: true };
    } catch (err: any) {
      console.error('[JobContext] Error hiding job:', err);
      return { success: false, error: err.message || 'Failed to hide job' };
    }
  };

  // In-memory cache is automatically updated via setJobs - no need to persist to localStorage

  return (
    <JobContext.Provider value={{
      jobs, setJobs, addJob, updateJob, deleteJob, addBid, updateBid,
      refreshJobs, fetchMoreJobs, getJobWithFullDetails, loadFeed,
      clearJobs, hideJob, loading, isRevalidating, isLoadingMore, hasMore, error
    }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};
