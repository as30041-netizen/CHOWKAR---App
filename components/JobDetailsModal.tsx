import React from 'react';
import { XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink } from 'lucide-react';
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
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
    job, onClose, onBid, onViewBids, onChat, onEdit, onDelete, onCancel, showAlert
}) => {
    const { user, role, t, language } = useUser();

    if (!job) return null;

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

                {/* Job Info */}
                <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={16} className="text-emerald-600" />
                        <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Star size={16} className="text-amber-500" />
                        <span>₹{job.budget} budget</span>
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

                        {/* Open in Google Maps Button */}
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
                    {role === UserRole.WORKER && job.status === JobStatus.OPEN && job.posterId !== user.id && (
                        <button
                            onClick={() => onBid(job.id)}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                            {t.bidNow}
                        </button>
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
