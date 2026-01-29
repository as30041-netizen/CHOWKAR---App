import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../contexts/UserContextDB';
import { Megaphone, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const AdminBroadcast: React.FC = () => {
    const { showAlert, user } = useUser();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const handleBroadcast = async () => {
        if (!title.trim() || !message.trim()) {
            showAlert('Please fill in both title and message', 'error');
            return;
        }

        if (!confirm('WARNING: You are about to send a push notification to ALL users. This cannot be undone. Are you sure?')) return;

        setIsSending(true);
        try {
            const { data, error } = await supabase.rpc('admin_broadcast_message', {
                p_title: title,
                p_message: message
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error);

            showAlert(`Broadcast sent to ${data.count || 'all'} users!`, 'success');
            setTitle('');
            setMessage('');
            setPreviewMode(false);
        } catch (err: any) {
            console.error('Broadcast Error:', err);
            showAlert('Failed to broadcast: ' + err.message, 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                            <Megaphone size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">System Broadcast</h2>
                            <p className="text-white/80 font-medium">Send alerts to the entire user base instantly.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-indigo-200 ml-2">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. System Maintenance Update"
                                className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white placeholder:text-white/40 font-bold focus:bg-white/20 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-indigo-200 ml-2">Message Body</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your announcement here..."
                                rows={4}
                                className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white placeholder:text-white/40 font-medium focus:bg-white/20 outline-none transition-all resize-none"
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={() => setPreviewMode(!previewMode)}
                                className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                            >
                                {previewMode ? 'Hide Preview' : 'Preview Message'}
                            </button>
                            <button
                                onClick={handleBroadcast}
                                disabled={isSending || !title || !message}
                                className="flex-[2] py-4 bg-white text-indigo-600 hover:scale-[1.02] active:scale-95 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-black/20 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {isSending ? 'Broadcasting...' : 'Send to All Users'} <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {previewMode && (
                <div className="bg-surface border-2 border-border p-6 rounded-[2rem] animate-scale-in max-w-md mx-auto shadow-2xl relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-text-primary text-background px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Preview
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg leading-tight">{title || 'Notification Title'}</h4>
                            <p className="text-text-secondary mt-1 text-sm">{message || 'This is how your message will appear to users.'}</p>
                            <span className="text-[10px] font-bold text-text-muted mt-2 block uppercase tracking-wide">Just Now</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400 text-xs font-medium">
                <AlertTriangle size={16} />
                <span>Note: This will trigger push notifications if configured, otherwise it creates an in-app notification.</span>
            </div>
        </div>
    );
};
