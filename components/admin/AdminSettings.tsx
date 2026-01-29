import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContextDB';
import { supabase } from '../../lib/supabase';
import {
    Settings, Save, RefreshCw, AlertCircle, CheckCircle2,
    Gavel, Flag, User, ShieldAlert, Clock, Search, BarChart, Briefcase, Megaphone
} from 'lucide-react';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminJobs } from './AdminJobs';
import { AdminBroadcast } from './AdminBroadcast';

interface Setting {
    key: string;
    value: string;
    description: string;
}

interface UserReport {
    id: string;
    reporter_id: string;
    reported_id: string;
    reason: string;
    description: string;
    status: string;
    created_at: string;
    reporter_name?: string;
    reported_name?: string;
}

export const AdminSettings: React.FC = () => {
    const { showAlert, t } = useUser();
    const [activeTab, setActiveTab] = useState<'analytics' | 'settings' | 'reports' | 'users' | 'jobs' | 'broadcast'>('analytics');
    const [settings, setSettings] = useState<Setting[]>([]);
    const [reports, setReports] = useState<UserReport[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'settings') {
                const { data, error } = await supabase
                    .from('global_settings')
                    .select('*');
                if (error) throw error;
                setSettings(data || []);
            } else if (activeTab === 'reports') {
                const { data, error } = await supabase
                    .from('user_reports')
                    .select(`
                        *,
                        reporter:profiles!reporter_id(name),
                        reported:profiles!reported_id(name)
                    `)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const formattedReports = (data || []).map((r: any) => ({
                    ...r,
                    reporter_name: r.reporter?.name || 'Unknown',
                    reported_name: r.reported?.name || 'Unknown'
                }));
                setReports(formattedReports);
            } else if (activeTab === 'users') {
                if (!searchQuery) {
                    setUsers([]);
                    return;
                }
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, phone, subscription_plan, subscription_expiry, wallet_balance, is_suspended')
                    .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
                    .limit(20);

                if (error) throw error;
                setUsers(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            showAlert('Failed to load data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'users' || searchQuery.length > 2) {
            fetchData();
        }
    }, [activeTab, searchQuery]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            for (const setting of settings) {
                const { error } = await supabase
                    .from('global_settings')
                    .upsert({
                        key: setting.key,
                        value: setting.value,
                        updated_at: new Date().toISOString()
                    });
                if (error) throw error;
            }
            showAlert('All settings saved successfully!', 'success');
        } catch (err) {
            console.error('Save failed:', err);
            showAlert('Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateReportStatus = async (reportId: string, status: string) => {
        try {
            const { error } = await supabase
                .from('user_reports')
                .update({ status })
                .eq('id', reportId);

            if (error) throw error;
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
            showAlert(`Report marked as ${status}`, 'success');
        } catch (err) {
            showAlert('Failed to update report', 'error');
        }
    };

    const handleUpdateUserPlan = async (userId: string, newPlan: string, durationDays = 30) => {
        try {
            // Call admin-specific subscription service for better auditing
            const { data, error } = await supabase.rpc('admin_update_user_plan', {
                p_user_id: userId,
                p_plan: newPlan,
                p_duration_days: durationDays
            });

            if (error) throw error;

            // Update local state
            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u,
                subscription_plan: newPlan,
                subscription_expiry: data.expiry || null
            } : u));

            showAlert(`Plan updated to ${newPlan}`, 'success');
        } catch (err: any) {
            console.error('Update failed:', err);
            showAlert(err.message || 'Failed to update plan', 'error');
        }
    };

    const handleToggleSuspension = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        if (newStatus && !confirm('Are you sure you want to suspend this user? They will not be able to log in.')) return;

        try {
            const { data, error } = await supabase.rpc('admin_toggle_suspension', {
                p_user_id: userId,
                p_suspended: newStatus
            });

            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: newStatus } : u));
            showAlert(newStatus ? 'User SUSPENDED' : 'User Activated', newStatus ? 'error' : 'success');
        } catch (err) {
            showAlert('Failed to toggle suspension', 'error');
        }
    };

    const handleSendWarning = async (userId: string) => {
        const message = prompt('Enter validation or warning message:');
        if (!message) return;

        try {
            const { error } = await supabase.rpc('admin_send_warning', {
                p_user_id: userId,
                p_message: message
            });

            if (error) throw error;
            showAlert('Warning sent successfully', 'success');
        } catch (err) {
            showAlert('Failed to send warning', 'error');
        }
    };

    if (isLoading && settings.length === 0 && reports.length === 0 && users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <RefreshCw className="text-primary animate-spin mb-4" size={32} />
                <p className="text-text-secondary animate-pulse">Syncing with Central Hub...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <ShieldAlert size={24} />
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter text-text-primary">Admin Console</h1>
                    </div>
                    <p className="text-text-secondary text-sm font-medium">Platform Management & Power Tools</p>
                </div>

                <div className="flex bg-surface p-1 rounded-2xl border-2 border-border shadow-sm overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Analytics
                    </button>
                    <button
                        onClick={() => setActiveTab('jobs')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'jobs' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Jobs
                    </button>
                    <button
                        onClick={() => setActiveTab('broadcast')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Broadcast
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'reports' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Reports
                        {reports.filter(r => r.status === 'PENDING').length > 0 && (
                            <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-secondary hover:bg-background'}`}
                    >
                        Users
                    </button>
                </div>
            </div>

            {activeTab === 'analytics' ? (
                <AdminAnalytics />
            ) : activeTab === 'jobs' ? (
                <AdminJobs />
            ) : activeTab === 'broadcast' ? (
                <AdminBroadcast />
            ) : activeTab === 'settings' ? (
                <>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-100 dark:border-amber-900/40 p-5 rounded-3xl mb-8 flex gap-4">
                        <div className="text-amber-500 flex-shrink-0"><AlertCircle size={24} /></div>
                        <div>
                            <p className="text-amber-900 dark:text-amber-200 text-sm font-bold mb-1">Global Variables</p>
                            <p className="text-amber-800/70 dark:text-amber-200/60 text-xs text-balance">
                                Modification of fees or pricing affects all active users instantly. Proceed with caution.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {settings.map((setting) => (
                            <div key={setting.key} className="group bg-surface border-2 border-border/50 p-6 rounded-[2.5rem] hover:border-primary/30 transition-all shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 duration-300 ${setting.key.includes('fee') ? 'bg-blue-500/10 text-blue-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                        {setting.key.includes('fee') ? <Gavel size={32} /> : <Settings size={32} />}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 px-2">{setting.key.replace(/_/g, ' ')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={setting.value}
                                                onChange={(e) => setSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s))}
                                                className="w-full bg-background border-2 border-transparent focus:border-primary/20 rounded-2xl px-6 py-4 text-2xl font-black text-text-primary outline-none transition-all"
                                            />
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-text-secondary/50 font-bold">{setting.key.includes('price') ? '₹' : ''}</div>
                                        </div>
                                        <p className="mt-3 text-xs text-text-secondary font-medium px-2">{setting.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="mt-4 w-full flex items-center justify-center gap-2 py-5 rounded-3xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw className="animate-spin" size={24} /> : <Save size={24} />}
                            {isSaving ? 'Syncing...' : 'Deploy Global Changes'}
                        </button>
                    </div>
                </>
            ) : activeTab === 'reports' ? (
                <div className="grid gap-4">
                    {reports.length === 0 ? (
                        <div className="text-center py-20 bg-surface rounded-[2.5rem] border-2 border-dashed border-border opacity-50">
                            <Flag size={48} className="mx-auto text-text-muted mb-4" />
                            <p className="font-bold">No active flags found.</p>
                        </div>
                    ) : (
                        reports.map((report) => (
                            <div key={report.id} className="bg-surface border-2 border-border/50 p-6 rounded-[2rem] hover:border-red-500/20 transition-all shadow-sm">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${report.status === 'PENDING' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                            <Flag size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-text-primary">{report.reason}</h3>
                                            <p className="text-[10px] text-text-secondary flex items-center gap-1">
                                                <Clock size={10} /> {new Date(report.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${report.status === 'PENDING' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                        {report.status}
                                    </span>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-background p-3 rounded-xl border border-border/50">
                                        <span className="text-[8px] font-black uppercase text-text-muted">Reporter</span>
                                        <p className="font-bold text-sm">{report.reporter_name}</p>
                                    </div>
                                    <div className="bg-background p-3 rounded-xl border border-border/50">
                                        <span className="text-[8px] font-black uppercase text-text-muted">Reported</span>
                                        <p className="font-bold text-sm">{report.reported_name}</p>
                                    </div>
                                </div>
                                {report.description && <p className="bg-background p-4 rounded-xl mb-6 text-sm italic">"{report.description}"</p>}
                                <div className="flex gap-2">
                                    <button onClick={() => handleUpdateReportStatus(report.id, 'REVIEWED')} className="flex-1 py-2 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold transition-all hover:bg-emerald-500/20">Review</button>
                                    <button onClick={() => handleUpdateReportStatus(report.id, 'ACTION_TAKEN')} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold transition-all hover:brightness-110">Act</button>
                                    <button onClick={() => handleUpdateReportStatus(report.id, 'DISMISSED')} className="flex-1 py-2 bg-gray-500/10 text-text-secondary rounded-lg text-xs font-bold transition-all hover:bg-gray-500/20">Dismiss</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-surface border-2 border-border p-6 rounded-[2.5rem] shadow-sm">
                        <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={24} />
                            <input
                                type="text"
                                placeholder="Search Name or Phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-background border-2 border-transparent focus:border-primary/20 rounded-2xl pl-16 pr-6 py-5 text-lg font-bold outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {users.map((u) => (
                            <div key={u.id} className="bg-surface border-2 border-border/50 p-6 rounded-[2.5rem] shadow-sm hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between gap-6 mb-6">
                                    <div className="flex items-center gap-4 text-balance">
                                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><User size={28} /></div>
                                        <div>
                                            <h3 className="text-xl font-black leading-tight">{u.name}</h3>
                                            <p className="text-sm text-text-secondary font-medium">{u.phone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1 ${u.subscription_plan === 'FREE' ? 'bg-gray-100 text-gray-500' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}>
                                            {u.subscription_plan}
                                        </div>
                                        {u.subscription_expiry && <p className="text-[10px] font-bold text-text-muted">Until {new Date(u.subscription_expiry).toLocaleDateString()}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    <button onClick={() => handleUpdateUserPlan(u.id, 'FREE')} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${u.subscription_plan === 'FREE' ? 'bg-gray-900 text-white' : 'bg-background hover:bg-gray-100'}`}>Set Free</button>
                                    <button onClick={() => handleUpdateUserPlan(u.id, 'WORKER_PLUS')} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${u.subscription_plan === 'WORKER_PLUS' ? 'bg-emerald-600 text-white' : 'bg-background text-emerald-600 hover:bg-emerald-50'}`}>Worker Plus</button>
                                    <button onClick={() => handleUpdateUserPlan(u.id, 'PRO_POSTER')} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${u.subscription_plan === 'PRO_POSTER' ? 'bg-blue-600 text-white' : 'bg-background text-blue-600 hover:bg-blue-50'}`}>Pro Poster</button>
                                    <button onClick={() => handleUpdateUserPlan(u.id, 'SUPER')} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${u.subscription_plan === 'SUPER' ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white' : 'bg-background text-emerald-600 hover:bg-emerald-50'}`}>SUPER ⭐</button>
                                    <button onClick={() => { const days = prompt('Add days:', '30'); if (days) handleUpdateUserPlan(u.id, u.subscription_plan, parseInt(days)); }} className="py-3 rounded-2xl bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase hover:bg-indigo-500/20">Extend</button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/50">
                                    <button
                                        onClick={() => handleToggleSuspension(u.id, u.is_suspended)}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${u.is_suspended ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'}`}
                                    >
                                        {u.is_suspended ? 'Unsuspend' : 'Suspend User'}
                                    </button>
                                    <button
                                        onClick={() => handleSendWarning(u.id)}
                                        className="py-3 rounded-2xl bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase hover:bg-amber-500/20"
                                    >
                                        Send Warning
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {!searchQuery && (
                        <div className="text-center py-20 bg-emerald-500/5 rounded-[2.5rem] border-2 border-dashed border-emerald-500/20 text-emerald-600/50">
                            <Search size={40} className="mx-auto mb-4" />
                            <p className="font-bold">Enter query to scan database...</p>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 size={12} /> Console Status: Secure
                </div>
            </div>
        </div>
    );
};
