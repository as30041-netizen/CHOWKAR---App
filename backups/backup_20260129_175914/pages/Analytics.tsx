import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Users, Briefcase, CheckCircle2,
    ArrowLeft, BarChart3, PieChart, Activity,
    IndianRupee, Percent, AlertCircle, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContextDB';

interface AnalyticsStats {
    total_jobs: number;
    total_completed: number;
    total_hidden: number;
    market_cap_completed: number;
    total_bids: number;
    avg_bids_per_job: number;
}

interface CategoryTrend {
    category: string;
    job_count: number;
    avg_budget: number;
    completion_rate: number;
    withdrawal_rate: number;
}

export const Analytics: React.FC = () => {
    const navigate = useNavigate();
    const { language, t } = useUser();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [trends, setTrends] = useState<CategoryTrend[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: statsData, error: statsError } = await supabase.rpc('get_market_analytics');
            const { data: trendsData, error: trendsError } = await supabase.rpc('get_category_trends');

            if (statsError) throw statsError;
            if (trendsError) throw trendsError;

            setStats(statsData[0]);
            setTrends(trendsData || []);
        } catch (err: any) {
            console.error('[Analytics] Error:', err);
            setError(err.message || 'Failed to load insights');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <div className="min-h-screen bg-background pb-24 pt-safe">
            {/* Header */}
            <div className="bg-surface/80 border-b border-border px-6 py-6 sticky top-0 z-30 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-3 rounded-2xl bg-background border border-border text-text-secondary hover:text-text-primary transition-all active:scale-95"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-text-primary tracking-tight">Market Insights</h1>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Real-time Business Intelligence</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        className={`p-3 rounded-2xl bg-primary/10 text-primary transition-all active:scale-95 ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {error && (
                    <div className="p-6 bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/30 rounded-[2rem] flex items-center gap-4 text-red-600">
                        <AlertCircle size={24} />
                        <p className="font-bold">{error}</p>
                    </div>
                )}

                {/* Overiview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Completed Value"
                        value={stats ? formatCurrency(stats.market_cap_completed) : '₹0'}
                        icon={<IndianRupee className="text-primary" />}
                        description="Total wealth generated"
                        loading={loading}
                    />
                    <StatCard
                        title="Market Velocity"
                        value={stats ? stats.total_jobs : 0}
                        icon={<Activity className="text-blue-500" />}
                        description="Total jobs posted"
                        loading={loading}
                    />
                    <StatCard
                        title="Worker Interest"
                        value={stats ? stats.total_bids : 0}
                        icon={<Users className="text-purple-500" />}
                        description="Total applications"
                        loading={loading}
                    />
                    <StatCard
                        title="Integrity Saving"
                        value={stats ? stats.total_hidden : 0}
                        icon={<CheckCircle2 className="text-orange-500" />}
                        description="Preserved hidden data points"
                        loading={loading}
                    />
                </div>

                {/* Detailed Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Category Table */}
                    <div className="card p-8 bg-surface border border-border">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <PieChart size={24} />
                            </div>
                            <h3 className="text-lg font-black text-text-primary">Category Performance</h3>
                        </div>

                        <div className="space-y-6">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : trends.map((trend, i) => (
                                <div key={i} className="group hover:bg-background p-4 -mx-4 rounded-3xl transition-all border border-transparent hover:border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-text-primary">{trend.category}</span>
                                            <span className="text-[10px] bg-background border border-border px-2 py-0.5 rounded-lg text-text-muted">{trend.job_count} posts</span>
                                        </div>
                                        <span className="text-sm font-black text-primary">{formatCurrency(trend.avg_budget)} <span className="text-[10px] text-text-muted font-medium">avg</span></span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                                <span>Completion</span>
                                                <span className="text-emerald-500">{trend.completion_rate}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${trend.completion_rate}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                                <span>Withdrawals</span>
                                                <span className="text-red-500">{trend.withdrawal_rate}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${trend.withdrawal_rate}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Tips / Insights */}
                    <div className="space-y-8">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <TrendingUp size={120} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black mb-4">Strategic Insight</h3>
                                <p className="text-blue-100 text-sm leading-relaxed font-medium mb-6">
                                    {trends[0]?.withdrawal_rate > 20
                                        ? `Warning: The ${trends[0]?.category} sector is seeing high worker withdrawal rates. Consider surveying users about pricing triggers.`
                                        : "Market health look strong. Job completion rates are balanced across your top 3 categories."}
                                </p>
                                <div className="flex gap-4">
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                                        <span className="block text-2xl font-black">{stats?.avg_bids_per_job || 0}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Avg Bids/Job</span>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                                        <span className="block text-2xl font-black">{(((stats?.total_completed || 0) / (stats?.total_jobs || 1)) * 100).toFixed(1)}%</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Fulfillment</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-8 text-white shadow-xl path-grid relative overflow-hidden">
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black mb-1">Growth Forecast</h3>
                                    <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-[0.2em]">Data Integrity Active 🛡️</p>
                                </div>
                                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <BarChart3 size={32} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; description: string; loading: boolean }> = ({ title, value, icon, description, loading }) => (
    <div className="card bg-surface border border-border p-8 hover:scale-[1.02] active:scale-95 group">
        <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center transition-transform group-hover:rotate-12">
                {icon}
            </div>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">+12%</span>
        </div>
        <div>
            {loading ? (
                <div className="h-8 w-24 bg-border rounded-lg animate-pulse mb-2" />
            ) : (
                <h3 className="text-2xl font-black text-text-primary mb-1 tracking-tight">{value}</h3>
            )}
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{title}</p>
            <p className="text-[10px] text-text-secondary font-medium leading-tight">{description}</p>
        </div>
    </div>
);

const SkeletonRow = () => (
    <div className="space-y-3 p-4 bg-background rounded-3xl animate-pulse">
        <div className="flex justify-between">
            <div className="h-4 w-32 bg-border rounded" />
            <div className="h-4 w-12 bg-border rounded" />
        </div>
        <div className="h-2 w-full bg-border rounded-full" />
    </div>
);
