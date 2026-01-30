import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';

import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, Coordinates, JobStatus } from '../types';
import { CATEGORIES, CATEGORY_CONFIG, FREE_AI_USAGE_LIMIT, DRAFT_STORAGE_KEY, CATEGORY_TRANSLATIONS } from '../constants';
import { uploadJobImage, isBase64Image } from '../services/storageService';
import { getDeviceLocation, reverseGeocode, forwardGeocode, searchPlaces } from '../utils/geo';
import { enhanceJobDescriptionStream, estimateWage, analyzeImageForJob } from '../services/geminiService';
import { LeafletMap } from './LeafletMap';
import VoiceAssistantOverlay from './VoiceAssistantOverlay';
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
    const { showLoading, hideLoading } = useLoading();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const remainingFreeTries = FREE_AI_USAGE_LIMIT - (user.aiUsageCount || 0);
    const showLockIcon = !user.isPremium && remainingFreeTries <= 0;
    const isEditing = !!initialJob;

    // Wizard State
    const [step, setStep] = useState(1);
    const [postingMode, setPostingMode] = useState<'UNDECIDED' | 'MANUAL' | 'VOICE'>('UNDECIDED');
    const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

    const handleVoiceAssistantComplete = (data: any) => {
        if (data.title) setNewJobTitle(data.title);
        if (data.description) setNewJobDesc(data.description);
        if (data.category) {
            const found = CATEGORIES.find(c => c.toLowerCase() === data.category.toLowerCase()) || CATEGORIES[0];
            setNewJobCategory(found);
        }
        if (data.budget) setNewJobBudget(data.budget.toString());
        if (data.location) setNewJobLocation(data.location);
        if (data.timing) setNewJobDate(data.timing);

        setShowVoiceAssistant(false);
        setPostingMode('MANUAL');
    };
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
        showLoading(isEditing ? 'Updating Job...' : 'Publishing Job...');
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
            hideLoading();
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
    const [suggestions, setSuggestions] = useState<Array<{ lat: number; lng: number; displayName: string }>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync local search query when location is set externally (e.g. drafts or map click)
    useEffect(() => {
        if (newJobLocation && searchQuery !== newJobLocation) {
            setSearchQuery(newJobLocation);
        }
    }, [newJobLocation]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (query.length > 2) {
            searchTimeoutRef.current = setTimeout(async () => {
                const results = await searchPlaces(query);
                setSuggestions(results);
                setShowSuggestions(true);
            }, 500);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (place: { lat: number; lng: number; displayName: string }) => {
        setNewJobCoords({ lat: place.lat, lng: place.lng });
        setNewJobLocation(place.displayName);
        setSearchQuery(place.displayName);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleMapLocationSelect = async (lat: number, lng: number) => {
        setNewJobCoords({ lat, lng });
        const address = await reverseGeocode(lat, lng);
        if (address) {
            setNewJobLocation(address);
            setSearchQuery(address); // Sync the input box
        }
    };

    // Manual trigger fallback
    const handleAddressSearch = async () => {
        if (!searchQuery.trim()) return;
        const result = await forwardGeocode(searchQuery);
        if (result) {
            setNewJobCoords({ lat: result.lat, lng: result.lng });
            setNewJobLocation(result.displayName);
            setShowSuggestions(false);
        } else {
            showAlert("Location not found", "error");
        }
    };

    const [showEditForm, setShowEditForm] = useState(false);

    if (isEditing && !showEditForm) {
        return (
            <div className="p-4 animate-fade-in pb-10">
                <h2 className="text-2xl font-bold text-primary mb-6">{t.editJob}</h2>
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border text-center transition-colors">
                    <p className="text-text-secondary mb-6">Update the details for <strong>{initialJob?.title}</strong></p>
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
        <div className="pb-32 animate-fade-in pt-safe">
            {/* Header with Progress */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 bg-background rounded-full hover:bg-border transition-colors">
                            <ArrowLeft size={20} className="text-text-secondary" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-black text-text-primary tracking-tight leading-none">
                            {isEditing ? t.editJob : (postingMode === 'UNDECIDED' ? t.postJobHeader : (postingMode === 'MANUAL' ? 'Manual Posting' : 'AI Voice Assistant'))}
                        </h2>
                        <p className="text-xs font-bold text-text-muted mt-1">
                            {postingMode === 'UNDECIDED' && (language === 'en' ? 'Choose how you want to post' : (language === 'hi' ? 'चुनें कि आप कैसे पोस्ट करना चाहते हैं' : 'ਚੁਣੋ ਕਿ ਤੁਸੀਂ ਕਿਵੇਂ ਪੋਸਟ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ'))}
                            {postingMode === 'MANUAL' && step === 1 && "Let's start with the basics"}
                            {postingMode === 'MANUAL' && step === 2 && "Where and when?"}
                            {postingMode === 'MANUAL' && step === 3 && "Final details & Review"}
                        </p>
                    </div>
                </div>

                {/* Progress Bar (Only for Manual Mode) */}
                {postingMode === 'MANUAL' && (
                    <>
                        <div className="h-1.5 w-full bg-background rounded-full overflow-hidden flex">
                            <div className={`h-full transition-all duration-500 ease-out bg-primary ${step >= 1 ? 'w-1/3' : 'w-0'}`} />
                            <div className={`h-full transition-all duration-500 ease-out ${step >= 2 ? 'bg-primary w-1/3' : 'bg-transparent w-1/3'}`} />
                            <div className={`h-full transition-all duration-500 ease-out ${step >= 3 ? 'bg-primary w-1/3' : 'bg-transparent w-1/3'}`} />
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                            <span className={step >= 1 ? 'text-primary' : ''}>Basics</span>
                            <span className={step >= 2 ? 'text-primary' : ''}>Logistics</span>
                            <span className={step >= 3 ? 'text-primary' : ''}>Polish</span>
                        </div>
                    </>
                )}
            </div>

            {postingMode === 'UNDECIDED' && !isEditing ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-500">
                    {/* AI ASSISTANT OPTION */}
                    <button
                        onClick={() => { setPostingMode('VOICE'); setShowVoiceAssistant(true); }}
                        className="w-full relative overflow-hidden group p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-left border-4 border-white/10 shadow-2xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                            <Sparkles size={120} className="text-white" />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest mb-4">
                                <Wand2 size={12} /> Recommended
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight mb-2">
                                {language === 'en' ? 'Post with AI Voice' : (language === 'hi' ? 'AI वॉइस के साथ पोस्ट करें' : 'AI ਵੌਇਸ ਨਾਲ ਪੋਸਟ ਕਰੋ')}
                            </h3>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-[80%]">
                                {language === 'en' ? 'Just talk to our assistant and we will handle the rest. Fast, smart, and easy.' : (language === 'hi' ? 'बस हमारे सहायक से बात करें और हम बाकी संभाल लेंगे। तेज़, स्मार्ट और आसान।' : 'ਬੱਸ ਸਾਡੇ ਸਹਾਇਕ ਨਾਲ ਗੱਲ ਕਰੋ ਅਤੇ ਅਸੀਂ ਬਾਕੀ ਸੰਭਾਲ ਲਵਾਂਗੇ। ਤੇਜ਼, ਸਮਾਰਟ ਅਤੇ ਆਸਾਨ।')}
                            </p>
                        </div>
                        <div className="absolute bottom-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-lg group-hover:translate-x-1 transition-transform">
                            <ChevronRight size={24} strokeWidth={3} />
                        </div>
                    </button>

                    {/* MANUAL OPTION */}
                    <button
                        onClick={() => setPostingMode('MANUAL')}
                        className="w-full p-8 rounded-[2.5rem] bg-surface border-2 border-border text-left hover:border-primary/30 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-text-primary tracking-tight mb-1">
                                    {language === 'en' ? 'Post Manually' : (language === 'hi' ? 'मैन्युअल रूप से पोस्ट करें' : 'ਮੈਨੂਅਲ ਪੋਸਟ ਕਰੋ')}
                                </h3>
                                <p className="text-text-muted text-xs font-bold uppercase tracking-widest">
                                    {language === 'en' ? 'Type it yourself' : (language === 'hi' ? 'खुद टाइप करें' : 'ਖੁਦ ਟਾਈਪ ਕਰੋ')}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <ArrowDownWideNarrow size={20} />
                            </div>
                        </div>
                    </button>

                    <p className="text-center text-[10px] font-black text-text-muted uppercase tracking-[0.2em] pt-4 opacity-50">
                        {language === 'en' ? 'Safe • Secure • Zero Commission' : 'सुरक्षित • भरोसेमंद • जीरो कमीशन'}
                    </p>
                </div>
            ) : (
                <div className="bg-surface rounded-[2rem] shadow-sm border border-border overflow-hidden relative min-h-[400px]">

                    {/* Live Preview Card (Only for Manual Mode) */}
                    {postingMode === 'MANUAL' && (
                        <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-border">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={14} className="text-secondary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Live Preview</span>
                            </div>
                            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-lg font-black text-text-primary leading-tight">
                                        {newJobTitle || (language === 'hi' ? 'नौकरी का शीर्षक' : 'Job Title')}
                                    </h4>
                                    <div className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">
                                        {newJobCategory}
                                    </div>
                                </div>
                                <p className="text-sm text-text-secondary line-clamp-2 mb-3 h-10">
                                    {newJobDesc || (language === 'hi' ? 'नौकरी का विवरण यहाँ दिखेगा...' : 'Job description will appear here...')}
                                </p>
                                <div className="flex items-center gap-4 text-xs font-bold text-text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={14} />
                                        <span>{newJobLocation || (language === 'hi' ? 'स्थान' : 'Location')}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-secondary font-black">
                                        <IndianRupee size={14} />
                                        <span>{newJobBudget || '0'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: BASICS */}
                    <div className={`p-6 space-y-6 transition-all duration-500 ${step === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full absolute inset-0 pointer-events-none'}`}>

                        {/* Title */}
                        <div className="group/field relative">
                            <input
                                type="text"
                                id="jobTitle"
                                placeholder=" "
                                maxLength={100}
                                className="peer w-full bg-transparent border-0 border-b-2 border-border px-0 py-3 font-black text-xl text-text-primary focus:ring-0 focus:border-primary transition-colors placeholder-transparent"
                                value={newJobTitle}
                                onChange={(e) => setNewJobTitle(e.target.value)}
                            />
                            <label htmlFor="jobTitle" className="absolute left-0 -top-3.5 text-xs font-black uppercase tracking-wider text-primary transition-all peer-placeholder-shown:text-base peer-placeholder-shown:font-bold peer-placeholder-shown:text-text-muted peer-placeholder-shown:top-3 peer-placeholder-shown:tracking-normal peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-black peer-focus:text-primary peer-focus:tracking-wider">
                                {t.jobTitleLabel}
                            </label>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 block">{t.categoryLabel}</label>
                            <div className="grid grid-cols-2 gap-3">
                                {CATEGORY_CONFIG.map(cat => {
                                    const Icon = cat.icon;
                                    const isSelected = newJobCategory === cat.id;

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setNewJobCategory(cat.id)}
                                            className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all h-24 flex flex-col justify-between group ${isSelected
                                                ? 'ring-2 ring-primary shadow-lg scale-[1.02]'
                                                : 'bg-background border-2 border-transparent hover:border-border'}`}
                                        >
                                            {/* Background Gradient */}
                                            <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-10 transition-opacity ${isSelected ? 'opacity-100' : 'group-hover:opacity-20'}`} />

                                            {/* Icon */}
                                            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-surface text-text-muted'}`}>
                                                <Icon size={16} strokeWidth={2.5} />
                                            </div>

                                            {/* Label */}
                                            <span className={`relative z-10 text-xs font-black uppercase tracking-wider transition-colors ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
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
                                className="w-full bg-background border-2 border-transparent focus:border-primary rounded-2xl p-4 text-sm font-medium text-text-primary outline-none min-h-[160px] resize-none transition-all"
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
                                    placeholder={language === 'en' ? "e.g. 2 Hours, 3 Days" : "जैसे 2 घंटे, 3 दिन"}
                                    className="peer w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 px-0 py-3 font-bold text-gray-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-colors placeholder-gray-300 dark:placeholder-gray-600"
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
                            <div className="flex gap-2 relative z-50">
                                <div className="relative flex-1">
                                    <input
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                                        placeholder={language === 'en' ? "Search for area, city..." : "क्षेत्र, शहर खोजें..."}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        autoComplete="off"
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto z-[100]">
                                            {suggestions.map((place, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSuggestionClick(place)}
                                                    className="w-full text-left px-4 py-3 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 border-b border-border/50 last:border-0 flex items-start gap-3 transition-colors group"
                                                >
                                                    <MapPin size={16} className="mt-0.5 text-emerald-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                                                    <span className="text-sm font-medium text-text-primary line-clamp-2">{place.displayName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={handleAddressSearch} className="absolute right-2 top-2 p-1.5 bg-white dark:bg-gray-700 rounded-lg text-emerald-600 shadow-sm hover:scale-105 transition-transform"><Sparkles size={16} /></button>
                                </div>
                                <button
                                    onClick={() => getDeviceLocation(async (coords) => {
                                        setNewJobCoords(coords);
                                        const address = await reverseGeocode(coords.lat, coords.lng);
                                        if (address) {
                                            setNewJobLocation(address);
                                            setSearchQuery(address);
                                        }
                                        showAlert(t.locationCaptured, 'success');
                                    }, () => showAlert(t.alertGeoPermission, 'error'))}
                                    className="px-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs uppercase tracking-wider border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
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
                                {/* Overlay Pointer Hint */}
                                <div className="absolute bottom-2 right-2 bg-surface/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm pointer-events-none">
                                    Tap map to adjust
                                </div>
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
            )}

            {/* Always-on Assistant Bubble (Visible in Manual Mode) */}
            {postingMode === 'MANUAL' && (
                <button
                    onClick={() => { setPostingMode('VOICE'); setShowVoiceAssistant(true); }}
                    className="fixed bottom-24 right-6 z-[120] w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center text-white animate-bounce hover:scale-110 active:scale-95 transition-all border-4 border-white/20"
                >
                    <Sparkles size={24} className="animate-pulse" />
                    <div className="absolute -top-12 right-0 bg-white dark:bg-gray-900 px-4 py-2 rounded-2xl shadow-xl border border-border whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-xs font-black text-text-primary">Need help? Tap to speak</span>
                        <div className="absolute bottom-[-6px] right-6 w-3 h-3 bg-white dark:bg-gray-900 border-r border-b border-border rotate-45" />
                    </div>
                </button>
            )}

            {/* Navigation Footer */}
            {(postingMode === 'MANUAL' || isEditing) && (
                <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-surface/95 backdrop-blur-xl border-t border-border z-[110] md:sticky md:bottom-0 md:bg-transparent md:border-none md:backdrop-blur-none transition-all duration-300">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        {step > 1 && (
                            <button
                                onClick={prevStep}
                                className="flex-1 py-4 bg-background text-text-primary rounded-[1.5rem] font-bold text-sm uppercase tracking-wider hover:bg-border transition-colors"
                            >
                                Back
                            </button>
                        )}
                        {step < 3 ? (
                            <button
                                onClick={nextStep}
                                className="flex-[2] py-4 bg-text-primary text-background rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                Next <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handlePostJob}
                                disabled={isPosting}
                                className={`flex-[2] py-4 bg-primary text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isPosting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isPosting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                                {isEditing ? 'Update Job' : 'Post Job'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <VoiceAssistantOverlay
                isOpen={showVoiceAssistant}
                onClose={() => setShowVoiceAssistant(false)}
                onComplete={handleVoiceAssistantComplete}
                language={language}
            />
        </div>
    );
};