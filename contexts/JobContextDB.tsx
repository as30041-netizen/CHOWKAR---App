import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef, useMemo } from 'react';
import { Job, Bid, JobStatus } from '../types';
import { fetchHomeFeed, fetchMyJobsFeed, fetchMyApplicationsFeed, fetchJobFullDetails, createJob as createJobDB, updateJob as updateJobDB, deleteJob as deleteJobDB, createBid as createBidDB, updateBid as updateBidDB, fetchDashboardStats, saveJobTranslation as saveJobTranslationDB } from '../services/jobService';
import { supabase, waitForSupabase } from '../lib/supabase';
import { useLoading } from './LoadingContext';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => Promise<string | undefined>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  addBid: (bid: Bid) => Promise<string | undefined>;
  updateBid: (bid: Bid) => Promise<void>;
  markJobAsReviewed: (jobId: string) => void;
  refreshJobs: (type?: 'HOME' | 'POSTER' | 'WORKER_APPS', filters?: { category?: string; searchQuery?: string; feedMode?: string; sortBy?: string; minBudget?: number; maxDistance?: number; userLat?: number; userLng?: number }, userIdOverride?: string) => Promise<void>;
  fetchMoreJobs: () => Promise<void>;
  getJobWithFullDetails: (jobId: string, force?: boolean) => Promise<Job | null>; // NEW: Lazy load full details
  loadFeed: (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset?: number, userIdOverride?: string, filters?: { category?: string; searchQuery?: string; feedMode?: string; sortBy?: string; minBudget?: number; maxDistance?: number; userLat?: number; userLng?: number }) => Promise<void>; // NEW: Optimized feeds
  clearJobs: () => void; // NEW: Clear jobs on logout
  hideJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  saveJobTranslation: (jobId: string, lang: string, title: string, description: string) => Promise<boolean>;
  loading: boolean;
  isRevalidating: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  stats: {
    poster_active: number;
    poster_history: number;
    worker_active: number;
    worker_history: number;
    discover_active: number;
  };
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({ poster_active: 0, poster_history: 0, worker_active: 0, worker_history: 0, discover_active: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const currentRequestIdRef = useRef<number>(0);
  const { showLoading, hideLoading } = useLoading();

  // --- Stats Loading ---
  const loadStats = useCallback(async (userId: string) => {
    const newStats = await fetchDashboardStats(userId);
    setStats(newStats);
  }, []);

  const lastLoadAttemptRef = useRef<Record<string, number>>({});
  const lastLoadTypeRef = useRef<string>('');
  const subscribedUserIdRef = useRef<string | null>(null);
  const inFlightFetches = useRef(new Set<string>());
  const fetchCache = useRef(new Map<string, number>());
  const feedCache = useRef<Record<string, any>>({
    'HOME:RECOMMENDED': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'HOME:ALL': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'POSTER': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'WORKER_APPS': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 }
  });

  const clearJobs = useCallback(() => {
    setJobs([]);
    setError(null);
    try {
      localStorage.removeItem('chowkar_feed_cache');
    } catch (e) {
      console.warn('[JobContext] Failed to clear localStorage cache:', e);
    }
  }, []);

  // --- Surgical Sync Handlers ---
  const handleJobChange = useCallback((eventType: string, payload: any) => {
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

    // Refresh dashboard stats on job changes
    if (currentUserId) loadStats(currentUserId);
  }, [currentUserId, loadStats]);

  const handleBidChange = useCallback((eventType: string, payload: any) => {
    const bidUpdater = (prev: Job[]) => prev.map(j => {
      // Helper to check if current user is the poster of this job
      const isPoster = currentUserId && j.posterId && j.posterId.toLowerCase() === currentUserId.toLowerCase();

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

          // [REALTIME FIX] Update Action Required Count safely
          const incrementAction = isPoster && newBid.status === 'PENDING' && (!lastTurn || lastTurn === 'WORKER') ? 1 : 0;
          const newActionCount = (j.actionRequiredCount || 0) + (bidAlreadyExists ? 0 : incrementAction);

          return {
            ...j,
            bids: [newBid, ...cleanBids],
            bidCount: bidAlreadyExists ? (j.bidCount || 1) : (j.bidCount || 0) + 1,
            myBidId: isMyBid ? newBid.id : j.myBidId,
            myBidStatus: isMyBid ? newBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? newBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewBid: !isMyBid && isPoster ? true : j.hasNewBid,
            actionRequiredCount: newActionCount
          };
        }
      } else if (eventType === 'UPDATE' && payload.new) {
        const updatedBid = dbBidToAppBid(payload.new);
        if (j.id === updatedBid.jobId) {
          const isMyBid = currentUserId && updatedBid.workerId === currentUserId;
          const lastTurn = updatedBid.negotiationHistory?.length > 0
            ? updatedBid.negotiationHistory[updatedBid.negotiationHistory.length - 1].by
            : undefined;

          if ((updatedBid.status as any) === 'DELETED') {
            const wasPending = j.bids.find(b => b.id === updatedBid.id)?.status === 'PENDING';
            return {
              ...j,
              bids: j.bids.filter(b => b.id !== updatedBid.id),
              bidCount: Math.max(0, (j.bidCount || 0) - 1),
              myBidId: j.myBidId === updatedBid.id ? undefined : j.myBidId,
              myBidStatus: j.myBidId === updatedBid.id ? undefined : j.myBidStatus,
              actionRequiredCount: isPoster && wasPending ? Math.max(0, (j.actionRequiredCount || 0) - 1) : j.actionRequiredCount
            };
          }

          // [REALTIME FIX] Recalculate Action Required for Poster if bid status/negotiation changed
          // We need the OLD state to know if we should increment/decrement, but difficult without complex diffing.
          // Fallback: If we assume the payload is the source of truth, we can re-evaluate the *entire* bids array logic if we had it, but we don't.
          // Smarter Approach: Check provided `status` and `lastTurn`.
          // If this specific bid is NOW requiring action (Pending + Worker Turn), and previously wasn't (we can peek at existing j.bids), update count.

          const oldBid = j.bids.find(b => b.id === updatedBid.id);
          const wasActionable = oldBid && oldBid.status === 'PENDING' &&
            (!oldBid.negotiationHistory?.length || oldBid.negotiationHistory[oldBid.negotiationHistory.length - 1].by === 'WORKER');

          const isNowActionable = updatedBid.status === 'PENDING' &&
            (!lastTurn || lastTurn === 'WORKER');

          let actionDelta = 0;
          if (isPoster) {
            if (wasActionable && !isNowActionable) actionDelta = -1;
            if (!wasActionable && isNowActionable) actionDelta = 1;
          }

          return {
            ...j,
            bids: j.bids.map(b => b.id === updatedBid.id ? updatedBid : b),
            myBidStatus: isMyBid ? updatedBid.status : j.myBidStatus,
            myBidAmount: isMyBid ? updatedBid.amount : j.myBidAmount,
            myBidLastNegotiationBy: isMyBid ? lastTurn : j.myBidLastNegotiationBy,
            hasNewCounter: !isMyBid && isPoster && lastTurn === 'WORKER' ? true : j.hasNewCounter,
            actionRequiredCount: Math.max(0, (j.actionRequiredCount || 0) + actionDelta)
          };
        }
      } else if (eventType === 'DELETE' && payload.old) {
        const bidId = payload.old.id;
        const targetJobId = payload.old.job_id || payload.old.jobId;
        const oldBid = j.bids.find(b => b.id === bidId);

        const hasBid = !!oldBid;
        const wasAccepted = j.acceptedBidId === bidId;
        const isTargetJob = j.id === targetJobId;

        if (hasBid || wasAccepted || isTargetJob) {
          const wasActionable = oldBid && oldBid.status === 'PENDING' &&
            (!oldBid.negotiationHistory?.length || oldBid.negotiationHistory[oldBid.negotiationHistory.length - 1].by === 'WORKER');

          return {
            ...j,
            bids: j.bids.filter(b => b.id !== bidId),
            bidCount: Math.max(0, (j.bidCount || 0) - (isTargetJob || hasBid ? 1 : 0)),
            acceptedBidId: wasAccepted ? undefined : j.acceptedBidId,
            status: wasAccepted ? JobStatus.OPEN : j.status,
            myBidId: j.myBidId === bidId ? undefined : j.myBidId,
            myBidStatus: j.myBidId === bidId ? undefined : j.myBidStatus,
            actionRequiredCount: isPoster && wasActionable ? Math.max(0, (j.actionRequiredCount || 0) - 1) : j.actionRequiredCount
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

    if (currentUserId) loadStats(currentUserId);
  }, [currentUserId, loadStats]);

  // Real-time subscription for jobs and bids (HYBRID: Broadcast + postgres_changes)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (!currentUserId) {
      console.log('[Realtime] Skipping subscription - no currentUserId yet');
      return;
    }

    console.log('[Realtime] Setting up subscription for:', currentUserId);

    const setupRealtime = async () => {
      const { getCachedAccessToken } = await import('../lib/supabase');
      const token = getCachedAccessToken();

      if (!token) {
        console.log('[Realtime] No cached token, skipping subscription');
        return;
      }

      subscribedUserIdRef.current = currentUserId;

      channel = supabase.channel('global_sync')
        .on('broadcast', { event: 'job_updated' }, (payload) => {
          if (payload.payload) handleJobChange('UPDATE', { new: payload.payload });
        })
        .on('broadcast', { event: 'bid_updated' }, (payload) => {
          if (payload.payload) handleBidChange('UPDATE', { new: payload.payload });
        })
        .on('broadcast', { event: 'bid_inserted' }, (payload) => {
          if (payload.payload) handleBidChange('INSERT', { new: payload.payload });
        })
        .on('broadcast', { event: 'job_deleted' }, (payload) => {
          if (payload.payload) handleJobChange('DELETE', { old: payload.payload });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => handleJobChange(payload.eventType, payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, (payload) => handleBidChange(payload.eventType, payload))
        .subscribe((status) => {
          console.log(`[Realtime] Hybrid Sync status for ${currentUserId}: ${status}`);
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        console.log('[Realtime] Cleaning up subscription for:', currentUserId);
        supabase.removeChannel(channel);
        subscribedUserIdRef.current = null;
      }
    };
  }, [currentUserId, handleJobChange, handleBidChange]);

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentFeedType, setCurrentFeedType] = useState<'HOME' | 'POSTER' | 'WORKER_APPS'>('HOME');

  const getEmptyCache = () => ({
    'HOME:RECOMMENDED': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'HOME:ALL': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'POSTER': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 },
    'WORKER_APPS': { jobs: [], hasMore: true, offset: 0, lastUpdated: 0 }
  });

  const currentFiltersRef = useRef<{ category?: string; searchQuery?: string; feedMode?: string; sortBy?: string; minBudget?: number; maxDistance?: number; userLat?: number; userLng?: number }>({});

  const loadFeed = useCallback(async (type: 'HOME' | 'POSTER' | 'WORKER_APPS', offset: number = 0, userIdOverride?: string, filters?: { category?: string; searchQuery?: string; feedMode?: string; sortBy?: string; minBudget?: number; maxDistance?: number; userLat?: number; userLng?: number }) => {
    const isInitial = offset === 0;
    const requestId = ++currentRequestIdRef.current;
    const now = Date.now();

    if (filters) {
      currentFiltersRef.current = filters;
    }

    try {
      const feedMode = filters?.feedMode || currentFiltersRef.current.feedMode || 'RECOMMENDED';
      const cacheKey = type === 'HOME' ? `${type}:${feedMode}` : type;
      const hasActiveFilters = currentFiltersRef.current.searchQuery || (currentFiltersRef.current.category && currentFiltersRef.current.category !== 'All');

      if (isInitial && !hasActiveFilters) {
        const cached = feedCache.current[cacheKey];
        if (cached && cached.jobs.length > 0) {
          console.log(`[JobContext] ⚡ Instant Cache Hit for ${cacheKey}. Showing ${cached.jobs.length} items.`);
          setJobs(cached.jobs);
          setHasMore(cached.hasMore);
          setCurrentFeedType(type);
          setIsRevalidating(true);
        } else {
          setLoading(true);
          if (type === 'HOME') {
            showLoading(feedMode === 'RECOMMENDED' ? 'Personalizing for you...' : 'Fetching recent jobs...');
          }
        }
      } else if (isInitial && hasActiveFilters) {
        setLoading(true);
        setJobs([]);
      } else {
        setIsLoadingMore(true);
      }

      const lastTypeTime = lastLoadAttemptRef.current[cacheKey] || 0;
      if (isInitial && (now - lastTypeTime) < 500) {
        console.log(`[JobContext] ⏹️ Debouncing ${cacheKey} (Too frequent)`);
        return;
      }

      lastLoadAttemptRef.current[cacheKey] = now;
      lastLoadTypeRef.current = type;
      setCurrentFeedType(type);
      setError(null);

      let userId = userIdOverride;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) userId = session.user.id;
        else {
          setLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      if (userId && userId !== currentUserId) {
        setCurrentUserId(userId);
      }

      console.log(`[JobContext] Loading ${type} feed for user: ${userId} with filters:`, currentFiltersRef.current);

      let result: { jobs: any[]; hasMore?: boolean; error?: string };
      switch (type) {
        case 'POSTER': result = await fetchMyJobsFeed(userId, 20, offset); break;
        case 'WORKER_APPS': result = await fetchMyApplicationsFeed(userId, 20, offset); break;
        default: result = await fetchHomeFeed(userId, 20, offset, currentFiltersRef.current); break;
      }

      console.log(`[JobContext] ✅ ${type} feed loaded: ${result.jobs.length} jobs, hasMore: ${result.hasMore}`);

      // Review Sync Fallback
      try {
        const jobIds = result.jobs.map(j => j.id);
        if (jobIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('job_id')
            .eq('reviewer_id', userId)
            .in('job_id', jobIds);

          if (reviewsData && reviewsData.length > 0) {
            const reviewedSet = new Set(reviewsData.map((r: any) => r.job_id));
            result.jobs = result.jobs.map(j => ({
              ...j,
              hasMyReview: j.hasMyReview || reviewedSet.has(j.id)
            }));
          }
        }
      } catch (e) {
        console.debug('[JobContext] Review sync skipped (safe fallback)', e);
      }

      if (requestId !== currentRequestIdRef.current) {
        console.warn(`[JobContext] ⚠️ Abandonding stale result for ${type} (Request ${requestId} vs Current ${currentRequestIdRef.current})`);
        return;
      }

      if (isInitial) {
        setJobs(prev => {
          return result.jobs.map(newJob => {
            const existing = prev.find(p => p.id === newJob.id);
            if (existing) {
              return {
                ...newJob,
                posterPhone: existing.posterPhone || newJob.posterPhone,
                posterPhoto: existing.posterPhoto || newJob.posterPhoto,
                bids: (existing.bids?.length > (newJob.bids?.length || 0)) ? existing.bids : newJob.bids,
                myBidId: existing.myBidId || newJob.myBidId,
                myBidStatus: existing.myBidStatus || newJob.myBidStatus,
                hasMyReview: existing.hasMyReview || newJob.hasMyReview
              };
            }
            return newJob;
          });
        });

        if (!hasActiveFilters && feedCache.current[cacheKey]) {
          feedCache.current[cacheKey] = {
            jobs: result.jobs,
            hasMore: result.hasMore || false,
            offset: result.jobs.length,
            lastUpdated: Date.now()
          };
        }
      } else {
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const uniqueNewJobs = result.jobs.filter(j => !existingIds.has(j.id));
          return [...prev, ...uniqueNewJobs];
        });
      }
      setHasMore(result.hasMore || false);
      loadStats(userId);
    } catch (err: any) {
      console.error(`[JobContext] Error loading ${type} feed:`, err);
      if (lastLoadTypeRef.current === type) setError(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setLoading(false);
        setIsRevalidating(false);
        setIsLoadingMore(false);
        hideLoading();
      } else {
        console.log(`[JobContext] ⏹️ Cleanup skipped for Request ${requestId} (Aborted)`);
      }
    }
  }, [currentUserId, showLoading, hideLoading, loadStats]);

  const refreshJobs = useCallback(async (type?: 'HOME' | 'POSTER' | 'WORKER_APPS', filters?: { category?: string; searchQuery?: string; feedMode?: string; sortBy?: string; minBudget?: number; maxDistance?: number; userLat?: number; userLng?: number }, userIdOverride?: string) => {
    const targetType = type || currentFeedType;
    const feedMode = filters?.feedMode || currentFiltersRef.current.feedMode || 'RECOMMENDED';
    const cacheKey = targetType === 'HOME' ? `${targetType}:${feedMode}` : targetType;

    if (feedCache.current[cacheKey]) {
      feedCache.current[cacheKey].lastUpdated = 0;
    }
    await loadFeed(targetType, 0, userIdOverride, filters);
  }, [loadFeed, currentFeedType]);

  useEffect(() => {
    if (!currentUserId) {
      const timer = setTimeout(() => {
        feedCache.current = getEmptyCache();
        setJobs([]);
        setHasMore(true);
        setLoading(true);
      }, 500);
      return () => clearTimeout(timer);
    }

    const handleFocus = () => {
      if (!document.hidden && currentUserId) {
        loadFeed(currentFeedType, 0);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, [currentUserId, currentFeedType, loadFeed]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id || null;

      if (event === 'SIGNED_OUT') {
        if (currentUserId !== null) {
          setCurrentUserId(null);
          setJobs([]);
          feedCache.current = getEmptyCache();
        }
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (newUserId && newUserId !== currentUserId) {
          setCurrentUserId(newUserId);
          setJobs([]);
          feedCache.current = getEmptyCache();
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
    const tempId = job.id;
    try {
      setJobs(prev => [job, ...prev]);
      const { success, error, data } = await createJobDB(job);
      if (!success || error) {
        setJobs(prev => prev.filter(j => j.id !== tempId));
        throw new Error(error || 'Failed to create job');
      }
      if (data?.id) {
        setJobs(prev => prev.map(j => j.id === tempId ? { ...j, id: data.id } : j));
      }
      return data?.id;
    } catch (err) {
      console.error('Error adding job:', err);
      throw err;
    }
  };

  const updateJob = async (updatedJob: Job) => {
    try {
      const previousJobs = jobs;
      setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
      const { success, error } = await updateJobDB(updatedJob);
      if (!success || error) {
        setJobs(previousJobs);
        throw new Error(error || 'Failed to update job');
      }
    } catch (err) {
      console.error('Error updating job:', err);
      throw err;
    }
  };

  const markJobAsReviewed = (jobId: string) => {
    const updater = (prev: Job[]) => prev.map(j => j.id === jobId ? { ...j, hasMyReview: true } : j);
    setJobs(updater);
    Object.keys(feedCache.current).forEach(type => {
      feedCache.current[type].jobs = updater(feedCache.current[type].jobs);
    });
  };

  const deleteJob = async (jobId: string) => {
    const previousJobs = jobs;
    try {
      const updater = (prev: Job[]) => prev.filter(j => j.id !== jobId);
      setJobs(updater);
      Object.keys(feedCache.current).forEach(type => {
        feedCache.current[type].jobs = updater(feedCache.current[type].jobs);
      });

      const { safeRPC } = await import('../lib/supabase');
      const results = await Promise.all([
        safeRPC('hide_job_for_user', { p_job_id: jobId }),
        safeRPC('delete_chat', { p_job_id: jobId })
      ]);

      const error = results.find(r => r.error)?.error;
      if (error) throw new Error(error.message || 'Failed to hide job/chat');
      return { success: true };
    } catch (err: any) {
      console.error('Error hiding job:', err);
      setJobs(previousJobs);
      return { success: false, error: err.message || 'Failed to hide job' };
    }
  };

  const addBid = async (bid: Bid) => {
    const tempId = bid.id;
    try {
      setJobs(prev => prev.map(j => j.id === bid.jobId ? { ...j, bids: [...j.bids, bid] } : j));
      const { success, error, data } = await createBidDB(bid);
      if (!success || error) {
        setJobs(prev => prev.map(j => j.id === bid.jobId ? { ...j, bids: j.bids.filter(b => b.id !== tempId) } : j));
        throw new Error(error || 'Failed to create bid');
      }
      if (data?.id) {
        setJobs(prev => prev.map(j => j.id === bid.jobId ? { ...j, bids: j.bids.map(b => b.id === tempId ? { ...b, id: data.id } : b) } : j));
      }
      return data?.id;
    } catch (err) {
      console.error('Error adding bid:', err);
      throw err;
    }
  };

  const updateBid = async (bid: Bid) => {
    try {
      setJobs(prev => prev.map(j => j.id === bid.jobId ? { ...j, bids: j.bids.map(b => b.id === bid.id ? bid : b) } : j));
      const { success, error } = await updateBidDB(bid);
      if (!success || error) {
        refreshJobs();
        throw new Error(error || 'Failed to update bid');
      }
    } catch (err) {
      console.error('Error updating bid:', err);
      throw err;
    }
  };

  const getJobWithFullDetails = useCallback(async (jobId: string, force = false): Promise<Job | null> => {
    const now = Date.now();
    const lastFetch = fetchCache.current.get(jobId) || 0;

    if (now - lastFetch < 500) return jobs.find(j => j.id === jobId) || null;
    if (!force && lastFetch && (now - lastFetch < 30000)) {
      const existing = jobs.find(j => j.id === jobId);
      if (existing) return existing;
    }

    if (inFlightFetches.current.has(jobId)) return jobs.find(j => j.id === jobId) || null;

    try {
      inFlightFetches.current.add(jobId);
      const { job: fullJob } = await fetchJobFullDetails(jobId);

      if (fullJob) {
        fetchCache.current.set(jobId, now);
        const updater = (prevJobs: Job[]) => {
          const index = prevJobs.findIndex(j => j.id === jobId);
          if (index !== -1) {
            const newJobs = [...prevJobs];
            newJobs[index] = { ...newJobs[index], ...fullJob };
            return newJobs;
          }
          return [fullJob, ...prevJobs];
        };

        setJobs(updater);
        Object.keys(feedCache.current).forEach(key => {
          if (feedCache.current[key].jobs.some((j: Job) => j.id === jobId)) {
            feedCache.current[key].jobs = updater(feedCache.current[key].jobs);
          }
        });
        return fullJob;
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
      setJobs(prev => prev.filter(j => j.id !== jobId));
      const { safeRPC } = await import('../lib/supabase');
      const results = await Promise.all([
        safeRPC('hide_job_for_user', { p_job_id: jobId }),
        safeRPC('delete_chat', { p_job_id: jobId })
      ]);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
      if (currentUserId) loadStats(currentUserId);
      return { success: true };
    } catch (err: any) {
      console.error('[JobContext] Error hiding job:', err);
      return { success: false, error: err.message || 'Failed to hide job' };
    }
  };

  const saveJobTranslation = async (jobId: string, lang: string, title: string, description: string): Promise<boolean> => {
    try {
      // Optimistic Update
      const updater = (prevJobs: Job[]) => prevJobs.map(j => {
        if (j.id === jobId) {
          return {
            ...j,
            translations: {
              ...j.translations,
              [lang]: { title, description, cachedAt: Date.now() }
            }
          };
        }
        return j;
      });

      setJobs(updater);
      Object.keys(feedCache.current).forEach(type => {
        feedCache.current[type].jobs = updater(feedCache.current[type].jobs);
      });

      const success = await saveJobTranslationDB(jobId, lang, title, description);
      if (!success) {
        console.warn('[JobContext] Failed to persist translation, but keeping local cache');
        // We generally don't revert optimistic translations as they are harmless
      }
      return success;
    } catch (err) {
      console.error('[JobContext] Error saving translation:', err);
      return false;
    }
  };

  return (
    <JobContext.Provider value={{
      jobs, setJobs, addJob, updateJob, deleteJob, addBid, updateBid, markJobAsReviewed,
      refreshJobs, fetchMoreJobs, getJobWithFullDetails, loadFeed,
      clearJobs, hideJob, saveJobTranslation, loading, isRevalidating, isLoadingMore, hasMore, stats, error, searchQuery, setSearchQuery
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
