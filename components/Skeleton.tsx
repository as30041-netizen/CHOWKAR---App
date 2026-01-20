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
        <div className="bg-surface dark:bg-gray-900 p-5 md:p-6 rounded-squircle border border-border shadow-sm space-y-5 animate-pulse">
            {/* Header Area */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-3 pt-1">
                    {/* Badges placeholder */}
                    <div className="flex gap-2">
                        <div className="h-4 bg-background dark:bg-gray-800 rounded-lg w-24"></div>
                        <div className="h-4 bg-background dark:bg-gray-800 rounded-lg w-20"></div>
                    </div>
                    {/* Title placeholder */}
                    <div className="space-y-2">
                        <div className="h-5 bg-background dark:bg-gray-800 rounded-full w-4/5"></div>
                        <div className="h-5 bg-background dark:bg-gray-800 rounded-full w-2/3"></div>
                    </div>
                </div>
                {/* Category Icon placeholder */}
                <div className="w-12 h-12 bg-background dark:bg-gray-800 rounded-2xl shrink-0"></div>
            </div>

            {/* Price Pill placeholder (Mobile floating style) */}
            <div className="flex justify-between items-center bg-background/30 p-2 rounded-2xl border border-border/50">
                <div className="flex items-center gap-2 pl-2">
                    <div className="w-4 h-4 rounded-full bg-background dark:bg-gray-800"></div>
                    <div className="h-3 bg-background dark:bg-gray-800 rounded-full w-16"></div>
                </div>
                <div className="w-20 h-10 bg-background dark:bg-gray-800 rounded-xl"></div>
            </div>

            {/* Metadata Pills placeholder */}
            <div className="flex flex-wrap gap-2">
                <div className="h-8 bg-background dark:bg-gray-800 rounded-xl w-24"></div>
                <div className="h-8 bg-background dark:bg-gray-800 rounded-xl w-32"></div>
            </div>
        </div>
    );
};

export const ProfileSkeleton: React.FC = () => {
    return (
        <div className="animate-pulse space-y-8">
            <div className="h-56 bg-gray-200 dark:bg-gray-800 rounded-3xl w-full" />
            <div className="px-8 -mt-20 flex flex-col items-center relative z-10">
                <div className="w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-[1.25rem] border-4 border-surface shadow-xl mb-4" />
                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-full w-48 mb-2" />
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full w-32" />
            </div>
        </div>
    );
};

export const ListSkeleton: React.FC = () => {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4 items-center p-4 bg-surface rounded-2xl border border-border">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-full w-1/3" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-full w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
};
