import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';

import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, Coordinates, JobStatus } from '../types';
import { CATEGORIES, CATEGORY_CONFIG, FREE_AI_USAGE_LIMIT, DRAFT_STORAGE_KEY, CATEGORY_TRANSLATIONS } from '../constants';
import { uploadJobImage, isBase64Image } from '../services/storageService';
import { getDeviceLocation, reverseGeocode, forwardGeocode } from '../utils/geo';
import { enhanceJobDescriptionStream, estimateWage, analyzeImageForJob } from '../services/geminiService';
import { LeafletMap } from './LeafletMap';
import { Sparkles, MapPin, Calendar, Clock, Image as ImageIcon, IndianRupee, Loader2, X, Plus, ChevronRight, AlertCircle, Wand2, Lightbulb, Map as MapIcon, Languages, CheckCircle2, ArrowDownWideNarrow, Calculator, Mic, MicOff, Camera, Lock, ArrowLeft } from 'lucide-react';

interface JobPostingFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialJob?: Job;
}

export const JobPostingForm: React.FC<JobPostingFormProps> = ({ onSuccess, onCancel, initialJob }) => {
    const { user, t, language, checkFreeLimit, incrementAiUsage, showAlert, refreshUser } = useUser();
    const { addNotification } = useNotification();
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

    // Wizard State
    const [step, setStep] = useState(1);
    const totalSteps = 3;

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

    const nextStep = () => {
        if (validateStep(step)) {
            setStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const prevStep = () => {
        setStep(prev => Math.max(prev - 1, 1));
    };

    const validateStep = (currentStep: number) => {
        if (currentStep === 1) {
            if (!newJobTitle.trim()) { showAlert(t.jobTitleLabel + ' is required', 'error'); return false; }
            if (!newJobCategory) { showAlert(t.categoryLabel + ' is required', 'error'); return false; }
            if (!newJobDesc.trim()) { showAlert(t.descLabel + ' is required', 'error'); return false; }
            return true;
        }
        if (currentStep === 2) {
            if (!newJobDate) { showAlert(t.startDate + ' is required', 'error'); return false; }
            if (!newJobLocation.trim()) { showAlert('Location is required', 'error'); return false; }
            return true;
        }
        return true;
    };


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

        // CRITICAL: Auth Guard
        if (!user.id) {
            showAlert("You must be logged in to post a job.", 'error');
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
        if (!user.id) return;
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
        if (!user.id) return;
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

    const [searchQuery, setSearchQuery] = useState('');

    const handleMapLocationSelect = async (lat: number, lng: number) => {
        setNewJobCoords({ lat, lng });
        const address = await reverseGeocode(lat, lng);
        if (address) {
            setNewJobLocation(address);
        }
    };

    const handleAddressSearch = async () => {
        if (!searchQuery.trim()) return;
        // Search logic
        const result = await forwardGeocode(searchQuery);
        if (result) {
            setNewJobCoords({ lat: result.lat, lng: result.lng });
            setNewJobLocation(result.displayName);
        } else {
            showAlert("Location not found", "error");
        }
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
        <div className="pb-32 animate-fade-in">
            {/* Header with Progress */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                            {isEditing ? t.editJob : t.postJobHeader}
                        </h2>
                        <p className="text-xs font-bold text-gray-400 mt-1">
                            {step === 1 && "Let's start with the basics"}
                            {step === 2 && "Where and when?"}
                            {step === 3 && "Final details & Review"}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                    <div className={`h-full transition-all duration-500 ease-out bg-emerald-500 ${step >= 1 ? 'w-1/3' : 'w-0'}`} />
                    <div className={`h-full transition-all duration-500 ease-out ${step >= 2 ? 'bg-emerald-500 w-1/3' : 'bg-transparent w-1/3'}`} />
                    <div className={`h-full transition-all duration-500 ease-out ${step >= 3 ? 'bg-emerald-500 w-1/3' : 'bg-transparent w-1/3'}`} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-700">
                    <span className={step >= 1 ? 'text-emerald-600 dark:text-emerald-400' : ''}>Basics</span>
                    <span className={step >= 2 ? 'text-emerald-600 dark:text-emerald-400' : ''}>Logistics</span>
                    <span className={step >= 3 ? 'text-emerald-600 dark:text-emerald-400' : ''}>Polish</span>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative min-h-[400px]">

                {/* STEP 1: BASICS */}
                <div className={`p-6 space-y-6 transition-all duration-500 ${step === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full absolute inset-0 pointer-events-none'}`}>

                    {/* Title */}
                    <div className="group/field relative">
                        <input
                            type="text"
                            id="jobTitle"
                            placeholder=" "
                            maxLength={100}
                            className="peer w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 px-0 py-3 font-black text-xl text-gray-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-colors placeholder-transparent"
                            value={newJobTitle}
                            onChange={(e) => setNewJobTitle(e.target.value)}
                        />
                        <label htmlFor="jobTitle" className="absolute left-0 -top-3.5 text-xs font-black uppercase tracking-wider text-emerald-500 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:font-bold peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-placeholder-shown:tracking-normal peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-black peer-focus:text-emerald-500 peer-focus:tracking-wider">
                            {t.jobTitleLabel}
                        </label>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">{t.categoryLabel}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {CATEGORY_CONFIG.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = newJobCategory === cat.id;

                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setNewJobCategory(cat.id)}
                                        className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all h-24 flex flex-col justify-between group ${isSelected
                                            ? 'ring-2 ring-emerald-500 shadow-lg scale-[1.02]'
                                            : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
                                    >
                                        {/* Background Gradient */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-10 transition-opacity ${isSelected ? 'opacity-100' : 'group-hover:opacity-20'}`} />

                                        {/* Icon */}
                                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-white dark:bg-gray-700 text-gray-400'}`}>
                                            <Icon size={16} strokeWidth={2.5} />
                                        </div>

                                        {/* Label */}
                                        <span className={`relative z-10 text-xs font-black uppercase tracking-wider transition-colors ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {cat.label[language] || cat.label.en}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.descLabel}</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={toggleVoiceInput}
                                    className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                                </button>
                                <button
                                    onClick={handleEnhanceDescription}
                                    disabled={isEnhancing}
                                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${isEnhancing ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'}`}
                                >
                                    {isEnhancing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    AI Enhance
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl p-4 text-sm font-medium text-gray-900 dark:text-white outline-none min-h-[160px] resize-none transition-all"
                            value={newJobDesc}
                            onChange={(e) => setNewJobDesc(e.target.value)}
                            placeholder="Describe the task in detail..."
                        />
                    </div>
                </div>

                {/* STEP 2: LOGISTICS */}
                <div className={`p-6 space-y-8 transition-all duration-500 ${step === 2 ? 'opacity-100 translate-x-0' : step < 2 ? 'opacity-0 translate-x-full absolute inset-0 pointer-events-none' : 'opacity-0 -translate-x-full absolute inset-0 pointer-events-none'}`}>

                    {/* Date & Duration */}
                    <div className="flex gap-4">
                        <div className="flex-1 group/field relative">
                            <input
                                type="date"
                                id="jobDate"
                                min={new Date().toISOString().split('T')[0]}
                                className="peer w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 px-0 py-3 font-bold text-gray-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-colors"
                                value={newJobDate}
                                onChange={(e) => setNewJobDate(e.target.value)}
                            />
                            <label htmlFor="jobDate" className="absolute left-0 -top-3.5 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                {t.startDate}
                            </label>
                        </div>
                        <div className="flex-1 group/field relative">
                            <input
                                type="text"
                                id="jobDuration"
                                placeholder=" "
                                className="peer w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 px-0 py-3 font-bold text-gray-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-colors placeholder-transparent"
                                value={newJobDuration}
                                onChange={(e) => setNewJobDuration(e.target.value)}
                            />
                            <label htmlFor="jobDuration" className="absolute left-0 -top-3.5 text-xs font-black uppercase tracking-wider text-emerald-500 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:font-bold peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-placeholder-shown:tracking-normal peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-black peer-focus:text-emerald-500 peer-focus:tracking-wider">
                                {t.duration}
                            </label>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{t.location}</label>

                        {/* Search & Detect Buttons */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                                    placeholder={language === 'en' ? "Search area..." : "क्षेत्र खोजें..."}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                                <button onClick={handleAddressSearch} className="absolute right-2 top-2 p-1.5 bg-white dark:bg-gray-700 rounded-lg text-emerald-600 shadow-sm"><Sparkles size={16} /></button>
                            </div>
                            <button
                                onClick={() => getDeviceLocation(async (coords) => {
                                    setNewJobCoords(coords);
                                    const address = await reverseGeocode(coords.lat, coords.lng);
                                    if (address) setNewJobLocation(address);
                                    showAlert(t.locationCaptured, 'success');
                                }, () => showAlert(t.alertGeoPermission, 'error'))}
                                className="px-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs uppercase tracking-wider border border-emerald-100 flex items-center gap-2"
                            >
                                <MapPin size={16} /> Detect
                            </button>
                        </div>

                        {/* Map Preview */}
                        <div className="h-48 rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 relative z-0">
                            <LeafletMap
                                lat={newJobCoords?.lat || 20.5937}
                                lng={newJobCoords?.lng || 78.9629}
                                popupText={newJobLocation || "Set Location"}
                                editable
                                onLocationSelect={handleMapLocationSelect}
                                height="h-full"
                            />
                        </div>
                        <p className="text-xs text-gray-500 font-medium px-1 truncate">
                            <MapPin size={12} className="inline mr-1 text-emerald-500" />
                            {newJobLocation || "No location selected"}
                        </p>
                    </div>
                </div>

                {/* STEP 3: POLISH */}
                <div className={`p-6 space-y-8 transition-all duration-500 ${step === 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full absolute inset-0 pointer-events-none'}`}>

                    {/* Budget */}
                    <div className="text-center">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{t.budget} (₹)</label>
                        <div className="relative inline-block w-full max-w-[200px]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 pl-10 pr-4 text-3xl font-black text-center text-gray-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 outline-none"
                                value={newJobBudget}
                                onChange={(e) => setNewJobBudget(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={handleEstimateWage}
                                disabled={isEstimating}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-blue-100 transition-colors"
                            >
                                {isEstimating ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={14} />}
                                {isEstimating ? 'Estimating...' : 'Get AI Estimate'}
                            </button>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Add Photo (Optional)</label>

                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

                        {newJobImage ? (
                            <div className="relative h-48 rounded-2xl overflow-hidden group">
                                <img src={newJobImage} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setNewJobImage(undefined)}
                                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={triggerImageUpload}
                                className="w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-emerald-500 hover:text-emerald-500 transition-all bg-gray-50/50 dark:bg-gray-800/30"
                            >
                                <Camera size={24} />
                                <span className="text-xs font-bold uppercase tracking-wider">Tap to upload</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-[84px] left-0 right-0 p-4 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 z-[110] md:sticky md:bottom-0 md:bg-transparent md:border-none md:backdrop-blur-none transition-all duration-300">
                <div className="max-w-4xl mx-auto flex gap-4">
                    {step > 1 && (
                        <button
                            onClick={prevStep}
                            className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-[1.5rem] font-bold text-sm uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Back
                        </button>
                    )}
                    {step < 3 ? (
                        <button
                            onClick={nextStep}
                            className="flex-[2] py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            Next <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handlePostJob}
                            disabled={isPosting}
                            className={`flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isPosting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isPosting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                            {isEditing ? 'Update Job' : 'Post Job'}
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
};