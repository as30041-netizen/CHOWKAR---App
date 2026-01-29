import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContextDB';
import { CATEGORY_CONFIG } from '../constants';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';

export const Categories: React.FC = () => {
    const navigate = useNavigate();
    const { language } = useUser();

    return (
        <div className="min-h-screen bg-background p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-surface border border-border rounded-2xl hover:bg-background transition-all active:scale-95 shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-text-primary">
                        {language === 'en' ? 'Job Categories' : 'काम की श्रेणियाँ'}
                    </h1>
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                        {language === 'en' ? 'Find work that fits you' : 'अपने अनुसार काम चुनें'}
                    </p>
                </div>
            </header>

            {/* Featured Section */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-[2.5rem] mb-8 relative overflow-hidden shadow-xl shadow-emerald-500/20">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-white/80 mb-2">
                        <Sparkles size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Explore More</span>
                    </div>
                    <h2 className="text-xl font-black text-white mb-2 leading-tight">
                        {language === 'en' ? 'Browse by Specialty' : 'विशेषज्ञता के आधार पर ब्राउज़ करें'}
                    </h2>
                    <p className="text-white/80 text-xs font-medium max-w-[80%] leading-relaxed">
                        {language === 'en'
                            ? 'Quickly jump to the exactly what you are looking for.'
                            : 'वही काम चुनें जिसे आप सबसे अच्छी तरह जानते हैं।'}
                    </p>
                </div>
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-2 gap-4">
                {CATEGORY_CONFIG.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => navigate(`/category/${cat.id}`)}
                        className="group relative flex flex-col items-center gap-4 p-6 bg-surface border-2 border-border/50 rounded-[2.5rem] hover:border-primary/30 transition-all shadow-sm active:scale-[0.98]"
                    >
                        <div className="w-16 h-16 rounded-[1.5rem] bg-background flex items-center justify-center text-text-muted group-hover:text-primary group-hover:bg-primary/5 transition-all shadow-inner">
                            {React.createElement(cat.icon, { size: 32, strokeWidth: 1.5 })}
                        </div>

                        <div className="text-center">
                            <h3 className="text-sm font-black text-text-primary mb-1">
                                {cat.label[language]}
                            </h3>
                            <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                                <span>View Jobs</span>
                                <ChevronRight size={10} />
                            </div>
                        </div>

                        {/* Subtle Glow Effect */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-50 transition-transform origin-center rounded-full" />
                    </button>
                ))}
            </div>

            {/* Footer Badge */}
            <div className="mt-12 text-center pb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/5 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Sparkles size={12} /> Personalized For You
                </div>
            </div>
        </div>
    );
};
