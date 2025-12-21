import React, { useState, useEffect } from 'react';
import { UserCircle, Loader2 } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { uploadProfileImage, isBase64Image } from '../services/storageService';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, showAlert }) => {
    const { user, updateUserInDB, addNotification, t, language } = useUser();

    const [editProfileName, setEditProfileName] = useState('');
    const [editProfilePhone, setEditProfilePhone] = useState('');
    const [editProfileLocation, setEditProfileLocation] = useState('');
    const [editProfileBio, setEditProfileBio] = useState('');
    const [editProfileExp, setEditProfileExp] = useState('');
    const [editProfileSkills, setEditProfileSkills] = useState('');
    const [editProfilePhoto, setEditProfilePhoto] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
        // Validation
        if (!editProfileName.trim()) {
            showAlert(language === 'en' ? 'Name is required' : 'नाम आवश्यक है', 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Upload photo to Supabase Storage if it's base64
            let finalPhotoUrl = editProfilePhoto;
            if (editProfilePhoto && isBase64Image(editProfilePhoto)) {
                setIsUploadingPhoto(true);
                const rawBase64 = editProfilePhoto.split(',')[1];
                const { url, error: uploadError } = await uploadProfileImage(rawBase64, user.id);
                setIsUploadingPhoto(false);

                if (url) {
                    finalPhotoUrl = url;
                } else {
                    console.warn('Profile photo upload failed:', uploadError);
                    // Continue with old photo or empty
                    finalPhotoUrl = user.profilePhoto || '';
                }
            }

            const updates = {
                name: editProfileName.trim(),
                phone: editProfilePhone.trim(),
                location: editProfileLocation.trim(),
                bio: editProfileBio.trim(),
                experience: editProfileExp.trim(),
                skills: editProfileSkills.split(',').map(s => s.trim()).filter(s => s),
                profilePhoto: finalPhotoUrl
            };

            await updateUserInDB(updates);
            onClose();
            await addNotification(user.id, t.notifProfileUpdated, t.notifProfileUpdatedBody, "SUCCESS");
            showAlert(t.notifProfileUpdated, 'success');
        } catch {
            showAlert('Failed to update profile.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Resize and compress image before setting
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400;  // Profile photos are smaller
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-6 relative z-10 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 dark:text-white">
                    {language === 'en' ? 'Edit Profile' : 'प्रोफाइल संपादित करें'}
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-center mb-4">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
                            {editProfilePhoto ? (
                                <img src={editProfilePhoto} className="w-full h-full object-cover" alt="Profile" />
                            ) : (
                                <UserCircle size={40} className="text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                            {isUploadingPhoto && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 size={24} className="text-white animate-spin" />
                                </div>
                            )}
                            <input type="file" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </div>
                    </div>
                    <input
                        value={editProfileName}
                        onChange={(e) => setEditProfileName(e.target.value)}
                        placeholder={language === 'en' ? "Name" : "नाम"}
                        maxLength={50}
                        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <input
                        value={editProfilePhone}
                        onChange={(e) => setEditProfilePhone(e.target.value)}
                        placeholder={language === 'en' ? "Phone" : "फोन"}
                        maxLength={15}
                        type="tel"
                        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <input
                        value={editProfileLocation}
                        onChange={(e) => setEditProfileLocation(e.target.value)}
                        placeholder={language === 'en' ? "Location" : "स्थान"}
                        maxLength={100}
                        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <textarea
                        value={editProfileBio}
                        onChange={(e) => setEditProfileBio(e.target.value)}
                        placeholder={language === 'en' ? "Bio" : "परिचय"}
                        maxLength={500}
                        className="w-full p-3 rounded-xl border h-20 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <input
                        value={editProfileExp}
                        onChange={(e) => setEditProfileExp(e.target.value)}
                        placeholder={language === 'en' ? "Experience (e.g. 5 years)" : "अनुभव (जैसे 5 साल)"}
                        maxLength={50}
                        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <input
                        value={editProfileSkills}
                        onChange={(e) => setEditProfileSkills(e.target.value)}
                        placeholder={language === 'en' ? "Skills (comma separated)" : "कौशल (कॉमा से अलग)"}
                        maxLength={200}
                        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {language === 'en' ? 'Saving...' : 'सहेज रहा...'}
                            </>
                        ) : (
                            language === 'en' ? 'Save Changes' : 'बदलाव सहेजें'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
