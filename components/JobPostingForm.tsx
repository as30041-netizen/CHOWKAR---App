import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, JobStatus, Coordinates } from '../types';
import { CATEGORIES, CATEGORY_TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { enhanceJobDescriptionStream, estimateWage, analyzeImageForJob } from '../services/geminiService';
import { getDeviceLocation } from '../utils/geo';
import { Mic, MicOff, Sparkles, Lock, Loader2, Calculator, MapPin, ChevronRight, ArrowDownWideNarrow, Camera, X, Wallet } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { getAppConfig, deductFromWallet, checkWalletBalance } from '../services/paymentService';

interface JobPostingFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
    initialJob?: Job;
}

export const JobPostingForm: React.FC<JobPostingFormProps> = ({ onSuccess, onCancel, initialJob }) => {
    const { user, t, language, checkFreeLimit, incrementAiUsage, addNotification, showAlert, refreshUser } = useUser();
    const { addJob, updateJob } = useJobs();

    const [newJobTitle, setNewJobTitle] = useState('');
    const [newJobDesc, setNewJobDesc] = useState('');
    const [newJobBudget, setNewJobBudget] = useState('');
    const [newJobCategory, setNewJobCategory] = useState(CATEGORIES[0]);
    const [newJobDate, setNewJobDate] = useState('');
    const [newJobDuration, setNewJobDuration] = useState('');
    const [newJobCoords, setNewJobCoords] = useState<Coordinates | undefined>(undefined);
    const [newJobImage, setNewJobImage] = useState<string | undefined>(undefined);

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingJob, setPendingJob] = useState<Job | null>(null);
    const [postingFee, setPostingFee] = useState<number>(10);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const remainingFreeTries = FREE_AI_USAGE_LIMIT - (user.aiUsageCount || 0);
    const showLockIcon = !user.isPremium && remainingFreeTries <= 0;
    const isEditing = !!initialJob;

    // Load posting fee on mount
    useEffect(() => {
        getAppConfig().then(config => setPostingFee(config.job_posting_fee));
    }, []);

    // Prefill form when editing
    useEffect(() => {
        if (initialJob) {
            setNewJobTitle(initialJob.title);
            setNewJobDesc(initialJob.description);
            setNewJobBudget(initialJob.budget.toString());
            setNewJobCategory(initialJob.category);
            setNewJobDate(initialJob.jobDate);
            setNewJobDuration(initialJob.duration);
            setNewJobCoords(initialJob.coordinates);
            setNewJobImage(initialJob.image);
        }
    }, [initialJob]);

    const handlePostJob = async () => {
        // Robust validation with feedback
        const missingFields = [];
        if (!newJobTitle.trim()) missingFields.push(t.jobTitleLabel);
        if (!newJobDesc.trim()) missingFields.push(t.descLabel);
        if (!newJobDate) missingFields.push(t.startDate);
        if (!newJobBudget) missingFields.push(t.budget);

        if (missingFields.length > 0) {
            showAlert(`${t.alertFillFields}\n(${missingFields.join(', ')})`, 'error');
            return;
        }

        const budgetValue = parseInt(newJobBudget);
        if (isNaN(budgetValue) || budgetValue <= 0) {
            showAlert("Please enter a valid budget amount.", 'error');
            return;
        }

        try {
            if (isEditing && initialJob) {
                // CHECK: Can only edit OPEN jobs
                if (initialJob.status !== 'OPEN') {
                    showAlert(
                        initialJob.status === 'IN_PROGRESS'
                            ? 'Cannot edit a job that is in progress. Please contact the worker directly.'
                            : 'Cannot edit a completed or cancelled job.',
                        'error'
                    );
                    return;
                }

                // Update existing job (no payment required for editing)
                const updatedJob: Job = {
                    ...initialJob,
                    title: newJobTitle,
                    description: newJobDesc,
                    category: newJobCategory,
                    jobDate: newJobDate,
                    duration: newJobDuration || 'Flexible',
                    budget: budgetValue,
                    coordinates: newJobCoords || initialJob.coordinates,
                    image: newJobImage
                };

                await updateJob(updatedJob);
                showAlert('Job updated successfully!', 'success');

                // Notify poster
                await addNotification(user.id, 'Job Updated', `Job "${newJobTitle}" has been updated.`, "SUCCESS", initialJob.id);

                // If job has bids, notify the workers
                if (initialJob.bids && initialJob.bids.length > 0) {
                    for (const bid of initialJob.bids) {
                        if (bid.status === 'PENDING') {
                            await addNotification(
                                bid.workerId,
                                'Job Updated',
                                `The job "${newJobTitle}" you bid on has been updated. Please review the changes.`,
                                'INFO',
                                initialJob.id
                            );
                        }
                    }
                }

                // Reset form
                setNewJobTitle(''); setNewJobDesc(''); setNewJobBudget(''); setNewJobDate(''); setNewJobDuration(''); setNewJobCoords(undefined); setNewJobImage(undefined);
                onSuccess();
            } else {
                // NEW JOB: Prepare job data
                const newJob: Job = {
                    id: `j${Date.now()}`,
                    posterId: user.id,
                    posterName: user.name,
                    posterPhone: user.phone || '', // Safe fallback
                    posterPhoto: user.profilePhoto,
                    title: newJobTitle,
                    description: newJobDesc,
                    category: newJobCategory,
                    location: user.location,
                    coordinates: newJobCoords || user.coordinates,
                    jobDate: newJobDate,
                    duration: newJobDuration || 'Flexible',
                    budget: budgetValue,
                    status: JobStatus.OPEN,
                    createdAt: Date.now(),
                    bids: [],
                    image: newJobImage
                };

                // CHECK WALLET FIRST
                const { sufficient, balance } = await checkWalletBalance(user.id, postingFee);

                if (sufficient) {
                    // Deduct from wallet and create job directly
                    const { success, error: walletError } = await deductFromWallet(
                        user.id, postingFee, 'Job Posting Fee', 'JOB_POSTING'
                    );

                    if (success) {
                        // Refresh user to update wallet balance in UI
                        await refreshUser();

                        // Create job immediately
                        const createdJobId = await addJob(newJob);
                        if (createdJobId) {
                            await addNotification(user.id, "Job Posted", `"${newJobTitle}" is now live!`, "SUCCESS", createdJobId);
                        }
                        showAlert(language === 'en'
                            ? `Job posted! ₹${postingFee} deducted from wallet.`
                            : `जॉब पोस्ट हुई! वॉलेट से ₹${postingFee} काटे गए।`, 'success');

                        // Reset form
                        setNewJobTitle(''); setNewJobDesc(''); setNewJobBudget(''); setNewJobDate(''); setNewJobDuration(''); setNewJobCoords(undefined); setNewJobImage(undefined);
                        onSuccess();
                        return; // IMPORTANT: Stop here
                    } else {
                        // Wallet deduction failed - show Razorpay instead
                        console.log('Wallet deduction failed, falling back to Razorpay:', walletError);
                        setPendingJob(newJob);
                        setShowPaymentModal(true);
                        return; // IMPORTANT: Stop here
                    }
                } else {
                    // Wallet insufficient - show payment modal for Razorpay
                    setPendingJob(newJob);
                    setShowPaymentModal(true);
                }
            }
        } catch (error) {
            console.error(isEditing ? "Failed to update job:" : "Failed to prepare job:", error);
            showAlert(`An error occurred while ${isEditing ? 'updating' : 'preparing'} the job. Please try again.`, 'error');
        }
    };

    // Called after payment is successful
    const handlePaymentSuccess = async (paymentId: string) => {
        if (!pendingJob) return;

        try {
            // Create the job now that payment is confirmed
            const createdJobId = await addJob({
                ...pendingJob,
                // @ts-ignore - payment_id will be stored in DB
                payment_id: paymentId
            });

            if (createdJobId) {
                await addNotification(user.id, "Job Posted", `"${pendingJob.title}" is now live!`, "SUCCESS", createdJobId);
            }
            showAlert('Job posted successfully!', 'success');

            // Reset form
            setNewJobTitle(''); setNewJobDesc(''); setNewJobBudget(''); setNewJobDate(''); setNewJobDuration(''); setNewJobCoords(undefined); setNewJobImage(undefined);
            setPendingJob(null);
            onSuccess();
        } catch (error) {
            console.error("Failed to post job after payment:", error);
            showAlert('Payment successful but failed to create job. Please contact support.', 'error');
        }
    };

    const handleEnhanceDescription = async () => {
        if (!checkFreeLimit()) return;
        if (!newJobDesc.trim()) return;

        setIsEnhancing(true);
        // Use streaming service
        await enhanceJobDescriptionStream(newJobDesc, newJobCategory, language, (text) => {
            setNewJobDesc(text);
        });

        setIsEnhancing(false);
        incrementAiUsage();
    };

    const handleEstimateWage = async () => {
        if (!checkFreeLimit()) return;
        if (!newJobCategory || !user.location) {
            showAlert("Please check your profile location and category.", 'error');
            return;
        }

        setIsEstimating(true);
        setNewJobBudget(''); // Clear for skeleton effect

        const estimatedPrice = await estimateWage(newJobTitle || newJobCategory, newJobCategory, user.location);

        setIsEstimating(false);

        if (estimatedPrice) {
            setNewJobBudget(estimatedPrice);
            incrementAiUsage();
            addNotification(user.id, "Wage Estimated", `Recommended: ₹${estimatedPrice}`, "SUCCESS");
        } else {
            showAlert("Could not estimate wage at this time.", 'error');
        }
    };

    const toggleVoiceInput = () => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

        if (!SpeechRecognition) {
            showAlert("Voice input is not supported in this browser. Please use Google Chrome or Edge.", 'error');
            return;
        }

        if (isListening) {
            setIsListening(false);
            try { (window as any).recognition?.stop(); } catch (e) { console.error(e); }
            return;
        }

        setIsListening(true);
        try {
            const recognition = new SpeechRecognition();
            (window as any).recognition = recognition;

            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setNewJobDesc(prev => prev ? `${prev} ${text}` : text);
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error("Voice Error:", event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    showAlert("Microphone access blocked.", 'error');
                }
            };

            recognition.onend = () => setIsListening(false);
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsListening(false);
            showAlert("Failed to start voice input.", 'error');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!checkFreeLimit()) return;

        // Optimized Image Loading: Resize before setting in state
        const reader = new FileReader();
        reader.onloadend = async () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Use JPEG for better compression than the original high-res capture
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setNewJobImage(compressedBase64);

                setIsAnalyzingImage(true);
                try {
                    const rawBase64 = compressedBase64.split(',')[1];
                    const result = await analyzeImageForJob(rawBase64, 'image/jpeg', language);

                    if (result) {
                        if (result.description && !newJobDesc.trim()) setNewJobDesc(result.description);
                        if (result.category && CATEGORIES.includes(result.category)) {
                            setNewJobCategory(result.category);
                        }
                        incrementAiUsage();
                        addNotification(user.id, "Photo Analyzed", "Details updated based on your photo.", "SUCCESS");
                    }
                } catch (error) {
                    console.error("AI Analysis Error:", error);
                } finally {
                    setIsAnalyzingImage(false);
                }
            };
        };
        reader.readAsDataURL(file);
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    const [showEditForm, setShowEditForm] = useState(false);

    if (isEditing && !showEditForm) {
        return (
            <div className="p-4 animate-fade-in pb-10">
                <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-500 mb-6">{language === 'en' ? 'Edit Job' : 'नौकरी संपादित करें'}</h2>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 text-center transition-colors">
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Update the details for <strong>{initialJob?.title}</strong></p>
                    <button
                        onClick={() => setShowEditForm(true)}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all"
                    >
                        {language === 'en' ? 'Start Editing' : 'संपादन शुरू करें'}
                    </button>
                    <button
                        onClick={onSuccess}
                        className="mt-3 text-gray-500 font-medium hover:text-gray-800"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 animate-fade-in pb-10">
            <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-500 mb-6">
                {isEditing ? (language === 'en' ? 'Edit Job Details' : 'नौकरी विवरण संपादित करें') : t.postJobHeader}
            </h2>
            <div className="space-y-5 bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.jobTitleLabel}</label><input type="text" enterKeyHint="next" className="w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors" value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} /></div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.categoryLabel}</label>
                    <div className="relative">
                        <select className="w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 outline-none font-medium transition-colors" value={newJobCategory} onChange={(e) => setNewJobCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_TRANSLATIONS[c]?.[language] || c}</option>)}</select>
                        <ArrowDownWideNarrow size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{t.descLabel}</label>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            <button
                                onClick={triggerImageUpload}
                                className={`text-xs flex items-center gap-1 font-bold px-2 py-1 rounded-lg transition-colors border ${!showLockIcon
                                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                {isAnalyzingImage ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                {isAnalyzingImage ? "Analyzing..." : "Add Photo"}
                                {!user.isPremium && remainingFreeTries > 0 && !isAnalyzingImage && (
                                    <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 shadow-sm font-extrabold">AI</span>
                                )}
                            </button>
                            <button onClick={toggleVoiceInput} className={`text-xs flex items-center gap-1 font-bold px-2 py-1 rounded-lg transition-colors ${isListening ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                {isListening ? <MicOff size={12} /> : <Mic size={12} />} {isListening ? 'Stop' : 'Voice'}
                            </button>
                            <button
                                onClick={handleEnhanceDescription}
                                disabled={isEnhancing}
                                className={`text-xs flex items-center gap-1 font-bold px-2 py-1 rounded-lg transition-all border ${!showLockIcon
                                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:shadow-sm'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                    } ${remainingFreeTries > 0 && !user.isPremium ? 'animate-pulse-slow' : ''}`}
                            >
                                {isEnhancing ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    !showLockIcon ? <Sparkles size={12} /> : <Lock size={12} />
                                )}
                                {isEnhancing ? 'Enhancing...' : t.aiEnhance}
                                {!user.isPremium && remainingFreeTries > 0 && (
                                    <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 shadow-sm font-extrabold">
                                        {remainingFreeTries} Left
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        {newJobImage && (
                            <div className="mb-2 relative rounded-xl overflow-hidden h-40 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <img src={newJobImage} alt="Job Preview" className="w-full h-full object-cover" />
                                {isAnalyzingImage && (
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                                        <Loader2 size={24} className="animate-spin mb-2" />
                                        <span className="text-xs font-bold">Analyzing photo...</span>
                                    </div>
                                )}
                                <button onClick={() => setNewJobImage(undefined)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        <textarea
                            className={`w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 h-32 outline-none resize-none placeholder-gray-400 dark:placeholder-gray-500 transition-all ${isEnhancing ? 'border-emerald-300 ring-2 ring-emerald-100 dark:ring-emerald-900/30' : ''}`}
                            value={newJobDesc}
                            onChange={(e) => setNewJobDesc(e.target.value)}
                        />
                        {isEnhancing && (
                            <div className="absolute bottom-2 right-2 flex gap-1">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-200"></span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.startDate}</label>
                        <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            value={newJobDate}
                            onChange={(e) => setNewJobDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.duration}</label><input type="text" className="w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 outline-none font-medium placeholder-gray-400 dark:placeholder-gray-500 transition-colors" value={newJobDuration} onChange={(e) => setNewJobDuration(e.target.value)} placeholder="e.g. 2 Days" /></div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{t.budget} (₹)</label>
                        <button
                            onClick={handleEstimateWage}
                            disabled={isEstimating}
                            className={`text-[10px] flex items-center gap-1 font-bold px-2 py-1 rounded-lg transition-all border ${!showLockIcon
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            {isEstimating ? (
                                <Loader2 size={10} className="animate-spin" />
                            ) : (
                                !showLockIcon ? <Calculator size={10} /> : <Lock size={10} />
                            )}
                            {isEstimating ? t.estimating : t.aiEstimate}
                            {!user.isPremium && remainingFreeTries > 0 && (
                                <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 shadow-sm font-extrabold">
                                    {remainingFreeTries} Left
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="relative">
                        <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full appearance-none bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 outline-none font-bold placeholder-gray-400 dark:placeholder-gray-500 transition-colors" value={newJobBudget} onChange={(e) => setNewJobBudget(e.target.value)} />
                        {isEstimating && (
                            <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-xl flex items-center px-3 border border-blue-200 dark:border-blue-800">
                                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                            </div>
                        )}
                    </div>
                </div>
                <button type="button" onClick={() => getDeviceLocation(setNewJobCoords, () => showAlert(t.alertGeoPermission, 'error'))} className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition-colors ${newJobCoords ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}><MapPin size={18} /> {newJobCoords ? t.locationCaptured : t.attachLocation}</button>
            </div>

            <button
                type="button"
                onClick={handlePostJob}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all mt-4 relative z-10"
            >
                {isEditing
                    ? (language === 'en' ? 'Update Job' : 'नौकरी अपडेट करें')
                    : (language === 'en' ? `Post Job (₹${postingFee})` : `नौकरी पोस्ट करें (₹${postingFee})`)
                } <ChevronRight size={20} />
            </button>
            {!isEditing && (user.walletBalance || 0) >= postingFee && (
                <p className="text-center text-sm text-emerald-600 mt-2 flex items-center justify-center gap-1">
                    <Wallet size={14} />
                    {language === 'en'
                        ? `Will use ₹${postingFee} from wallet (Balance: ₹${user.walletBalance})`
                        : `वॉलेट से ₹${postingFee} का उपयोग होगा (शेष: ₹${user.walletBalance})`}
                </p>
            )}
            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-full mt-3 text-gray-500 font-bold py-3 hover:text-gray-800 transition-colors"
                >
                    {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </button>
            )}

            {/* Payment Modal for new job posting */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => {
                    setShowPaymentModal(false);
                    setPendingJob(null);
                }}
                paymentType="JOB_POSTING"
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentFailure={(error) => {
                    showAlert(error || 'Payment failed', 'error');
                }}
            />
        </div>
    );
};