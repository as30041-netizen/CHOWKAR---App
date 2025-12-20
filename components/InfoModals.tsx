import React from 'react';
import { X, Shield, Users, FileText, AlertTriangle } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon: React.ElementType;
}

const InfoBaseModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, icon: Icon }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 animate-pop shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Icon size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                </div>
                <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const SafetyTipsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => (
    <InfoBaseModal {...props} title="Safety Guidelines" icon={Shield}>
        <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2"><AlertTriangle size={18} /> Vital Rule</h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">Never share OTPs or passwords with anyone. CHOWKAR support will never ask for them.</p>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-4">For Workers</h3>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Verify Location:</strong> Always check the job location on the map before accepting.</li>
                <li><strong>Public Places:</strong> For the first meeting, prefer public or well-known locations.</li>
                <li><strong>Payment Agreement:</strong> Clarify payment terms (hourly/daily) <em>before</em> starting work.</li>
                <li><strong>Emergency Contact:</strong> Keep a family member informed about your work location.</li>
            </ul>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-4">For Employers</h3>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>ID Check:</strong> You have the right to ask for a government ID (Aadhaar/Voter ID) for verification.</li>
                <li><strong>Clear Instructions:</strong> Be precise about the work to avoid disputes later.</li>
                <li><strong>Fair Treatment:</strong> Provide water and basic amenities if the work is long-duration.</li>
            </ul>
        </div>
    </InfoBaseModal>
);

export const CommunityGuidelinesModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => (
    <InfoBaseModal {...props} title="Community Guidelines" icon={Users}>
        <div className="space-y-4">
            <p>CHOWKAR is built on trust. To keep this community safe and helpful, please follow these rules:</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Respect Everyone</h4>
                    <p className="text-sm">No abusive language, discrimination, or harassment. Treat everyone with dignity.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Be Reliable</h4>
                    <p className="text-sm">If you accept a job, show up. If you hire someone, pay firmly and on time.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Honest Reviews</h4>
                    <p className="text-sm">Leave genuine ratings. Do not use ratings as a bargaining tool.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">No Illegal Work</h4>
                    <p className="text-sm">Posting or soliciting illegal activities will result in an immediate ban.</p>
                </div>
            </div>
        </div>
    </InfoBaseModal>
);

export const TermsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => (
    <InfoBaseModal {...props} title="Terms of Service" icon={FileText}>
        <div className="space-y-4 text-sm">
            <p><strong>Last Updated: Dec 2024</strong></p>
            <p>By using CHOWKAR, you agree to these simplified terms:</p>
            <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Platform Role:</strong> CHOWKAR is an intermediary connecting Workers and Posters. We are not responsible for the quality of work or conduct of users, though we strive to ensure safety.</li>
                <li><strong>Payments:</strong> All payments are made directly between users or via our secure wallet. CHOWKAR is not liable for cash disputes.</li>
                <li><strong>Data Privacy:</strong> We collect location and phone data to provide services. We do not sell your personal data to third-party ad networks.</li>
                <li><strong>Termination:</strong> We reserve the right to ban users who violate our Community Guidelines.</li>
            </ol>
            <p className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-100 dark:border-yellow-800">
                This contains a summary. For full legal text, please contact legal@chowkar.in
            </p>
        </div>
    </InfoBaseModal>
);
