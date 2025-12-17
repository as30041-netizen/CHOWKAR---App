import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height
}) => {
    const baseClasses = "animate-pulse bg-gray-200 rounded";
    const variantClasses = {
        text: "h-4 w-full rounded",
        circular: "rounded-full",
        rectangular: "rounded-md"
    };

    const style = {
        width: width,
        height: height
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

export const JobCardSkeleton: React.FC = () => {
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                    <Skeleton variant="text" width="60%" className="h-6" />
                    <Skeleton variant="text" width="40%" className="h-4" />
                </div>
                <Skeleton variant="circular" width={40} height={40} />
            </div>

            {/* Tags */}
            <div className="flex gap-2">
                <Skeleton variant="rectangular" width={60} height={24} className="rounded-full" />
                <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Skeleton variant="text" />
                <Skeleton variant="text" width="90%" />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-2">
                <Skeleton variant="rectangular" width={80} height={32} className="rounded-lg" />
                <Skeleton variant="rectangular" width={100} height={40} className="rounded-xl" />
            </div>
        </div>
    );
};
