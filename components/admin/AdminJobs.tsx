import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../contexts/UserContextDB';
import { Search, Trash2, ExternalLink, MapPin, Calendar, Lock } from 'lucide-react';

export const AdminJobs: React.FC = () => {
    const { showAlert, t } = useUser();
    const [jobs, setJobs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchJobs = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('jobs')
                .select('*, poster:profiles!poster_id(name, phone)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (searchQuery) {
                query = query.ilike('title', `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setJobs(data || []);
        } catch (err) {
            console.error('Fetch Jobs Error:', err);
            showAlert('Failed to fetch jobs', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchJobs();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleDeleteJob = async (jobId: string) => {
        if (!confirm('Are you sure you want to FORCE DELETE this job? This cannot be undone.')) return;

        try {
            // Admin delete bypasses RLS if using service role, but client role relies on policy.
            // We need a secure RPC for this or ensure RLS allows admins to delete.
            // Let's assume there is an RLS policy or we use a new RPC.
            // For now, try standard delete, if fails, we might need 'admin_delete_job' RPC.

            const { error } = await supabase.from('jobs').delete().eq('id', jobId);

            if (error) {
                // If RLS blocks, layout fallback RPC plan
                throw error;
            }

            setJobs(prev => prev.filter(j => j.id !== jobId));
            showAlert('Job deleted successfully', 'success');
        } catch (err: any) {
            showAlert('Failed to delete: ' + err.message, 'error');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Search Bar */}
            <div className="bg-surface border-2 border-border p-6 rounded-[2.5rem] shadow-sm">
                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={24} />
                    <input
                        type="text"
                        placeholder="Search all jobs (God Mode)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border-2 border-transparent focus:border-red-500/20 rounded-2xl pl-16 pr-6 py-5 text-lg font-bold outline-none transition-all shadow-inner placeholder:text-red-300/50"
                    />
                </div>
            </div>

            {/* Jobs Grid */}
            <div className="grid gap-4">
                {jobs.map(job => (
                    <div key={job.id} className="bg-surface p-6 rounded-[2rem] border border-border hover:border-red-500/30 transition-all group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-black text-text-primary mb-1">{job.title}</h3>
                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    <span className="flex items-center gap-1"><MapPin size={12} /> {job.location_name || 'Remote'}</span>
                                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(job.created_at).toLocaleDateString()}</span>
                                    <span className={`px-2 py-0.5 rounded-full ${job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{job.status}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-primary">₹{job.budget?.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-text-muted">{job.poster?.name}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                            {/* <button className="p-2 hover:bg-gray-100 rounded-xl text-text-secondary"><ExternalLink size={18} /></button> */}
                            <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                            >
                                <Trash2 size={16} /> Force Delete
                            </button>
                        </div>
                    </div>
                ))}
                {jobs.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-gray-400 font-medium">No jobs found matching query.</div>
                )}
            </div>
        </div>
    );
};
