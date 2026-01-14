import React, { useState, useEffect } from 'react';
import { UserCircle, Loader2, MapPin, ArrowLeft, Camera, Plus, ChevronRight, Gift, CheckCircle2 as CheckCircle, Sparkles } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useNotification } from '../contexts/NotificationContext';
import { uploadProfileImage, isBase64Image } from '../services/storageService';
import { getDeviceLocation, reverseGeocode, forwardGeocode } from '../utils/geo';
import { LeafletMap } from './LeafletMap';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    isMandatory?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, showAlert, isMandatory = false }) => {
    const { user, updateUserInDB, t, language } = useUser();
    const { addNotification } = useNotification();


    const [editProfileName, setEditProfileName] = useState('');
    const [editProfilePhone, setEditProfilePhone] = useState('');
    const [editProfileLocation, setEditProfileLocation] = useState('');
    const [editProfileBio, setEditProfileBio] = useState('');
    const [editProfileExp, setEditProfileExp] = useState('');
    const [editProfileSkills, setEditProfileSkills] = useState('');
    const [editProfilePhoto, setEditProfilePhoto] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [newCoordinates, setNewCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen && user) {
            setEditProfileName(user.name || '');
            setEditProfilePhone(user.phone || '');
            setEditProfileLocation(user.location || '');
            setEditProfileBio(user.bio || '');
            setEditProfileExp(user.experience || '');
            setEditProfileSkills(user.skills?.join(', ') || '');
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
                skills: editProfileSkills.split(',').map(s => s.trim()).filter(s => s),
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

    const [searchQuery, setSearchQuery] = useState('');

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

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none p-4">
            <div className={`absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto transition-opacity animate-fade-in ${!isMandatory ? 'cursor-pointer' : ''}`} onClick={!isMandatory ? onClose : undefined} />
            <div className="bg-white dark:bg-gray-950 w-full max-w-xl rounded-[3rem] p-0 relative z-10 max-h-[95vh] overflow-hidden flex flex-col pointer-events-auto animate-slide-up shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] transition-all pb-safe border-4 border-white/20 dark:border-gray-800/50">

                {/* Header */}
                <div className="px-8 pt-4 pb-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl sticky top-0 z-20">
                    <button onClick={onClose} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-90 shadow-sm border border-gray-100 dark:border-gray-800 group">
                        <ArrowLeft size={24} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                        <div>
                            <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] leading-none mb-1">Account settings</h4>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                                {language === 'en' ? 'Edit Profile' : 'प्रोफाइल संपादित करें'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {/* Photo Uploader */}
                    <div className="flex justify-center flex-col items-center gap-6">
                        <div className="relative group/avatar">
                            <div className="w-40 h-40 rounded-[3rem] bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden border-8 border-white dark:border-gray-800 shadow-2xl relative transition-transform group-hover/avatar:scale-105 duration-700">
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

                    <div className="grid gap-8">
                        {/* Name Input */}
                        <div className="space-y-3 group">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-emerald-500 transition-colors">
                                <Sparkles size={14} className="opacity-50" />
                                {language === 'en' ? 'Full Name' : 'पूरा नाम'}
                            </label>
                            <input
                                value={editProfileName}
                                onChange={(e) => setEditProfileName(e.target.value)}
                                placeholder={language === 'en' ? "e.g. Rahul Kumar" : "उदा. राहुल कुमार"}
                                maxLength={50}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-6 py-5 text-lg font-black text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                            />
                        </div>

                        {/* Phone & Location Row */}
                        <div className="grid sm:grid-cols-2 gap-8">
                            <div className="space-y-3 group">
                                <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 group-focus-within:text-emerald-500 transition-colors">
                                    {language === 'en' ? 'Phone Number' : 'फोन नंबर'}
                                </label>
                                <input
                                    value={editProfilePhone}
                                    onChange={(e) => setEditProfilePhone(e.target.value)}
                                    placeholder="+91 XXXX-XXXXXX"
                                    maxLength={15}
                                    type="tel"
                                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-6 py-5 text-lg font-black text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                                />
                            </div>

                            <div className="space-y-3 group md:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 group-focus-within:text-emerald-500 transition-colors">
                                    {language === 'en' ? 'Detailed Location' : 'विस्तृत स्थान'}
                                </label>
                                <div className="space-y-4">
                                    {/* Search Bar */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                                                placeholder={language === 'en' ? "Search city..." : "शहर खोजें..."}
                                                className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all"
                                            />
                                            <button
                                                onClick={handleAddressSearch}
                                                className="absolute right-2 top-2 p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleGetLocation}
                                            disabled={isLocating}
                                            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {isLocating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                                            {language === 'en' ? 'Locate Me' : 'मुझे ढूंढें'}
                                        </button>
                                    </div>

                                    {/* Interactive Map */}
                                    <div className="rounded-3xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-sm h-64 relative z-0">
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
                                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-xs text-gray-500 font-mono break-all">
                                        📍 {editProfileLocation || "No location selected"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio Textarea */}
                        <div className="space-y-3 group">
                            <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 group-focus-within:text-emerald-500 transition-colors">
                                {language === 'en' ? 'About You' : 'परिचय'}
                            </label>
                            <textarea
                                value={editProfileBio}
                                onChange={(e) => setEditProfileBio(e.target.value)}
                                placeholder={language === 'en' ? "Tell others about your work experience..." : "अपने काम के अनुभव के बारे में बताएं..."}
                                maxLength={500}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-[2.5rem] px-8 py-6 text-lg font-medium text-gray-700 dark:text-gray-200 outline-none focus:border-emerald-500/30 transition-all shadow-glass h-40 resize-none leading-relaxed"
                            />
                        </div>

                        {/* Experience & Skills */}
                        <div className="grid sm:grid-cols-2 gap-8">
                            <div className="space-y-3 group">
                                <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 group-focus-within:text-emerald-500 transition-colors">
                                    {language === 'en' ? 'Experience' : 'अनुभव'}
                                </label>
                                <input
                                    value={editProfileExp}
                                    onChange={(e) => setEditProfileExp(e.target.value)}
                                    placeholder="e.g. 5 Years"
                                    maxLength={50}
                                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-6 py-5 text-lg font-black text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                                />
                            </div>

                            <div className="space-y-3 group">
                                <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 group-focus-within:text-emerald-500 transition-colors">
                                    {language === 'en' ? 'Skills' : 'कौशल'}
                                </label>
                                <input
                                    value={editProfileSkills}
                                    onChange={(e) => setEditProfileSkills(e.target.value)}
                                    placeholder="e.g. Cleaning, Painting"
                                    maxLength={200}
                                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-4 border-white dark:border-gray-800 rounded-3xl px-6 py-5 text-lg font-black text-gray-900 dark:text-white outline-none focus:border-emerald-500/30 transition-all shadow-glass"
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* DANGER ZONE - Delete Account */}
                <div className="mx-8 mt-12 p-6 rounded-[2rem] bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/20">
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

                {/* Footer Save Button */}
                <div className="p-8 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shrink-0">
                    <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className={`w-full py-6 rounded-[2rem] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-emerald-500/30 transform transition-all active:scale-95 flex items-center justify-center gap-3 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1'}`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                <span>{language === 'en' ? 'Updating Profile...' : 'अपडेट हो रहा है...'}</span>
                            </>
                        ) : (
                            <>
                                {language === 'en' ? 'Update Profile' : 'प्रोफाइल सहेजें'} <ChevronRight size={22} strokeWidth={3} />
                            </>
                        )}
                    </button>
                    {isMandatory && (
                        <p className="text-center mt-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Required to continue</p>
                    )}
                </div>
            </div>
        </div >
    );
};
