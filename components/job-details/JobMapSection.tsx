import React from 'react';
import { Job } from '../../types';
import { LeafletMap } from '../LeafletMap';
import { Navigation } from 'lucide-react';

interface JobMapSectionProps {
    liveJob: Job;
    language: string;
}

export const JobMapSection: React.FC<JobMapSectionProps> = ({ liveJob, language }) => {
    if (!liveJob.coordinates) return null;

    return (
        <div className="space-y-4">
            <h4 className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] flex items-center gap-3">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                {language === 'en' ? 'Job Location' : 'कार्य का स्थान'}
            </h4>
            <div className="relative rounded-[2.8rem] overflow-hidden border-4 border-white dark:border-gray-900 h-72 shadow-2xl group/map z-0">
                <LeafletMap lat={liveJob.coordinates.lat} lng={liveJob.coordinates.lng} popupText={liveJob.location} />
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none flex justify-end">
                    <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${liveJob.coordinates.lat},${liveJob.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all pointer-events-auto"
                    >
                        <Navigation size={14} fill="currentColor" /> {language === 'en' ? 'Get Directions' : 'दिशा निर्देश'}
                    </a>
                </div>
            </div>
        </div>
    );
};
