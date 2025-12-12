import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Job } from '../types';
import { fetchJobs, createJob as createJobDB, updateJob as updateJobDB, deleteJob as deleteJobDB, createBid as createBidDB } from '../services/jobService';
import { supabase } from '../lib/supabase';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => Promise<void>;
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Real-time subscription for jobs
  useEffect(() => {
    const subscription = supabase
      .channel('jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          // Reload jobs on any change
          // For production, optimize this to update only affected job
          loadJobs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
          // Reload jobs when bids change
          loadJobs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadJobs = async () => {
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
      const { success, error } = await createJobDB(job);

      if (!success || error) {
        // Rollback on error
        setJobs(prev => prev.filter(j => j.id !== job.id));
        throw new Error(error || 'Failed to create job');
      }
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

  return (
    <JobContext.Provider value={{ jobs, setJobs, addJob, updateJob, deleteJob, loading, error }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};
