import React, { useState, useEffect } from 'react';
import { UserCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    showAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, showAlert }) => {
    const { user, updateUserInDB, addNotification, t } = useUser();

    const [editProfileName, setEditProfileName] = useState('');
    const [editProfilePhone, setEditProfilePhone] = useState('');
    const [editProfileLocation, setEditProfileLocation] = useState('');
    const [editProfileBio, setEditProfileBio] = useState('');
    const [editProfileExp, setEditProfileExp] = useState('');
    const [editProfileSkills, setEditProfileSkills] = useState('');
    const [editProfilePhoto, setEditProfilePhoto] = useState('');

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
        try {
            const updates = {
                name: editProfileName,
                phone: editProfilePhone,
                location: editProfileLocation,
                bio: editProfileBio,
                experience: editProfileExp,
                skills: editProfileSkills.split(',').map(s => s.trim()).filter(s => s),
                profilePhoto: editProfilePhoto
            };
            await updateUserInDB(updates);
            onClose();
            await addNotification(user.id, t.notifProfileUpdated, t.notifProfileUpdatedBody, "SUCCESS");
            showAlert(t.notifProfileUpdated, 'success');
        } catch {
            showAlert('Failed to update profile.', 'error');
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setEditProfilePhoto(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-3xl p-6 relative z-10 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Edit Profile</h3>
                <div className="space-y-3">
                    <div className="flex justify-center mb-4">
                        <div className="w-24 h-24 bg-gray-100 rounded-full overflow-hidden relative">
                            {editProfilePhoto ? <img src={editProfilePhoto} className="w-full h-full object-cover" /> : <UserCircle size={40} className="text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                            <input type="file" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </div>
                    </div>
                    <input value={editProfileName} onChange={(e) => setEditProfileName(e.target.value)} placeholder="Name" className="w-full p-3 rounded-xl border" />
                    <input value={editProfilePhone} onChange={(e) => setEditProfilePhone(e.target.value)} placeholder="Phone" className="w-full p-3 rounded-xl border" />
                    <input value={editProfileLocation} onChange={(e) => setEditProfileLocation(e.target.value)} placeholder="Location" className="w-full p-3 rounded-xl border" />
                    <textarea value={editProfileBio} onChange={(e) => setEditProfileBio(e.target.value)} placeholder="Bio" className="w-full p-3 rounded-xl border h-20" />
                    <input value={editProfileExp} onChange={(e) => setEditProfileExp(e.target.value)} placeholder="Experience (e.g. 5 years)" className="w-full p-3 rounded-xl border" />
                    <input value={editProfileSkills} onChange={(e) => setEditProfileSkills(e.target.value)} placeholder="Skills (comma separated)" className="w-full p-3 rounded-xl border" />
                    <button onClick={handleSaveProfile} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Save Changes</button>
                </div>
            </div>
        </div>
    );
};
