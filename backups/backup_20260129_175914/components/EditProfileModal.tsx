import React, { useState, useEffect } from 'react';
import { UserCircle, Loader2, MapPin, ArrowLeft, Camera, Plus, ChevronRight, Gift, CheckCircle2 as CheckCircle, Sparkles, X } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useNotification } from '../contexts/NotificationContext';
import { uploadProfileImage, isBase64Image } from '../services/storageService';
import { getDeviceLocation, reverseGeocode, forwardGeocode } from '../utils/geo';
import { LeafletMap } from './LeafletMap';
import { CATEGORY_CONFIG } from '../constants';
import { useKeyboard } from '../hooks/useKeyboard';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    isMandatory?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, showAlert, isMandatory = false }) => {
    const { user, updateUserInDB, t, language } = useUser();
    const { addNotification } = useNotification();
    const { isOpen: isKeyboardOpen } = useKeyboard();


    const [editProfileName, setEditProfileName] = useState('');
    const [editProfilePhone, setEditProfilePhone] = useState('');
    const [editProfileLocation, setEditProfileLocation] = useState('');
    const [editProfileBio, setEditProfileBio] = useState('');
    const [editProfileExp, setEditProfileExp] = useState('');
    const [editProfileSkills, setEditProfileSkills] = useState<string[]>([]);
    const [editProfilePhoto, setEditProfilePhoto] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [newCoordinates, setNewCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [customSkillInput, setCustomSkillInput] = useState('');

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen && user) {
            setEditProfileName(user.name || '');
            setEditProfilePhone(user.phone || '');
            setEditProfileLocation(user.location || '');
            setEditProfileBio(user.bio || '');
            setEditProfileExp(user.experience || '');
            setEditProfileSkills(user.skills || []);
            setEditProfilePhoto(user.profilePhoto || '');
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleSaveProfile = async () => {
        if (!editProfileName.trim()) {
            showAlert(language === 'en' ? 'Name is required' : 'नाम आवश्यक है', 'error');
            return;
        }

        if (!editProfilePhone.trim()) {
            showAlert(language === 'en' ? 'Phone number is required' : 'फोन नंबर आवश्यक है', 'error');
            return;
        }

        if (!editProfileLocation.trim() || editProfileLocation === 'Not set') {
            showAlert(language === 'en' ? 'Valid location is required' : 'सही स्थान आवश्यक है', 'error');
            return;
        }

        setIsSaving(true);
        try {
            let finalPhotoUrl = editProfilePhoto;
            if (editProfilePhoto && isBase64Image(editProfilePhoto)) {
                setIsUploadingPhoto(true);
                const rawBase64 = editProfilePhoto.split(',')[1];
                const { url, error: uploadError } = await uploadProfileImage(rawBase64, user.id);
                setIsUploadingPhoto(false);

                if (url) {
                    finalPhotoUrl = url;
                } else {
                    finalPhotoUrl = user.profilePhoto || '';
                }
            }

            const updates: any = {
                name: editProfileName.trim(),
                phone: editProfilePhone.trim(),
                location: editProfileLocation.trim(),
                bio: editProfileBio.trim(),
                experience: editProfileExp.trim(),
                skills: editProfileSkills,
                profilePhoto: finalPhotoUrl,
                coordinates: newCoordinates
            };

            const payloadSize = JSON.stringify(updates).length;
            if (payloadSize > 250000) {
                showAlert('Photo is too large. Please use a smaller image or skip the photo for now.', 'error');
                setIsSaving(false);
                return;
            }

            await updateUserInDB(updates);

            onClose();
            addNotification(user.id, t.notifProfileUpdated, t.notifProfileUpdatedBody, "SUCCESS");
            showAlert(t.notifProfileUpdated, 'success');
        } catch (error: any) {
            console.error('Profile update error:', error);
            showAlert(error.message || 'Failed to update profile.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setEditProfilePhoto(compressedBase64);
            };
        };
        reader.readAsDataURL(file);
    };

    const handleGetLocation = () => {
        setIsLocating(true);
        getDeviceLocation(
            async (coords) => {
                setNewCoordinates(coords);
                const address = await reverseGeocode(coords.lat, coords.lng);
                if (address) {
                    setEditProfileLocation(address);
                    showAlert(language === 'en' ? "Location captured!" : "स्थान कैप्चर किया गया!", "success");
                }
                setIsLocating(false);
            },
            () => {
                showAlert(language === 'en' ? "Could not get location." : "स्थान प्राप्त नहीं कर सके।", "error");
                setIsLocating(false);
            }
        );
    };

    const handleMapLocationSelect = async (lat: number, lng: number) => {
        setNewCoordinates({ lat, lng });
        // Optional: Auto-reverse geocode on drag end
        const address = await reverseGeocode(lat, lng);
        if (address) {
            setEditProfileLocation(address);
        }
    };

    const handleAddressSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsLocating(true);
        const result = await forwardGeocode(searchQuery);
        if (result) {
            setNewCoordinates({ lat: result.lat, lng: result.lng });
            setEditProfileLocation(result.displayName);
        } else {
            showAlert("Location not found", "error");
        }
        setIsLocating(false);
    };

    const handleAddCustomSkill = () => {
        if (!customSkillInput.trim()) return;
        if (editProfileSkills.includes(customSkillInput.trim())) {
            setCustomSkillInput('');
            return;
        }
        setEditProfileSkills(prev => [...prev, customSkillInput.trim()]);
        setCustomSkillInput('');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none p-4">
            <div className={`absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto transition-opacity animate-fade-in ${!isMandatory ? 'cursor-pointer' : ''}`} onClick={!isMandatory ? onClose : undefined} />
            <div className={`
                bg-white dark:bg-gray-950 w-full max-w-xl 
                ${isKeyboardOpen ? 'h-full' : 'h-full sm:h-auto sm:max-h-[92vh]'} 
                sm:rounded-[2.5rem] p-0 relative z-10 overflow-hidden flex flex-col pointer-events-auto animate-slide-up shadow-2xl 
                transition-all pt-safe pb-safe
            `}>

                {/* Header */}
                <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button onClick={onClose} className="p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-90 shadow-sm border border-gray-100 dark:border-gray-800">
                            <ArrowLeft size={22} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em] sm:tracking-[0.4em] leading-none mb-1">Account settings</h4>
                            <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                                {language === 'en' ? 'Edit Profile' : 'प्रोफाइल संपादित करें'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div
                    className="overflow-y-auto px-5 sm:px-8 pt-6 sm:pt-8 space-y-8 sm:space-y-10 custom-scrollbar flex-1"
                    style={{
                        paddingBottom: isKeyboardOpen ? 'var(--keyboard-height, 120px)' : '100px'
                    }}
                >
                    {/* Photo Uploader */}
                    <div className="flex justify-center flex-col items-center gap-4 sm:gap-6">
                        <div className="relative group/avatar">
                            <div className="w-28 h-28 sm:w-40 h-40 rounded-[2rem] sm:rounded-[3rem] bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden border-4 sm:border-8 border-white dark:border-gray-800 shadow-xl relative transition-transform active:scale-95 duration-500">
                                {editProfilePhoto ? (
                                    <img src={editProfilePhoto} className="w-full h-full object-cover" alt="Profile" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20">
                                        <UserCircle size={80} className="text-emerald-500 dark:text-emerald-400 opacity-20" />
                                    </div>
                                )}
                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-md">
                                        <Loader2 size={40} className="animate-spin mb-3 text-emerald-500" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Uploading...</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-emerald-600/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm">
                                    <Camera size={32} className="text-white mb-1" />
                                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Update Photo</span>
                                </div>
                                <input type="file" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-emerald-600 border-4 border-emerald-500 shadow-xl group-hover/avatar:rotate-12 transition-transform">
                                <Plus size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {/* Name Input */}
                        <div className="group">
                            <label className="label group-focus-within:text-primary transition-colors flex items-center gap-2">
                                <Sparkles size={14} className="opacity-50" />
                                {language === 'en' ? 'Full Name' : 'पूरा नाम'}
                            </label>
                            <input
                                value={editProfileName}
                                onChange={(e) => setEditProfileName(e.target.value)}
                                placeholder={language === 'en' ? "e.g. Rahul Kumar" : "उदा. राहुल कुमार"}
                                maxLength={50}
                                className="input text-lg"
                            />
                        </div>

                        {/* Phone & Location Row */}
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="group">
                                <label className="label group-focus-within:text-primary transition-colors">
                                    {language === 'en' ? 'Phone Number' : 'फोन नंबर'}
                                </label>
                                <input
                                    value={editProfilePhone}
                                    onChange={(e) => setEditProfilePhone(e.target.value)}
                                    placeholder="+91 XXXX-XXXXXX"
                                    maxLength={15}
                                    type="tel"
                                    className="input text-lg"
                                />
                            </div>

                            <div className="group md:col-span-2">
                                <label className="label group-focus-within:text-primary transition-colors">
                                    {language === 'en' ? 'Detailed Location' : 'विस्तृत स्थान'}
                                </label>
                                <div className="space-y-3 sm:space-y-4">
                                    {/* Search Bar */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                                                placeholder={language === 'en' ? "Search city..." : "शहर खोजें..."}
                                                className="input pr-10"
                                            />
                                            <button
                                                onClick={handleAddressSearch}
                                                className="absolute right-2 top-2 p-1.5 bg-primary/10 text-primary rounded-lg"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleGetLocation}
                                            disabled={isLocating}
                                            className="w-full sm:w-auto px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLocating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                                            {language === 'en' ? 'Locate Me' : 'मुझे ढूंढें'}
                                        </button>
                                    </div>

                                    {/* Interactive Map */}
                                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-border shadow-sm h-48 sm:h-64 relative z-0">
                                        <LeafletMap
                                            lat={newCoordinates?.lat || 20.5937} // Default to India center if null
                                            lng={newCoordinates?.lng || 78.9629}
                                            popupText={editProfileLocation || "Drag marker to set location"}
                                            editable
                                            onLocationSelect={handleMapLocationSelect}
                                            height="h-full"
                                        />
                                    </div>

                                    {/* Read-only Display of Selected Address */}
                                    <div className="px-4 py-2 bg-background/50 rounded-xl border border-dashed border-border text-xs text-text-muted font-mono break-all">
                                        📍 {editProfileLocation || "No location selected"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio Textarea */}
                        <div className="group">
                            <label className="label group-focus-within:text-primary transition-colors">
                                {language === 'en' ? 'About You' : 'परिचय'}
                            </label>
                            <textarea
                                value={editProfileBio}
                                onChange={(e) => setEditProfileBio(e.target.value)}
                                placeholder={language === 'en' ? "Tell others about your work experience..." : "अपने काम के अनुभव के बारे में बताएं..."}
                                maxLength={500}
                                className="textarea h-40 text-base"
                            />
                        </div>

                        {/* Experience & Skills */}
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="group">
                                <label className="label group-focus-within:text-primary transition-colors">
                                    {language === 'en' ? 'Experience' : 'अनुभव'}
                                </label>
                                <input
                                    value={editProfileExp}
                                    onChange={(e) => setEditProfileExp(e.target.value)}
                                    placeholder="e.g. 5 Years"
                                    maxLength={50}
                                    className="input text-lg"
                                />
                            </div>

                            <div className="group md:col-span-2">
                                <label className="label group-focus-within:text-primary transition-colors mb-3 block">
                                    {language === 'en' ? 'Your Skills (Select all that apply)' : 'आपके कौशल (लागू होने वाले चुनें)'}
                                </label>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                                    {CATEGORY_CONFIG.filter(c => c.id !== 'Other').map((category) => {
                                        const isSelected = editProfileSkills.includes(category.id);
                                        const Icon = category.icon;
                                        return (
                                            <button
                                                key={category.id}
                                                onClick={() => {
                                                    setEditProfileSkills(prev =>
                                                        prev.includes(category.id)
                                                            ? prev.filter(id => id !== category.id)
                                                            : [...prev, category.id]
                                                    );
                                                }}
                                                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 transition-all active:scale-95 ${isSelected
                                                    ? `border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-sm`
                                                    : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <Icon size={16} className={isSelected ? 'text-emerald-500' : ''} />
                                                <span className="font-bold text-[11px] sm:text-sm tracking-wide truncate">
                                                    {language === 'en' ? category.label.en : category.label.hi}
                                                </span>
                                                {isSelected && <CheckCircle size={14} className="text-emerald-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom Skills Input */}
                                <div className="mt-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                                        {language === 'en' ? 'Other Specific Skills' : 'अन्य विशिष्ट कौशल'}
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            value={customSkillInput}
                                            onChange={(e) => setCustomSkillInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddCustomSkill();
                                                }
                                            }}
                                            placeholder={language === 'en' ? "e.g. Tile Setting, Wallpaper..." : "उदा. टाइल लगाना, वॉलपेपर..."}
                                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-emerald-500/50 outline-none text-sm"
                                        />
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleAddCustomSkill(); }}
                                            className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs uppercase hover:bg-emerald-200 transition-colors"
                                        >
                                            {language === 'en' ? 'Add' : 'जोड़ें'}
                                        </button>
                                    </div>

                                    {/* Custom Chips */}
                                    <div className="flex flex-wrap gap-2">
                                        {editProfileSkills
                                            .filter(s => !CATEGORY_CONFIG.some(c => c.id === s))
                                            .map((skill, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium group border border-gray-200 dark:border-gray-700">
                                                    {skill}
                                                    <button
                                                        onClick={() => setEditProfileSkills(prev => prev.filter(p => p !== skill))}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))
                                        }
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-400 mt-2 font-medium ml-1">
                                    {language === 'en' ? '* These will be used to recommend jobs to you.' : '* इनका उपयोग आपको काम सुझाने के लिए किया जाएगा।'}
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* DANGER ZONE - Delete Account - Now inside scroll container */}
                    <div className="mt-12 p-6 rounded-[2rem] bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/20">
                        <h3 className="text-red-600 dark:text-red-400 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            {language === 'en' ? 'Danger Zone' : 'खतरा क्षेत्र'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 font-medium leading-relaxed">
                            {language === 'en'
                                ? 'Once you delete your account, there is no going back. Please be certain.'
                                : 'एक बार जब आप अपना खाता हटा देते हैं, तो वापस नहीं जा सकते। कृपया सुनिश्चित हों।'}
                        </p>
                        <button
                            onClick={async () => {
                                if (window.confirm(language === 'en' ? 'Are you sure you want to PERMANENTLY delete your account?' : 'क्या आप वाकई अपना खाता स्थायी रूप से हटाना चाहते हैं?')) {
                                    const { deleteAccount } = await import('../services/authService');
                                    setIsSaving(true);
                                    const { success, error } = await deleteAccount();
                                    if (success) {
                                        onClose();
                                        window.location.reload();
                                    } else {
                                        showAlert(error || 'Failed to delete', 'error');
                                        setIsSaving(false);
                                    }
                                }
                            }}
                            disabled={isSaving}
                            className="w-full py-4 rounded-xl bg-white dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900/50 text-red-500 font-bold text-xs uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        >
                            {isSaving ? 'Processing...' : (language === 'en' ? 'Delete Account' : 'खाता हटाएं')}
                        </button>
                    </div>
                </div>

                {/* Footer Save Button - Outside scroll container */}
                <div className="p-5 sm:p-8 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className={`w-full py-4 sm:py-6 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[11px] sm:text-xs uppercase tracking-[0.3em] shadow-xl shadow-emerald-500/20 transform transition-all active:scale-95 flex items-center justify-center gap-3 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1'}`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                <span>{language === 'en' ? 'Updating Profile...' : 'अपडेट हो रहा है...'}</span>
                            </>
                        ) : (
                            <>
                                {language === 'en' ? 'Update Profile' : 'प्रोफाइल सहेजें'} <ChevronRight size={20} strokeWidth={3} />
                            </>
                        )}
                    </button>
                    {isMandatory && (
                        <p className="text-center mt-3 text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Required to continue</p>
                    )}
                </div>
            </div>
        </div>
    );
};
