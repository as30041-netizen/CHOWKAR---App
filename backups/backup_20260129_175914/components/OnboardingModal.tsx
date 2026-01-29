import React, { useState, useEffect, useMemo } from 'react';
import { UserRole } from '../types';
import { useUser } from '../contexts/UserContextDB';
import { useAdminConfig } from '../contexts/AdminConfigContext';
import { Briefcase, Search, Languages, ChevronRight, MapPin, Phone, CheckCircle, ArrowLeft, Loader2, User, Wrench, X } from 'lucide-react';
import { useKeyboard } from '../hooks/useKeyboard';
import { getDeviceLocation, reverseGeocode } from '../utils/geo';
import { LeafletMap } from './LeafletMap';
import { CATEGORY_CONFIG } from '../constants';

interface OnboardingModalProps {
    isOpen: boolean;
    onComplete: (role: UserRole) => void;
}

// Step types for adaptive flow
type StepType = 'ROLE' | 'NAME' | 'PHONE' | 'LOCATION' | 'SKILLS';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
    const { user, language, setLanguage, updateUserInDB, setRole, role, showAlert } = useUser();
    const { config } = useAdminConfig();
    const { isOpen: isKeyboardOpen } = useKeyboard();

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Determine required steps based on user data
    const requiredSteps = useMemo((): StepType[] => {
        const steps: StepType[] = ['ROLE'];

        // Name step: show if name is missing or is a fallback value
        if (!user.name || user.name === 'User' || user.name.trim() === '') {
            steps.push('NAME');
        }

        // Phone step: show if phone is missing OR is a placeholder
        if (!user.phone || user.phone.startsWith('pending_')) {
            steps.push('PHONE');
        }

        // Location step: show if location is missing
        if (!user.location || user.location === 'Not set') {
            steps.push('LOCATION');
        }

        // Skills step: only for workers and if skills are empty
        // This will be dynamically added after role selection if WORKER is chosen

        return steps;
    }, [user.name, user.phone, user.location]);

    // Current step
    const currentStep = requiredSteps[currentStepIndex] || 'ROLE';

    // Sync initial state from user
    useEffect(() => {
        if (isOpen && user) {
            if (user.name && user.name !== 'User') setName(user.name);
            if (user.phone && !user.phone.startsWith('pending_')) setPhone(user.phone);
            if (user.location && user.location !== 'Not set') setLocation(user.location);
            if (user.coordinates) setCoords(user.coordinates);
            if (user.skills && user.skills.length > 0) setSelectedSkills(user.skills);
        }
    }, [isOpen, user]);

    // Reset step index when modal opens
    useEffect(() => {
        if (isOpen) setCurrentStepIndex(0);
    }, [isOpen]);

    if (!isOpen) return null;

    const t = {
        en: {
            welcome: `Welcome!`,
            chooseRole: 'CHOOSE YOUR ROLE',
            hire: 'I want to Hire',
            hireDesc: 'Post jobs & find local workers',
            work: 'I want to Work',
            workDesc: 'Find local jobs & earn money',
            stepName: 'YOUR NAME',
            nameLabel: 'What should we call you?',
            namePlaceholder: 'Enter your name',
            stepPhone: 'YOUR CONTACT',
            phoneLabel: 'Mobile Number',
            phonePlaceholder: 'Enter 10-digit number',
            stepLocation: 'YOUR LOCATION',
            locLabel: 'Where do you live?',
            locPlaceholder: 'Village / City Name',
            useGps: 'Use Current Location',
            stepSkills: 'YOUR SKILLS',
            skillsLabel: 'What work can you do?',
            skillsHint: 'Select all that apply',
            finish: 'Finish Setup',
            next: 'Next Step',
            back: 'Back',
            saving: 'Saving...',
            switchLang: 'हिंदी / ਪੰਜਾਬੀ',
            locating: 'Locating...'
        },
        hi: {
            welcome: `स्वागत है!`,
            chooseRole: 'अपनी भूमिका चुनें',
            hire: 'मुझे काम देना है',
            hireDesc: 'जॉब पोस्ट करें और वर्कर ढूँढें',
            work: 'मुझे काम चाहिए',
            workDesc: 'जॉब ढूँढें और पैसे कमाएं',
            stepName: 'आपका नाम',
            nameLabel: 'हम आपको क्या कहें?',
            namePlaceholder: 'अपना नाम डालें',
            stepPhone: 'आपका संपर्क',
            phoneLabel: 'मोबाइल नंबर',
            phonePlaceholder: '10 अंकों का नंबर डालें',
            stepLocation: 'आपकी लोकेशन',
            locLabel: 'आप कहाँ रहते हैं?',
            locPlaceholder: 'गांव / शहर का नाम',
            useGps: 'अभी की लोकेशन लें',
            stepSkills: 'आपके कौशल',
            skillsLabel: 'आप क्या काम कर सकते हैं?',
            skillsHint: 'सभी चुनें जो लागू हों',
            finish: 'पूरा करें',
            next: 'अगला',
            back: 'पीछे',
            saving: 'सेव हो रहा है...',
            switchLang: 'English / ਪੰਜਾਬੀ',
            locating: 'ढूँढ रहे हैं...'
        },
        pa: {
            welcome: `ਸਵਾਗਤ ਹੈ!`,
            chooseRole: 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ',
            hire: 'ਮੈਂ ਕੰਮ ਦੇਣਾ ਹੈ',
            hireDesc: 'ਨੌਕਰੀ ਪੋਸਟ ਕਰੋ ਅਤੇ ਵਰਕਰ ਲੱਭੋ',
            work: 'ਮੈਂ ਕੰਮ ਕਰਨਾ ਹੈ',
            workDesc: 'ਨੌਕਰੀ ਲੱਭੋ ਅਤੇ ਪੈਸੇ ਕਮਾਓ',
            stepName: 'ਤੁਹਾਡਾ ਨਾਮ',
            nameLabel: 'ਅਸੀਂ ਤੁਹਾਨੂੰ ਕੀ ਕਹੀਏ?',
            namePlaceholder: 'ਆਪਣਾ ਨਾਮ ਦਰਜ ਕਰੋ',
            stepPhone: 'ਤੁਹਾਡਾ ਸੰਪਰਕ',
            phoneLabel: 'ਮੋਬਾਈਲ ਨੰਬਰ',
            phonePlaceholder: '10 ਅੰਕਾਂ ਦਾ ਨੰਬਰ ਪਾਓ',
            stepLocation: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ',
            locLabel: 'ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ?',
            locPlaceholder: 'ਪਿੰਡ / ਸ਼ਹਿਰ ਦਾ ਨਾਂ',
            useGps: 'ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਵਰਤੋ',
            stepSkills: 'ਤੁਹਾਡੇ ਹੁਨਰ',
            skillsLabel: 'ਤੁਸੀਂ ਕਿਹੜਾ ਕੰਮ ਕਰ ਸਕਦੇ ਹੋ?',
            skillsHint: 'ਸਾਰੇ ਚੁਣੋ ਜੋ ਲਾਗੂ ਹੋਣ',
            finish: 'ਪੂਰਾ ਕਰੋ',
            next: 'ਅੱਗੇ',
            back: 'ਪਿੱਛੇ',
            saving: 'ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ...',
            switchLang: 'English / हिंदी',
            locating: 'ਲੱਭ ਰਹੇ ਹਾਂ...'
        }
    };

    const cur = t[language as keyof typeof t] || t.en;

    // Determine step title based on current step
    const getStepTitle = () => {
        switch (currentStep) {
            case 'ROLE': return cur.welcome;
            case 'NAME': return cur.stepName;
            case 'PHONE': return cur.stepPhone;
            case 'LOCATION': return cur.stepLocation;
            case 'SKILLS': return cur.stepSkills;
            default: return cur.welcome;
        }
    };

    // Determine step subtitle
    const getStepSubtitle = () => {
        if (currentStep === 'ROLE') return cur.chooseRole;
        return `Step ${currentStepIndex + 1} of ${requiredSteps.length + (role === UserRole.WORKER && (!user.skills || user.skills.length === 0) ? 1 : 0)}`;
    };

    const handleRoleSelect = (selectedRole: UserRole) => {
        setRole(selectedRole);
        // Move to next step in the required steps array
        setCurrentStepIndex(1);
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    const handleNext = async () => {
        const nextIndex = currentStepIndex + 1;

        // If we've completed all required steps
        if (nextIndex >= requiredSteps.length) {
            // Check if we need to show skills step for workers
            if (role === UserRole.WORKER && (!user.skills || user.skills.length === 0) && currentStep !== 'SKILLS') {
                // Show skills step
                setCurrentStepIndex(nextIndex); // This will trigger SKILLS step
                return;
            }

            // Otherwise, finish onboarding
            await finishOnboarding();
        } else {
            setCurrentStepIndex(nextIndex);
        }
    };

    const finishOnboarding = async () => {
        setIsSaving(true);
        try {
            const updates: Partial<typeof user> = {};

            if (name && name !== user.name) updates.name = name;
            if (phone && phone !== user.phone) updates.phone = phone;
            if (location && location !== user.location) updates.location = location;
            if (coords) updates.coordinates = coords;
            if (selectedSkills.length > 0 && role === UserRole.WORKER) updates.skills = selectedSkills;

            if (Object.keys(updates).length > 0) {
                await updateUserInDB(updates);
            }

            onComplete(role);
        } catch (err) {
            console.error('Onboarding update failed', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUseGps = () => {
        setIsLocating(true);
        getDeviceLocation(
            async (c) => {
                setCoords(c);
                const address = await reverseGeocode(c.lat, c.lng);
                if (address) setLocation(address);
                setIsLocating(false);
            },
            () => setIsLocating(false)
        );
    };

    const toggleSkill = (skillId: string) => {
        setSelectedSkills(prev =>
            prev.includes(skillId)
                ? prev.filter(s => s !== skillId)
                : [...prev, skillId]
        );
    };

    // Validation for current step
    const isStepValid = () => {
        switch (currentStep) {
            case 'NAME': return name.trim().length >= 2;
            case 'PHONE': return phone.length === 10;
            case 'LOCATION': return location.trim().length > 0;
            case 'SKILLS': return true; // Skills are optional
            default: return true;
        }
    };

    // Check if current step is the last step
    const isLastStep = () => {
        if (currentStepIndex >= requiredSteps.length - 1) {
            // If worker and no skills, we'll show skills step next
            if (role === UserRole.WORKER && (!user.skills || user.skills.length === 0) && currentStep !== 'SKILLS') {
                return false;
            }
            return true;
        }
        return false;
    };

    // Render current step based on dynamic flow
    const renderStep = () => {
        // Handle skills step which is dynamically added
        if (currentStepIndex >= requiredSteps.length && role === UserRole.WORKER) {
            return renderSkillsStep();
        }

        switch (currentStep) {
            case 'ROLE': return renderRoleStep();
            case 'NAME': return renderNameStep();
            case 'PHONE': return renderPhoneStep();
            case 'LOCATION': return renderLocationStep();
            case 'SKILLS': return renderSkillsStep();
            default: return renderRoleStep();
        }
    };

    const renderRoleStep = () => (
        <div className="grid gap-3 animate-slide-up">
            <button
                onClick={() => handleRoleSelect(UserRole.POSTER)}
                className="group relative flex items-center gap-4 p-4 rounded-3xl bg-gray-50 dark:bg-gray-900 border-2 border-transparent hover:border-emerald-500 hover:bg-white dark:hover:bg-gray-800 transition-all text-left shadow-sm active:scale-[0.98]"
            >
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:rotate-6 transition-transform">
                    <Briefcase size={22} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-lg text-gray-900 dark:text-white leading-none mb-1">
                        {cur.hire}
                    </h3>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {cur.hireDesc}
                    </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
            </button>

            <button
                onClick={() => handleRoleSelect(UserRole.WORKER)}
                className="group relative flex items-center gap-4 p-4 rounded-3xl bg-gray-50 dark:bg-gray-900 border-2 border-transparent hover:border-blue-500 hover:bg-white dark:hover:bg-gray-800 transition-all text-left shadow-sm active:scale-[0.98]"
            >
                <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md group-hover:-rotate-6 transition-transform">
                    <Search size={22} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-lg text-gray-900 dark:text-white leading-none mb-1">
                        {cur.work}
                    </h3>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {cur.workDesc}
                    </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </button>
        </div>
    );

    const renderNameStep = () => (
        <div className="space-y-5 animate-slide-up">
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-3xl border-2 border-purple-100 dark:border-purple-900/50">
                <label className="block text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2 px-2">
                    {cur.nameLabel}
                </label>
                <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 group-focus-within:scale-110 transition-transform" size={18} />
                    <input
                        type="text"
                        placeholder={cur.namePlaceholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-11 pr-5 py-3 bg-white dark:bg-gray-900 rounded-2xl border-0 ring-2 ring-transparent focus:ring-purple-500/20 text-lg font-bold transition-all outline-none"
                        autoFocus
                    />
                    {name.trim().length >= 2 && (
                        <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 animate-pop" size={18} />
                    )}
                </div>
            </div>

            <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`
                    w-full py-4 rounded-2xl font-black text-lg tracking-tight shadow-xl transition-all active:scale-[0.98]
                    ${isStepValid()
                        ? 'bg-purple-500 text-white shadow-purple-500/20 hover:bg-purple-600'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-900 cursor-not-allowed'}
                `}
            >
                {cur.next}
            </button>
        </div>
    );

    const renderPhoneStep = () => (
        <div className="space-y-5 animate-slide-up">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50">
                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 px-2">
                    {cur.phoneLabel}
                </label>
                <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 group-focus-within:scale-110 transition-transform" size={18} />
                    <input
                        type="tel"
                        placeholder={cur.phonePlaceholder}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-11 pr-5 py-3 bg-white dark:bg-gray-900 rounded-2xl border-0 ring-2 ring-transparent focus:ring-emerald-500/20 text-lg font-bold tracking-widest transition-all outline-none"
                        autoFocus
                    />
                    {phone.length === 10 && (
                        <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-pop" size={18} />
                    )}
                </div>
            </div>

            <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`
                    w-full py-4 rounded-2xl font-black text-lg tracking-tight shadow-xl transition-all active:scale-[0.98]
                    ${isStepValid()
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-900 cursor-not-allowed'}
                `}
            >
                {cur.next}
            </button>
        </div>
    );

    const renderLocationStep = () => (
        <div className="space-y-5 animate-slide-up">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-3xl border-2 border-blue-100 dark:border-blue-900/50">
                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 px-2">
                    {cur.locLabel}
                </label>
                <div className="relative group mb-3">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:scale-110 transition-transform" size={18} />
                    <input
                        type="text"
                        placeholder={cur.locPlaceholder}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-11 pr-5 py-3 bg-white dark:bg-gray-900 rounded-2xl border-0 ring-2 ring-transparent focus:ring-blue-500/20 text-lg font-bold transition-all outline-none"
                    />
                </div>
                <button
                    onClick={handleUseGps}
                    disabled={isLocating}
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 rounded-2xl border-2 border-blue-100 dark:border-blue-900/50 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all w-full justify-center active:scale-95"
                >
                    {isLocating ? <Loader2 className="animate-spin" size={14} /> : <MapPin size={14} />}
                    {isLocating ? cur.locating : cur.useGps}
                </button>
            </div>

            {/* Mini Map View */}
            {coords && !isKeyboardOpen && (
                <div className="h-32 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-900 shadow-md transition-all">
                    <LeafletMap
                        lat={coords.lat}
                        lng={coords.lng}
                        popupText={location || "You are here"}
                        editable={true}
                        onLocationSelect={async (lat, lng) => {
                            const c = { lat, lng };
                            setCoords(c);
                            const address = await reverseGeocode(lat, lng);
                            if (address) setLocation(address);
                        }}
                        height="h-full"
                    />
                </div>
            )}

            <button
                onClick={handleNext}
                disabled={!isStepValid() || isSaving}
                className={`
                    w-full py-4 rounded-2xl font-black text-lg tracking-tight shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2
                    ${isStepValid() && !isSaving
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-900 cursor-not-allowed'}
                `}
            >
                {isSaving && <Loader2 className="animate-spin" size={20} />}
                {isSaving ? cur.saving : (role === UserRole.WORKER && (!user.skills || user.skills.length === 0) ? cur.next : cur.finish)}
            </button>
        </div>
    );

    const renderSkillsStep = () => (
        <div className="space-y-4 animate-slide-up">
            <div className="bg-amber-50 dark:bg-amber-950/30 p-5 rounded-3xl border-2 border-amber-100 dark:border-amber-900/50">
                <label className="block text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 px-1">
                    {cur.skillsLabel}
                </label>
                <p className="text-[10px] text-gray-500 mb-3 px-1">{cur.skillsHint}</p>

                <div className="flex flex-wrap gap-2">
                    {CATEGORY_CONFIG.map((category) => {
                        const Icon = category.icon;
                        const isSelected = selectedSkills.includes(category.id);
                        return (
                            <button
                                key={category.id}
                                onClick={() => toggleSkill(category.id)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all active:scale-95
                                    ${isSelected
                                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800'}
                                `}
                            >
                                <Icon size={14} />
                                {category.label[language as keyof typeof category.label] || category.label.en}
                            </button>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={finishOnboarding}
                disabled={isSaving}
                className={`
                    w-full py-4 rounded-2xl font-black text-lg tracking-tight shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2
                    ${!isSaving
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-900 cursor-not-allowed'}
                `}
            >
                {isSaving && <Loader2 className="animate-spin" size={20} />}
                {isSaving ? cur.saving : cur.finish}
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xl animate-fade-in" />

            {/* Modal Card */}
            <div className={`
                bg-white dark:bg-gray-950 w-full max-w-md 
                ${isKeyboardOpen ? 'h-full sm:h-auto' : 'h-full sm:h-auto'} 
                sm:rounded-3xl shadow-2xl 
                overflow-hidden flex flex-col relative z-20 animate-pop 
                border-0 sm:border-4 border-white dark:border-gray-900 
                transition-all pt-safe pb-safe
            `}>

                {/* Header Section: Super App Branding & Utilities */}
                <div className="relative p-5 pb-2 text-center">
                    {/* Top Utility Row */}
                    <div className="flex items-center justify-between mb-4">
                        {/* Brand Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                                <MapPin size={16} fill="currentColor" strokeWidth={2} />
                            </div>
                            <span className="text-base font-black font-serif-logo text-emerald-950 dark:text-emerald-50 tracking-tight leading-none">
                                CHOWKAR
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (language === 'en') setLanguage('hi');
                                    else if (language === 'hi') setLanguage('pa');
                                    else setLanguage('en');
                                }}
                                className="px-2.5 py-1 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-md text-gray-900 dark:text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-gray-100 dark:border-gray-800 transition-all flex items-center gap-1 hover:bg-white"
                            >
                                <Languages size={10} className="text-emerald-500" /> {cur.switchLang}
                            </button>

                            <button
                                onClick={async () => {
                                    const { supabase } = await import('../lib/supabase');
                                    await supabase.auth.signOut();
                                    window.location.href = '/';
                                }}
                                className="p-1 bg-red-50/50 dark:bg-red-900/20 backdrop-blur-md text-red-600 rounded-lg border border-red-100 dark:border-red-900/50 transition-all hover:bg-red-500 hover:text-white"
                                title="Sign Out"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden mb-5">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${((currentStepIndex + 1) / (requiredSteps.length + (role === UserRole.WORKER ? 1 : 0))) * 100}%` }}
                        />
                    </div>

                    {/* Back Button (Floating) */}
                    {currentStepIndex > 0 && (
                        <button
                            onClick={handleBack}
                            className="absolute top-16 left-5 p-1.5 rounded-full bg-white dark:bg-gray-900 text-gray-400 hover:text-emerald-500 transition-colors shadow-md border border-gray-100 dark:border-gray-800 z-10"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}

                    {/* Simple Header */}
                    <div className="mb-4">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight mb-0.5">
                            {getStepTitle()}
                        </h2>
                        <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-[0.25em]">
                            {getStepSubtitle()}
                        </p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-5 pb-6">
                    {renderStep()}
                </div>

                {/* Keyboard Spacing */}
                <div style={{ height: isKeyboardOpen ? 'var(--keyboard-height, 0px)' : '0px' }} className="transition-all duration-300" />
            </div>
        </div>
    );
};
