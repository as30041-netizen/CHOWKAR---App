import React from 'react';
import { XCircle, MapPin, Star, AlertCircle, Pencil, ExternalLink, IndianRupee, UserCircle, Users, ChevronRight } from 'lucide-react';
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

        const amount = parseInt(counterAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert(language === 'en'
                ? 'Please enter a valid amount greater than ₹0'
                : 'कृपया ₹0 से अधिक वैध राशि दर्ज करें', 'error');
            return;
        }

        onReplyToCounter(job.id, myBid.id, 'COUNTER', amount);
        setShowCounterInput(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 pointer-events-auto animate-pop relative max-h-[90vh] overflow-y-auto transition-colors">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><XCircle size={24} /></button>

                {/* Job Header */}
                <div className="mb-4">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${job.status === 'OPEN' ? 'bg-green-100 text-green-700' : job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {job.status.replace('_', ' ')}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">{job.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{job.category}</p>
                </div>

                {/* Negotiation Section (for Worker) */}
                {role === UserRole.WORKER && isWorkerTurn && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5 shadow-sm">
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
                                    className="flex-1 p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 outline-none font-bold text-gray-900 dark:text-white"
                                    autoFocus
                                    min="1"
                                />
                                <button onClick={handleSubmitCounter} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm">Send</button>
                                <button onClick={() => setShowCounterInput(false)} className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg">✕</button>
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
                                    className="bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 py-2.5 rounded-xl font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                                >
                                    {t.counterOffer}
                                </button>
                                <button
                                    onClick={() => { onReplyToCounter?.(job.id, myBid!.id, 'REJECT'); onClose(); }}
                                    className="col-span-2 text-xs text-red-500 dark:text-red-400 font-bold hover:underline py-1"
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
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <IndianRupee size={16} className="text-amber-500" />
                        <span className="font-bold text-gray-900 dark:text-white">₹{job.budget}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <AlertCircle size={16} className="text-blue-500" />
                        <span>{new Date(job.jobDate).toLocaleDateString()} • {job.duration}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t.description}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{job.description}</p>
                </div>

                {/* Image */}
                {job.image && (
                    <div className="mb-4 w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img src={job.image} alt="Job" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Poster Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold overflow-hidden">
                            {job.posterPhoto ? (
                                <img src={job.posterPhoto} alt={job.posterName} className="w-full h-full object-cover" />
                            ) : (
                                job.posterName.charAt(0)
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">{job.posterName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* Map Location Preview */}
                {
                    job.coordinates && (
                        <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 h-48 relative group z-0">
                            <LeafletMap lat={job.coordinates.lat} lng={job.coordinates.lng} popupText={job.location} />

                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-2 rounded-lg shadow-md flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors z-[400]"
                            >
                                <ExternalLink size={14} /> Open Maps
                            </a>
                        </div>
                    )
                }

                {/* Bids Preview (for Poster viewing their OPEN job with bids) */}
                {
                    role === UserRole.POSTER && job.posterId === user.id && job.status === JobStatus.OPEN && job.bids.length > 0 && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <Users size={16} className="text-emerald-600" />
                                    {language === 'en' ? 'Bids Received' : 'प्राप्त बोलियां'} ({job.bids.length})
                                </h4>
                                <button
                                    onClick={() => onViewBids(job)}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline"
                                >
                                    {language === 'en' ? 'View All' : 'सभी देखें'} <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {job.bids.slice(0, 3).map(bid => (
                                    <div
                                        key={bid.id}
                                        onClick={() => onViewBids(job)}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-emerald-50 dark:hover:bg-gray-700/80 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                            {bid.workerPhoto ? (
                                                <img src={bid.workerPhoto} alt={bid.workerName} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserCircle size={40} className="text-gray-400 dark:text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{bid.workerName}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Star size={10} className="text-amber-500 fill-amber-500" />
                                                <span>{bid.workerRating?.toFixed(1) || '5.0'}</span>
                                                <span className="mx-1">•</span>
                                                <span className="text-gray-400 dark:text-gray-500">{bid.workerLocation}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{bid.amount}</p>
                                            <p className={`text-[10px] font-medium ${bid.status === 'PENDING' ? 'text-blue-500' :
                                                bid.status === 'ACCEPTED' ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'
                                                }`}>
                                                {bid.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {job.bids.length > 3 && (
                                    <button
                                        onClick={() => onViewBids(job)}
                                        className="w-full py-2 text-center text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                    >
                                        +{job.bids.length - 3} {language === 'en' ? 'more bids' : 'और बोलियां'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                }

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
                            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
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
            </div >
        </div >
    );
};
