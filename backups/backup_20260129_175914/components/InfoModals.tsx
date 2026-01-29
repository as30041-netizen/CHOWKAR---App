import React from 'react';
import { ArrowLeft, X, Shield, Users, FileText, AlertTriangle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon: React.ElementType;
}

const InfoBaseModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, icon: Icon }) => {
    const { t } = useUser();

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-950 rounded-[3rem] p-8 md:p-12 animate-slide-up shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] border-4 border-white/20 dark:border-gray-800/50 max-h-[90vh] flex flex-col transition-all pb-safe">

                <div className="overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center gap-6 mb-10">
                        <button onClick={onClose} className="p-4 rounded-3xl bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90 border border-gray-100 dark:border-gray-800 shadow-sm group">
                            <ArrowLeft size={24} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-glass border-4 border-white/50 dark:border-gray-800/50 rotate-3">
                                <Icon size={40} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] mb-2">{t.infoGuide}</h1>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{title}</h2>
                            </div>
                        </div>
                    </div>

                    <div className="text-gray-600 dark:text-gray-300">
                        {children}
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                        <button
                            onClick={onClose}
                            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-10 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all"
                        >
                            {t.gotIt}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SafetyTipsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => {
    const { t } = useUser();
    return (
        <InfoBaseModal {...props} title={t.safetyTitle} icon={Shield}>
            <div className="space-y-10">
                <div className="bg-gradient-to-br from-red-500 to-orange-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-red-500/20 relative overflow-hidden group">
                    <AlertTriangle size={120} className="absolute -right-8 -bottom-8 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
                    <h4 className="font-black text-xs uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-white" /> {t.securityAlert}
                    </h4>
                    <p className="text-xl font-black leading-tight">{t.securityDesc}</p>
                </div>

                <div className="grid gap-8">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                        <div className="w-1.5 h-3 bg-emerald-500 rounded-full" />
                        {t.essentialGuidelines}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-6">
                        {[
                            { icon: "💰", title: t.ruleInAppPayments, text: t.ruleInAppPaymentsDesc },
                            { icon: "👤", title: t.ruleVerifyProfiles, text: t.ruleVerifyProfilesDesc },
                            { icon: "💬", title: t.ruleStayInChat, text: t.ruleStayInChatDesc },
                            { icon: "🚩", title: t.ruleReportAbuse, text: t.ruleReportAbuseDesc }
                        ].map((rule, i) => (
                            <div key={i} className="group p-8 bg-gray-50/50 dark:bg-gray-900/40 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all shadow-sm">
                                <div className="text-3xl mb-4 group-hover:scale-125 transition-transform origin-left">{rule.icon}</div>
                                <h4 className="font-black text-md text-gray-900 dark:text-white mb-2 uppercase tracking-tight">{rule.title}</h4>
                                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium leading-relaxed">{rule.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div className="bg-emerald-50/30 dark:bg-emerald-950/20 p-8 rounded-[2.5rem] border-2 border-emerald-100 dark:border-emerald-900/30">
                        <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mb-4 uppercase tracking-tight">{t.forWorkers}</h3>
                        <ul className="space-y-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <li className="flex gap-3"><span>✅</span> <strong>{t.verifyLocation}:</strong> {t.verifyLocationDesc}</li>
                            <li className="flex gap-3"><span>✅</span> <strong>{t.publicPlaces}:</strong> {t.publicPlacesDesc}</li>
                            <li className="flex gap-3"><span>✅</span> <strong>{t.fixedRates}:</strong> {t.fixedRatesDesc}</li>
                        </ul>
                    </div>
                    <div className="bg-blue-50/30 dark:bg-blue-950/20 p-8 rounded-[2.5rem] border-2 border-blue-100 dark:border-blue-900/30">
                        <h3 className="text-xl font-black text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-tight">{t.forEmployers}</h3>
                        <ul className="space-y-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <li className="flex gap-3"><span>🛡️</span> <strong>{t.idValidation}:</strong> {t.idValidationDesc}</li>
                            <li className="flex gap-3"><span>🛡️</span> <strong>{t.workScope}:</strong> {t.workScopeDesc}</li>
                            <li className="flex gap-3"><span>🛡️</span> <strong>{t.fairConduct}:</strong> {t.fairConductDesc}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </InfoBaseModal>
    );
};

export const CommunityGuidelinesModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => {
    const { t } = useUser();
    return (
        <InfoBaseModal {...props} title={t.guidelinesTitle} icon={Users}>
            <div className="space-y-8">
                <p className="text-lg font-medium leading-relaxed text-gray-500 dark:text-gray-400">{t.guidelinesDesc}</p>
                <div className="grid md:grid-cols-2 gap-6">
                    {[
                        { color: "emerald", icon: "🤝", title: t.respectTitle, text: t.respectDesc },
                        { color: "blue", icon: "✨", title: t.reliableTitle, text: t.reliableDesc },
                        { color: "amber", icon: "⭐", title: t.honestReviews, text: t.honestReviewsDesc },
                        { color: "red", icon: "✋", title: t.safetyFirst, text: t.safetyFirstDesc }
                    ].map((item, i) => (
                        <div key={i} className="group p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 shadow-glass transition-all hover:-translate-y-1">
                            <div className="text-2xl mb-4">{item.icon}</div>
                            <h4 className={`font-black text-${item.color}-600 dark:text-${item.color}-400 mb-3 uppercase tracking-[0.2em] text-xs flex items-center gap-2`}>
                                {item.title}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </InfoBaseModal>
    );
};

export const TermsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = (props) => {
    const { t } = useUser();
    return (
        <InfoBaseModal {...props} title={t.termsTitle} icon={FileText}>
            <div className="space-y-8">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2rem] border-2 border-gray-100 dark:border-gray-800 inline-block font-black text-xs uppercase tracking-widest text-gray-400">
                    {t.lastUpdated}: Dec 2024
                </div>
                <div className="space-y-4 text-gray-600 dark:text-gray-400 font-medium leading-relaxed text-lg">
                    <p>{t.termsIntro}</p>
                    <ol className="list-decimal pl-6 space-y-4">
                        <li><strong className="text-gray-900 dark:text-white">{t.termRole}:</strong> {t.termRoleDesc}</li>
                        <li><strong className="text-gray-900 dark:text-white">{t.termPayments}:</strong> {t.termPaymentsDesc}</li>
                        <li><strong className="text-gray-900 dark:text-white">{t.termPrivacy}:</strong> {t.termPrivacyDesc}</li>
                        <li><strong className="text-gray-900 dark:text-white">{t.termTermination}:</strong> {t.termTerminationDesc}</li>
                    </ol>
                </div>
                <div className="p-8 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 rounded-[2.5rem] border-2 border-amber-100 dark:border-amber-900/30 flex items-center gap-4">
                    <AlertTriangle size={32} />
                    <p className="text-sm font-bold">{t.termsSummary}</p>
                </div>
            </div>
        </InfoBaseModal>
    );
};
