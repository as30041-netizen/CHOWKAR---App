import React from 'react';
import { XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee } from 'lucide-react';
import { Job, UserRole, JobStatus } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { LeafletMap } from './LeafletMap';

interface JobDetailsModalProps {
    job: Job | null;
    onClose: () => void;
    onBid: (jobId: string) => void;
    onViewBids: (job: Job) => void;
    onChat: (job: Job) => void;
    onEdit: (job: Job) => void;
    onDelete: (jobId: string) => void;
    onCancel?: (jobId: string) => void;
    onReplyToCounter?: (jobId: string, bidId: string, action: 'ACCEPT' | 'REJECT' | 'COUNTER', amount?: number) => void;
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job, onClose, onBid, onViewBids, onChat, onEdit, onDelete, onCancel, onReplyToCounter, showAlert
}) => {
    const { user, role, t, language } = useUser();
    const [showCounterInput, setShowCounterInput] = React.useState(false);
    const [counterAmount, setCounterAmount] = React.useState('');

    if (!job) return null;

    const myBid = job.bids.find(b => b.workerId === user.id);
    const lastNegotiation = myBid?.negotiationHistory?.[myBid.negotiationHistory.length - 1];
    const isWorkerTurn = lastNegotiation?.by === UserRole.POSTER && myBid?.status === 'PENDING';

    const handleSubmitCounter = () => {
        if (!myBid || !onReplyToCounter || !counterAmount) return;
        onReplyToCounter(job.id, myBid.id, 'COUNTER', parseInt(counterAmount));
        setShowCounterInput(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-pop relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>

                {/* Job Header */}
                <div className="mb-4">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${job.status === 'OPEN' ? 'bg-green-100 text-green-700' : job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {job.status.replace('_', ' ')}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 mt-2">{job.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">{job.category}</p>
                </div>

                {/* Negotiation Section (for Worker) */}
                {role === UserRole.WORKER && isWorkerTurn && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 shadow-sm">
                        <h4 className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                            {t.posterCountered}: ₹{myBid!.amount}
                        </h4>

                        {showCounterInput ? (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={counterAmount}
                                    onChange={(e) => setCounterAmount(e.target.value)}
                                    placeholder="Enter ₹"
                                    className="flex-1 p-2 rounded-lg border border-amber-300 outline-none font-bold"
                                    autoFocus
                                />
                                <button onClick={handleSubmitCounter} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm">Send</button>
                                <button onClick={() => setShowCounterInput(false)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg">✕</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { onReplyToCounter?.(job.id, myBid!.id, 'ACCEPT'); onClose(); }}
                                    className="bg-emerald-600 text-white py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all"
                                >
                                    {t.acceptCounter}
                                </button>
                                <button
                                    onClick={() => setShowCounterInput(true)}
                                    className="bg-white border border-amber-400 text-amber-700 py-2.5 rounded-xl font-bold hover:bg-amber-100 transition-all"
                                >
                                    {t.counterOffer}
                                </button>
                                <button
                                    onClick={() => { onReplyToCounter?.(job.id, myBid!.id, 'REJECT'); onClose(); }}
                                    className="col-span-2 text-xs text-red-500 font-bold hover:underline py-1"
                                >
                                    {language === 'en' ? 'Decline Counter Offer' : 'बोली अस्वीकार करें'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Job Info */}
                <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={16} className="text-emerald-600" />
                        <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <IndianRupee size={16} className="text-amber-500" />
                        <span className="font-bold text-gray-900">₹{job.budget}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <AlertCircle size={16} className="text-blue-500" />
                        <span>{new Date(job.jobDate).toLocaleDateString()} • {job.duration}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-800 mb-2">{t.description}</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.description}</p>
                </div>

                {/* Image */}
                {job.image && (
                    <div className="mb-4 w-full h-40 rounded-xl overflow-hidden border">
                        <img src={job.image} alt="Job" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Poster Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                            {job.posterPhoto ? (
                                <img src={job.posterPhoto} alt={job.posterName} className="w-full h-full object-cover" />
                            ) : (
                                job.posterName.charAt(0)
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{job.posterName}</p>
                            <p className="text-xs text-gray-500">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* Map Location Preview */}
                {job.coordinates && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 h-48 relative group z-0">
                        <LeafletMap lat={job.coordinates.lat} lng={job.coordinates.lng} popupText={job.location} />

                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg shadow-md flex items-center gap-1 hover:bg-emerald-50 transition-colors z-[400]"
                        >
                            <ExternalLink size={14} /> Open Maps
                        </a>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 flex-wrap">
                    {/* Worker: Bid button */}
                    {role === UserRole.WORKER && job.status === JobStatus.OPEN && job.posterId !== user.id && !myBid && (
                        <button
                            onClick={() => onBid(job.id)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.bidNow}
                        </button>
                    )}

                    {/* Worker: Pending Bid view if not turn */}
                    {role === UserRole.WORKER && myBid && !isWorkerTurn && job.status === JobStatus.OPEN && (
                        <div className="flex-1 text-center py-2 bg-blue-50 rounded-xl border border-blue-200">
                            <p className="text-xs font-bold text-blue-700">{t.pending}: ₹{myBid.amount}</p>
                        </div>
                    )}

                    {/* Poster: View Bids button if there are bids */}
                    {role === UserRole.POSTER && job.posterId === user.id && job.status === JobStatus.OPEN && job.bids.length > 0 && (
                        <button
                            onClick={() => onViewBids(job)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.viewBids} ({job.bids.length})
                        </button>
                    )}

                    {/* Chat button for in-progress jobs */}
                    {job.status === JobStatus.IN_PROGRESS && (
                        <button
                            onClick={() => onChat(job)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.chat}
                        </button>
                    )}

                    {/* Poster: Cancel Job (with Refund) - only if IN_PROGRESS */}
                    {job.posterId === user.id && job.status === JobStatus.IN_PROGRESS && onCancel && (
                        <button
                            onClick={() => {
                                if (confirm(language === 'en' ? 'Cancel job and refund fees?' : 'जॉब रद्द करें और रिफंड पाएं?')) {
                                    onCancel(job.id);
                                }
                            }}
                            className="flex-1 bg-gray-100 text-gray-700 border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> {language === 'en' ? 'Cancel Job' : 'रद्द करें'}
                        </button>
                    )}

                    {/* Poster: Edit button - only if OPEN and NO bids placed */}
                    {job.posterId === user.id && job.status === JobStatus.OPEN && job.bids.length === 0 && (
                        <button
                            onClick={() => onEdit(job)}
                            className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Pencil size={16} /> {language === 'en' ? 'Edit' : 'संपादित करें'}
                        </button>
                    )}

                    {/* Poster: Delete button - only if OPEN and no bid accepted */}
                    {job.posterId === user.id && job.status === JobStatus.OPEN && !job.acceptedBidId && (
                        <button
                            onClick={() => {
                                if (confirm(language === 'en' ? 'Are you sure you want to delete this job?' : 'क्या आप इस जॉब को हटाना चाहते हैं?')) {
                                    onDelete(job.id);
                                }
                            }}
                            className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> {language === 'en' ? 'Delete' : 'हटाएं'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
