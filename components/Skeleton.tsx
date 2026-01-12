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
    const baseClasses = "animate-pulse bg-gray-100 dark:bg-gray-800 rounded-3xl";
    const variantClasses = {
        text: "h-4 w-full",
        circular: "rounded-full",
        rectangular: "rounded-[2.5rem]"
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
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border-4 border-white dark:border-gray-800 shadow-glass space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="space-y-3 flex-1">
                    <Skeleton variant="text" width="70%" className="h-8" />
                    <Skeleton variant="text" width="40%" className="h-5" />
                </div>
                <Skeleton variant="rectangular" width={64} height={64} className="rounded-2xl" />
            </div>

            {/* Tags */}
            <div className="flex gap-3">
                <Skeleton variant="rectangular" width={100} height={32} className="rounded-full" />
                <Skeleton variant="rectangular" width={120} height={32} className="rounded-full" />
            </div>

            {/* Description */}
            <div className="space-y-3">
                <Skeleton variant="text" className="h-4" />
                <Skeleton variant="text" width="92%" className="h-4" />
                <Skeleton variant="text" width="85%" className="h-4" />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4">
                <div className="space-y-2">
                    <Skeleton variant="text" width={60} className="h-4" />
                    <Skeleton variant="text" width={100} className="h-8" />
                </div>
                <Skeleton variant="rectangular" width={140} height={56} className="rounded-[1.5rem]" />
            </div>
        </div>
    );
};
