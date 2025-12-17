import React from 'react';
import { JobPostingForm } from '../components/JobPostingForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { Job } from '../types';

export const PostJob: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get job to edit from navigation state
    const jobToEdit = location.state?.jobToEdit as Job | undefined;

    return (
        <div className="pb-24">
            <JobPostingForm
                onSuccess={() => navigate('/')}
                initialJob={jobToEdit}
            />
        </div>
    );
};
