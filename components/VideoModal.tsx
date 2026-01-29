
import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface VideoModalProps {
    src: string;
    title?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ src, title, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Content */}
            <div
                className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col animate-scale-in"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-start pointer-events-none">
                    {title && (
                        <h3 className="text-white font-bold text-shadow-sm px-2 pointer-events-auto">
                            {title}
                        </h3>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors pointer-events-auto backdrop-blur-sm"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Video Player */}
                <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                    <video
                        src={src}
                        controls
                        autoPlay
                        className="w-full h-full object-contain"
                        controlsList="nodownload"
                        playsInline
                        onEnded={onClose}
                    />
                </div>
            </div>
        </div>
    );
};
