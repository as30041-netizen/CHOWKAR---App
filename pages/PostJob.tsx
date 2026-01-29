import React from 'react';
import { JobPostingForm } from '../components/JobPostingForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContextDB';
import { supabase } from '../lib/supabase';
import { Job } from '../types';

export const PostJob: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get job to edit from navigation state
    const jobToEdit = location.state?.jobToEdit as Job | undefined;

    const [isLoading, setIsLoading] = React.useState(true);
    const { user, showSubscriptionModal, setShowSubscriptionModal, showAlert } = useUser();

    React.useEffect(() => {
        const checkLimits = async () => {
            if (jobToEdit) {
                setIsLoading(false);
                return; // Editing doesn't count against limit
            }

            // Optimization: If user has SUPER or PRO_POSTER, they are unlimited for posting
            if (user.subscription_plan === 'SUPER' || user.subscription_plan === 'PRO_POSTER') {
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase.rpc('check_subscription_policy', {
                p_user_id: user.id,
                p_action: 'POST_JOB'
            });

            if (data && data.allowed === false) {
                showAlert('You have reached your monthly free job posting limit.', 'error');
                setShowSubscriptionModal(true);
                navigate('/'); // Redirect back to home
            }
            setIsLoading(false);
        };

        if (user.id) checkLimits();
    }, [user.id, jobToEdit]);

    if (isLoading) return <div className="pt-20 text-center">Checking plan limits...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-24 md:pb-12 pt-6">
            <JobPostingForm
                onSuccess={() => navigate('/')}
                onCancel={() => navigate('/')}
                initialJob={jobToEdit}
            />
        </div>
    );
};
