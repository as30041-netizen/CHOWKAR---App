import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface SkillNudgeCardProps {
    onClick: () => void;
}

export const SkillNudgeCard: React.FC<SkillNudgeCardProps> = ({ onClick }) => {
    const { user, language } = useUser();

    // Only show if user has no skills (undefined or empty array)
    if (user.skills && user.skills.length > 0) return null;

    return (
        <div className="px-6 mb-6">
            <div
                onClick={onClick}
                className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 to-indigo-600 p-6 shadow-xl shadow-indigo-500/20 cursor-pointer group transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30"
            >
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-black/10 rounded-full blur-xl" />

                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest mb-3">
                            <Sparkles size={12} className="text-yellow-300 animate-pulse" />
                            {language === 'en' ? 'Get Matched' : 'मैच प्राप्त करें'}
                        </div>
                        <h3 className="text-white font-black text-xl leading-title mb-2">
                            {language === 'en' ? 'Personalize your feed' : 'अपनी फीड को निजीकृत करें'}
                        </h3>
                        <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                            {language === 'en'
                                ? 'Add your skills to see jobs picked just for you.'
                                : 'अपने लिए चुने गए काम देखने के लिए अपने कौशल जोड़ें।'}
                        </p>
                    </div>

                    <div className="h-12 w-12 rounded-full bg-white text-indigo-600 flex items-center justify-center shrink-0 shadow-lg group-hover:rotate-45 transition-transform duration-300">
                        <ArrowRight size={24} strokeWidth={3} />
                    </div>
                </div>
            </div>
        </div>
    );
};
