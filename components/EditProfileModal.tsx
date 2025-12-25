import React, { useState, useEffect } from 'react';
import { UserCircle, Loader2, MapPin } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { uploadProfileImage, isBase64Image } from '../services/storageService';
import { getDeviceLocation } from '../utils/geo';
import { supabase } from '../lib/supabase';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
    isMandatory?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, showAlert, isMandatory = false }) => {
    const { user, updateUserInDB, addNotification, t, language } = useUser();

    const [editProfileName, setEditProfileName] = useState('');
    const [editProfilePhone, setEditProfilePhone] = useState('');
    const [editProfileLocation, setEditProfileLocation] = useState('');
    const [editProfileBio, setEditProfileBio] = useState('');
    const [editProfileExp, setEditProfileExp] = useState('');
    const [editProfileSkills, setEditProfileSkills] = useState('');
    const [editProfilePhoto, setEditProfilePhoto] = useState('');
    const [referralCodeInput, setReferralCodeInput] = useState('');
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
        // Validation
        if (!editProfileName.trim()) {
            showAlert(language === 'en' ? 'Name is required' : 'नाम आवश्यक है', 'error');
            return;
        }

        // Validate strictly for MANDATORY fields if user expects app to function
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
            console.log('Starting profile save...');
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

            // Handle Referral Code (if entered and not already referred)
            let referrerId = null;
            if (referralCodeInput.trim() && !user.referredBy) {
                const code = referralCodeInput.trim().toUpperCase();

                // check if it is own code
                if (user.referralCode === code) {
                    showAlert(language === 'en' ? 'You cannot use your own referral code' : 'आप अपने खुद के रेफरल कोड का उपयोग नहीं कर सकते', 'error');
                    setIsSaving(false);
                    return;
                }

                // Verify code existence
                const { data: referrer, error: refError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('referral_code', code)
                    .single();

                if (refError || !referrer) {
                    showAlert(language === 'en' ? 'Invalid Referral Code' : 'अमान्य रेफरल कोड', 'error');
                    setIsSaving(false);
                    return;
                }

                referrerId = referrer.id;
            }

            // Add referral ID to updates if found
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

            if (referrerId) {
                updates.referredBy = referrerId;
            }

            await updateUserInDB(updates);

            // Send specific notification for referral success
            if (referrerId) {
                addNotification(user.id, "Referral Applied!", language === 'en' ? "Welcome bonus applied." : "वेलकम बोनस लागू किया गया।", "SUCCESS");
            }


            onClose();
            // Fire and forget notification so UI doesn't hang on network
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

    const handleGetLocation = () => {
        setIsLocating(true);
        getDeviceLocation(
            (coords) => {
                setNewCoordinates(coords);
                // Reverse Geocode using OpenStreetMap (Nominatim)
                // Note: In production, consider rate limits or a commercial API
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
                    .then(res => res.json())
                    .then(data => {
                        const addressParts = [];
                        if (data.address.village) addressParts.push(data.address.village);
                        else if (data.address.town) addressParts.push(data.address.town);
                        else if (data.address.city) addressParts.push(data.address.city);
                        else if (data.address.suburb) addressParts.push(data.address.suburb);

                        if (data.address.state) addressParts.push(data.address.state);

                        const fullLoc = addressParts.length > 0 ? addressParts.join(', ') : `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;

                        setEditProfileLocation(fullLoc);
                        setIsLocating(false);
                        showAlert(language === 'en' ? "Location updated from GPS!" : "GPS से स्थान अपडेट किया गया!", "success");
                    })
                    .catch(e => {
                        console.error('Geocoding error:', e);
                        setEditProfileLocation(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                        setIsLocating(false);
                        showAlert(language === 'en' ? "Location captured (GPS)" : "स्थान कैप्चर किया गया (GPS)", "success");
                    });
            },
            () => {
                showAlert(language === 'en' ? "Could not get location. Check permissions." : "स्थान प्राप्त नहीं कर सके। अनुमति जांचें।", "error");
                setIsLocating(false);
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${!isMandatory ? 'cursor-pointer' : ''}`} onClick={!isMandatory ? onClose : undefined}></div>
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
                    <div className="relative">
                        <input
                            value={editProfileLocation}
                            onChange={(e) => setEditProfileLocation(e.target.value)}
                            placeholder={language === 'en' ? "Location (City/Village)" : "स्थान (शहर/गाँव)"}
                            maxLength={100}
                            className="w-full p-3 pr-12 rounded-xl border dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900"
                        />
                        <button
                            onClick={handleGetLocation}
                            disabled={isLocating}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                            title={language === 'en' ? "Use Current Location" : "वर्तमान स्थान का उपयोग करें"}
                        >
                            {isLocating ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
                        </button>
                    </div>
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

                    {/* Referral Code Input (Only if not already referred) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                            {language === 'en' ? 'Referral Code (Optional)' : 'रेफरल कोड (वैकल्पिक)'}
                        </label>
                        {user.referredBy ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                ✅ {language === 'en' ? 'Referred by a friend' : 'मित्र द्वारा रेफर किया गया'}
                            </p>
                        ) : (
                            <input
                                value={referralCodeInput}
                                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                                placeholder="USER123"
                                maxLength={10}
                                className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 font-mono tracking-widest text-center uppercase"
                            />
                        )}
                        {!user.referredBy && (
                            <p className="text-[10px] text-gray-400 mt-1 text-center">
                                {language === 'en' ? 'Enter code to verify and support your friend!' : 'अपने दोस्त का अनुरोध स्वीकार करने के लिए कोड डालें!'}
                            </p>
                        )}
                    </div>
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
