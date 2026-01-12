import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, JobStatus, Coordinates } from '../types';
import { CATEGORIES, CATEGORY_TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { enhanceJobDescriptionStream, estimateWage, analyzeImageForJob } from '../services/geminiService';
import { getDeviceLocation, reverseGeocode } from '../utils/geo';
import { Mic, MicOff, Sparkles, Lock, Loader2, Calculator, MapPin, ChevronRight, ArrowDownWideNarrow, Camera, X } from 'lucide-react';
import { uploadJobImage, isBase64Image } from '../services/storageService';

const DRAFT_STORAGE_KEY = 'chowkar_job_draft';

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
    const [newJobLocation, setNewJobLocation] = useState('');

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const remainingFreeTries = FREE_AI_USAGE_LIMIT - (user.aiUsageCount || 0);
    const showLockIcon = !user.isPremium && remainingFreeTries <= 0;
    const isEditing = !!initialJob;


    // Load draft from localStorage (only for new jobs)
    useEffect(() => {
        if (!isEditing) {
            const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    if (draft.title) setNewJobTitle(draft.title);
                    if (draft.description) setNewJobDesc(draft.description);
                    if (draft.budget) setNewJobBudget(draft.budget);
                    if (draft.category) setNewJobCategory(draft.category);
                    if (draft.date) setNewJobDate(draft.date);
                    if (draft.duration) setNewJobDuration(draft.duration);
                    if (draft.location) setNewJobLocation(draft.location);
                    console.log('[Draft] Loaded saved draft');
                } catch (e) {
                    console.warn('[Draft] Failed to parse saved draft');
                }
            }
        }
    }, [isEditing]);

    // Prefill location from user profile for new jobs
    useEffect(() => {
        if (!isEditing && !newJobLocation && user.location) {
            setNewJobLocation(user.location);
        }
    }, [user.location, isEditing]);

    // Save draft to localStorage (debounced)
    const saveDraft = useCallback(() => {
        if (isEditing) return; // Don't save drafts when editing
        const draft = {
            title: newJobTitle,
            description: newJobDesc,
            budget: newJobBudget,
            category: newJobCategory,
            date: newJobDate,
            duration: newJobDuration,
            location: newJobLocation,
            savedAt: Date.now()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, [newJobTitle, newJobDesc, newJobBudget, newJobCategory, newJobDate, newJobDuration, newJobLocation, isEditing]);

    // Auto-save draft when form changes
    useEffect(() => {
        const timeoutId = setTimeout(saveDraft, 1000); // Debounce 1 second
        return () => clearTimeout(timeoutId);
    }, [saveDraft]);

    // Clear draft after successful submission
    const clearDraft = () => {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    };

    // Prefill form when editing
    useEffect(() => {
        if (initialJob) {
            setNewJobTitle(initialJob.title);
            setNewJobDesc(initialJob.description);
            setNewJobBudget(initialJob.budget.toString());
            setNewJobCategory(initialJob.category);
            setNewJobDate(initialJob.jobDate);
            setNewJobDuration(initialJob.duration);
            setNewJobLocation(initialJob.location);
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
        if (!newJobLocation.trim()) missingFields.push('Location');

        if (missingFields.length > 0) {
            showAlert(`${t.alertFillFields}\n(${missingFields.join(', ')})`, 'error');
            return;
        }

        const budgetValue = parseInt(newJobBudget);
        if (isNaN(budgetValue) || budgetValue <= 0) {
            showAlert("Please enter a valid budget amount.", 'error');
            return;
        }

        setIsPosting(true);
        try {
            if (isEditing && initialJob) {
                // CHECK: Can only edit OPEN jobs
                if (initialJob.status !== 'OPEN') {
                    showAlert(
                        initialJob.status === 'IN_PROGRESS'
                            ? t.cantEditInProgress
                            : t.cantEditCompleted,
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
                    location: newJobLocation,
                    coordinates: newJobCoords || initialJob.coordinates,
                    image: newJobImage
                };

                await updateJob(updatedJob);
                showAlert(t.alertJobUpdated, 'success');

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

                // Reset form and clear draft
                setNewJobTitle(''); setNewJobDesc(''); setNewJobBudget(''); setNewJobDate(''); setNewJobDuration(''); setNewJobLocation(''); setNewJobCoords(undefined); setNewJobImage(undefined);
                clearDraft();
                onSuccess();
            } else {
                // NEW JOB: Handle image upload first if base64
                let finalImageUrl = newJobImage;
                if (newJobImage && isBase64Image(newJobImage)) {
                    setIsUploadingImage(true);
                    showAlert(t.uploadingImage, 'info');

                    const rawBase64 = newJobImage.split(',')[1];
                    const { url, error: uploadError } = await uploadJobImage(rawBase64, `job_${Date.now()}`);
                    setIsUploadingImage(false);

                    if (url) {
                        finalImageUrl = url;
                    } else {
                        console.warn('Image upload failed, continuing without image:', uploadError);
                        finalImageUrl = undefined; // Don't block job creation, just skip image
                    }
                }

                // NEW JOB: Prepare job data
                const newJob: Job = {
                    id: `j${Date.now()}`,
                    posterId: user.id,
                    posterName: user.name,
                    posterPhone: user.phone || '',
                    posterPhoto: user.profilePhoto,
                    title: newJobTitle,
                    description: newJobDesc,
                    category: newJobCategory,
                    location: newJobLocation || user.location,
                    coordinates: newJobCoords || user.coordinates,
                    jobDate: newJobDate,
                    duration: newJobDuration || 'Flexible',
                    budget: budgetValue,
                    status: JobStatus.OPEN,
                    createdAt: Date.now(),
                    bids: [],
                    image: finalImageUrl
                };

                // NEW JOB: Create job instantly - it's FREE!
                const createdJobId = await addJob(newJob);
                console.log('[JobPostingForm] Job created with ID:', createdJobId);

                if (createdJobId) {
                    // Non-critical: Try to send notification with timeout
                    try {
                        console.log('[JobPostingForm] Attempting to send notification...');
                        const notificationPromise = addNotification(user.id, "Job Posted", `"${newJobTitle}" is now live!`, "SUCCESS", createdJobId);
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Notification timeout')), 2000)
                        );
                        await Promise.race([notificationPromise, timeoutPromise]);
                        console.log('[JobPostingForm] Notification sent successfully');
                    } catch (notifError) {
                        console.warn('[JobPostingForm] Notification failed or timed out (non-critical):', notifError);
                    }
                }

                showAlert(t.alertJobPosted, 'success');

                // Reset form and clear draft
                setNewJobTitle(''); setNewJobDesc(''); setNewJobBudget(''); setNewJobDate(''); setNewJobDuration(''); setNewJobLocation(''); setNewJobCoords(undefined); setNewJobImage(undefined);
                clearDraft();

                console.log('[JobPostingForm] Calling onSuccess...');
                onSuccess();
                console.log('[JobPostingForm] onSuccess completed');
            }
        } catch (error) {
            console.error(isEditing ? "Failed to update job:" : "Failed to prepare job:", error);
            showAlert(`An error occurred while ${isEditing ? 'updating' : 'preparing'} the job. Please try again.`, 'error');
        } finally {
            console.log('[JobPostingForm] Setting isPosting to false');
            setIsPosting(false);
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
            showAlert(t.alertFillFields, 'error');
            return;
        }

        setIsEstimating(true);
        setNewJobBudget(''); // Clear for skeleton effect

        const estimatedPrice = await estimateWage(newJobTitle || newJobCategory, newJobCategory, user.location);

        setIsEstimating(false);

        if (estimatedPrice) {
            setNewJobBudget(estimatedPrice);
            incrementAiUsage();
            addNotification(user.id, "Wage Estimated", t.wageRecommended.replace('{price}', estimatedPrice), "SUCCESS");
        } else {
            showAlert(t.wageEstimateFail, 'error');
        }
    };

    const toggleVoiceInput = () => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

        if (!SpeechRecognition) {
            showAlert(t.voiceNotSupported, 'error');
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
                    showAlert(t.micBlocked, 'error');
                }
            };

            recognition.onend = () => setIsListening(false);
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsListening(false);
            showAlert(t.voiceStartFailed, 'error');
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
                <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-500 mb-6">{t.editJob}</h2>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 text-center transition-colors">
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Update the details for <strong>{initialJob?.title}</strong></p>
                    <button
                        onClick={() => setShowEditForm(true)}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all"
                    >
                        {t.editJob}
                    </button>
                    <button
                        onClick={onSuccess}
                        className="mt-3 text-gray-500 font-medium hover:text-gray-800"
                    >
                        {t.cancel}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 animate-fade-in pb-20">
            <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        {isEditing ? t.editJob : t.postJobHeader}
                    </h2>
                </div>
                {onCancel && (
                    <button onClick={onCancel} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 transition-all active:scale-90">
                        <X size={24} />
                    </button>
                )}
            </div>

            <div className="space-y-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border-4 border-white dark:border-gray-800 transition-all">


                <div className="group/field">
                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block px-2 group-focus-within/field:text-emerald-500 transition-colors">{t.jobTitleLabel}</label>
                    <input
                        type="text"
                        enterKeyHint="next"
                        placeholder="e.g. Home Cleaning Service"
                        maxLength={100}
                        className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-[1.5rem] px-6 py-4.5 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 focus:bg-white dark:focus:bg-gray-800 outline-none transition-all shadow-sm group-focus-within/field:shadow-emerald-500/5"
                        value={newJobTitle}
                        onChange={(e) => setNewJobTitle(e.target.value)}
                    />
                </div>
                <div className="group/field">
                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block px-2 group-focus-within/field:text-emerald-500 transition-colors">{t.categoryLabel}</label>
                    <div className="relative">
                        <select className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-[1.5rem] px-6 py-4.5 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 focus:bg-white dark:focus:bg-gray-800 outline-none appearance-none transition-all shadow-sm" value={newJobCategory} onChange={(e) => setNewJobCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_TRANSLATIONS[c]?.[language] || c}</option>)}</select>
                        <ArrowDownWideNarrow size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="group/field">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-focus-within/field:text-emerald-500 transition-colors">{t.descLabel}</label>
                        <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            <button
                                onClick={triggerImageUpload}
                                className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm border ${!showLockIcon
                                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/50 hover:scale-105 active:scale-95'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-100/50 dark:border-gray-800'
                                    }`}
                            >
                                {isAnalyzingImage ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                {isAnalyzingImage ? t.uploading : 'Photo'}
                                {!user.isPremium && remainingFreeTries > 0 && !isAnalyzingImage && (
                                    <span className="bg-purple-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1 font-black">AI</span>
                                )}
                            </button>
                            <button
                                onClick={toggleVoiceInput}
                                className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm border ${isListening ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 animate-pulse' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border-gray-100/50 dark:border-gray-800 hover:scale-105 active:scale-95'}`}
                            >
                                {isListening ? <MicOff size={12} /> : <Mic size={12} />} {isListening ? t.stop : 'Voice'}
                            </button>
                            <button
                                onClick={handleEnhanceDescription}
                                disabled={isEnhancing}
                                className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm border ${!showLockIcon
                                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 hover:scale-105 active:scale-95'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-100/50 dark:border-gray-800'
                                    } ${remainingFreeTries > 0 && !user.isPremium ? 'animate-pulse-slow' : ''}`}
                            >
                                {isEnhancing ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    !showLockIcon ? <Sparkles size={12} /> : <Lock size={12} />
                                )}
                                {isEnhancing ? t.enhancing : 'Magic'}
                                {!user.isPremium && remainingFreeTries > 0 && (
                                    <span className="bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1 font-black">
                                        {remainingFreeTries}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="relative group/field">
                        {newJobImage && (
                            <div className="mb-4 relative rounded-[2rem] overflow-hidden h-56 bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-800 shadow-xl">
                                <img src={newJobImage} alt="Job Preview" className="w-full h-full object-cover" />
                                {isAnalyzingImage && (
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-md">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3 animate-pulse">
                                            <Loader2 size={24} className="animate-spin" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Analyzing photo...</span>
                                    </div>
                                )}
                                <button onClick={() => setNewJobImage(undefined)} className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white p-2.5 rounded-2xl shadow-lg hover:bg-red-500 hover:text-white transition-all transform active:scale-90">
                                    <X size={20} />
                                </button>
                            </div>
                        )}
                        <textarea
                            className={`w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-[2rem] px-6 py-6 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 focus:bg-white dark:focus:bg-gray-800 outline-none h-48 resize-none transition-all shadow-sm ${isEnhancing ? 'border-emerald-400 ring-4 ring-emerald-500/10' : ''}`}
                            value={newJobDesc}
                            onChange={(e) => setNewJobDesc(e.target.value)}
                            placeholder="Describe what needs to be done..."
                        />
                    </div>
                </div>
                <div className="flex gap-6">
                    <div className="flex-1 group/field">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block px-2 group-focus-within/field:text-emerald-500 transition-colors uppercase">{t.startDate}</label>
                        <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 outline-none transition-all"
                            value={newJobDate}
                            onChange={(e) => setNewJobDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 group/field">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block px-2 group-focus-within/field:text-emerald-500 transition-colors uppercase">{t.duration}</label>
                        <input type="text" className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 outline-none transition-all" value={newJobDuration} onChange={(e) => setNewJobDuration(e.target.value)} placeholder="e.g. 2 Days" />
                    </div>
                </div>
                <div className="group/field">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-focus-within/field:text-emerald-500 transition-colors uppercase">{t.budget} (₹)</label>
                        <button
                            onClick={handleEstimateWage}
                            disabled={isEstimating}
                            className={`text-[10px] flex items-center gap-2 font-black uppercase tracking-[0.1em] px-4 py-2.5 rounded-2xl transition-all shadow-sm border ${!showLockIcon
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50 hover:bg-white dark:hover:bg-gray-800'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200'
                                }`}
                        >
                            {isEstimating ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={14} />}
                            {isEstimating ? t.estimating : 'AI Price'}
                        </button>
                    </div>
                    <div className="relative">
                        <input type="number" inputMode="numeric" className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-[1.5rem] px-6 py-5 font-black text-3xl text-emerald-600 dark:text-emerald-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-800 outline-none transition-all shadow-sm" value={newJobBudget} onChange={(e) => setNewJobBudget(e.target.value)} />
                        {isEstimating && (
                            <div className="absolute inset-x-2 inset-y-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-[1.25rem] flex items-center px-6 border-2 border-blue-200 dark:border-blue-800 animate-pulse">
                                <div className="h-4 w-24 bg-blue-100 dark:bg-blue-900/50 rounded-full" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="group/field">
                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block px-2 group-focus-within/field:text-emerald-500 transition-colors">Location</label>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="e.g. Sector 15, Noida"
                            className="w-full bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 rounded-[1.5rem] px-6 py-4.5 font-bold text-gray-900 dark:text-white focus:border-emerald-500/50 focus:bg-white dark:focus:bg-gray-800 outline-none transition-all shadow-sm group-focus-within/field:shadow-emerald-500/5"
                            value={newJobLocation}
                            onChange={(e) => setNewJobLocation(e.target.value)}
                        />
                        <button type="button" onClick={() => getDeviceLocation(async (coords) => {
                            setNewJobCoords(coords);
                            const address = await reverseGeocode(coords.lat, coords.lng);
                            if (address) setNewJobLocation(address);
                            showAlert(t.locationCaptured || "Location Captured", 'success');
                        }, () => showAlert(t.alertGeoPermission, 'error'))} className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border-2 ${newJobCoords ? 'bg-emerald-50/50 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/5' : 'bg-gray-50/50 border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-white dark:hover:bg-gray-800'}`}><MapPin size={20} className={newJobCoords ? 'animate-bounce' : ''} /> {newJobCoords ? t.locationCaptured : t.attachLocation}</button>
                    </div>
                </div>
            </div>


            <button
                type="button"
                onClick={handlePostJob}
                disabled={isPosting || isUploadingImage || isAnalyzingImage || isEstimating || isEnhancing}
                className={`btn btn-primary w-full mt-8 !py-5 !rounded-[1.5rem] shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] font-black uppercase tracking-[0.2em] transform active:scale-95 transition-all text-sm ${isPosting || isUploadingImage || isAnalyzingImage || isEstimating || isEnhancing ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-[0_25px_50px_-12px_rgba(16,185,129,0.4)]'}`}
            >
                {isPosting || isUploadingImage || isAnalyzingImage || isEstimating || isEnhancing ? (
                    <Loader2 size={24} className="animate-spin" />
                ) : (
                    <div className="flex items-center justify-center gap-3">
                        {isEditing ? t.updateJob : t.postJobBtn} <ChevronRight size={20} strokeWidth={3} />
                    </div>
                )}
            </button>
            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn btn-ghost w-full mt-2"
                >
                    {t.cancel}
                </button>
            )}

        </div>
    );
};