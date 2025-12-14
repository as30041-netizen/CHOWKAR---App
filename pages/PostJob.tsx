import React from 'react';
import { JobPostingForm } from '../components/JobPostingForm';
import { useNavigate } from 'react-router-dom';

export const PostJob: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="pb-24">
            <JobPostingForm onSuccess={() => navigate('/')} />
        </div>
    );
};
