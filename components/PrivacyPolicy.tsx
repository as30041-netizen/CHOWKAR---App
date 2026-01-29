
import React from 'react';
import { ArrowLeft, Shield, MapPin, Camera, Bell, Lock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Shield className="text-emerald-500" size={24} />
                        Privacy Policy
                    </h1>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 py-8">

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                        <strong>Last Updated:</strong> January 29, 2026
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Welcome to <strong>Chowkar</strong> ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a safe experience finding local work or hiring helpers. This Privacy Policy explains how we collect, use, and safeguard your information.
                    </p>

                    <h2 className="text-2xl font-bold mb-4 mt-8 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <UserCheck size={24} />
                        1. Information We Collect
                    </h2>
                    <ul className="list-disc pl-6 space-y-3 text-gray-600 dark:text-gray-300">
                        <li><strong>Account Information:</strong> When you sign up, we collect your phone number and name to create your identity.</li>
                        <li><strong>Profile Data:</strong> You may choose to provide a profile photo, bio, skills, and experience details.</li>
                        <li><strong>User Content:</strong> Job postings, bids, ratings, and reviews you submit to the platform.</li>
                    </ul>

                    <h2 className="text-2xl font-bold mb-4 mt-10 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Lock size={24} />
                        2. How We Use App Permissions
                    </h2>
                    <p className="mb-4 text-gray-600 dark:text-gray-300">
                        To provide our services, the Chowkar app requests specific permissions on your device. Here is why we need them:
                    </p>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm h-fit">
                                <MapPin className="text-blue-500" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold mb-1">Location (Coarse & Fine)</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    We use your location to show you jobs or workers <strong>in your specific district or neighborhood</strong>. Location data is used to calculate distance matches and is stored securely.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm h-fit">
                                <Camera className="text-purple-500" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold mb-1">Camera & Photos</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Required only if you wish to <strong>upload a profile picture</strong> or attach images to a job posting (e.g., photo of work to be done).
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm h-fit">
                                <Bell className="text-amber-500" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold mb-1">Notifications</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    We send push notifications to alert you about <strong>new bids, job acceptances, and chat messages</strong>. You can manage these in settings.
                                </p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-4 mt-10 text-gray-900 dark:text-white">
                        3. Data Sharing & Safety
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        <strong>We do not sell your personal data.</strong> Your information is shared only in the following scenarios:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-300">
                        <li><strong>Between Users:</strong> When a job is accepted, the Employer and Worker can see each other's phone number and location to coordinate the work.</li>
                        <li><strong>Service Providers:</strong> We use secure services like Supabase (for database) and Google Firebase (for notifications).</li>
                        <li><strong>Legal Requirements:</strong> If required by Indian law or law enforcement agencies.</li>
                    </ul>

                    <h2 className="text-2xl font-bold mb-4 mt-10 text-gray-900 dark:text-white">
                        4. Account Deletion
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        You have the right to delete your account and all associated data at any time.
                        You can do this by navigating to <strong>Profile &gt; Settings &gt; Delete Account</strong> within the app, or by contacting our support team.
                    </p>

                    <h2 className="text-2xl font-bold mb-4 mt-10 text-gray-900 dark:text-white">
                        5. Contact Us
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        If you have any questions about this privacy policy, please contact us at:<br />
                        <strong>support@chowkar.in</strong>
                    </p>
                </div>

            </main>
        </div>
    );
};
