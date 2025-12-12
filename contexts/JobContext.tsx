import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Job } from '../types';
import { MOCK_JOBS } from '../constants';

interface JobContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  addJob: (job: Job) => void;
  updateJob: (job: Job) => void;
  deleteJob: (jobId: string) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>(() => {
      if (typeof window === 'undefined') return MOCK_JOBS;
      try {
        const saved = localStorage.getItem('chowkar_jobs');
        return saved ? JSON.parse(saved) : MOCK_JOBS;
      } catch (e) {
        console.error("Error parsing jobs from localStorage", e);
        return MOCK_JOBS;
      }
  });

  useEffect(() => {
      localStorage.setItem('chowkar_jobs', JSON.stringify(jobs));
  }, [jobs]);

  const addJob = (job: Job) => setJobs(prev => [job, ...prev]);
  
  const updateJob = (updatedJob: Job) => {
      setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  };

  const deleteJob = (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  return (
    <JobContext.Provider value={{ jobs, setJobs, addJob, updateJob, deleteJob }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};