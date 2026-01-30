import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Check, RotateCcw, Volume2, Sparkles, Wand2, ArrowRight, ClipboardList, MapPin, Calendar, IndianRupee } from 'lucide-react';
import { processVoicePostingConversation } from '../services/geminiService';

interface VoiceAssistantOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (data: any) => void;
    language: 'en' | 'hi' | 'pa';
}

const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
    isOpen,
    onClose,
    onComplete,
    language
}) => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [phase, setPhase] = useState<'GREETING' | 'UNDERSTANDING' | 'CONFIRMING' | 'DONE'>('GREETING');
    const [history, setHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
    const [extractedData, setExtractedData] = useState<any>({
        title: '',
        category: '',
        description: '',
        location: '',
        budget: '',
        timing: ''
    });

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

    // Translations for UI elements
    const t: any = {
        en: {
            listening: "Listening...",
            tapToTalk: "Tap to speak",
            stop: "Stop",
            confirm: "Looks Good, Post It!",
            restart: "Start Over",
            aiHelper: "Chowkar Voice Assist",
            ready: "Ready to help",
            processing: "Thinking...",
            summary: "I've gathered these details. Is this correct?"
        },
        hi: {
            listening: "सुन रहा हूँ...",
            tapToTalk: "बोलने के लिए टैप करें",
            stop: "रुकें",
            confirm: "सब ठीक है, पोस्ट करें!",
            restart: "फिर से शुरू करें",
            aiHelper: "चौकड़ वॉइस असिस्ट",
            ready: "मदद के लिए तैयार",
            processing: "सोच रहा हूँ...",
            summary: "मैने ये जानकारी जुटाई है। क्या यह सही है?"
        },
        pa: {
            listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ...",
            tapToTalk: "ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ",
            stop: "ਰੁਕੋ",
            confirm: "ਸਭ ਠੀਕ ਹੈ, ਪੋਸਟ ਕਰੋ!",
            restart: "ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ",
            aiHelper: "ਚੌਕੜ ਵੌਇਸ ਅਸਿਸਟ",
            ready: "ਮਦਦ ਲਈ ਤਿਆਰ",
            processing: "ਸੋਚ ਰਿਹਾ ਹਾਂ...",
            summary: "ਮੈਂ ਇਹ ਜਾਣਕਾਰੀ ਇਕੱਠੀ ਕੀਤੀ ਹੈ। ਕੀ ਇਹ ਸਹੀ ਹੈ?"
        }
    };

    const ui = t[language] || t.en;

    // Initialize Speech Recognition
    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Stop after one phrase to process
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : 'en-IN';

        recognitionRef.current.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const speech = event.results[i][0].transcript;
                    setTranscript(speech);
                    handleUserSpeech(speech);
                } else {
                    interimTranscript += event.results[i][0].transcript;
                    setTranscript(interimTranscript);
                }
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [language, phase, extractedData, history]);

    // Speak AI Response
    const speak = useCallback((text: string) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : 'en-IN';

        // Warm voice selection
        const voices = synthRef.current.getVoices();
        const preferredVoices = {
            hi: ["Google Hindi", "hi-IN-Standard-A", "Microsoft Hemant"],
            pa: ["Google Punjabi", "pa-IN-Standard-A"],
            en: ["Google UK English Male", "Google UK English Female", "en-GB-Standard-B"]
        };

        const targetPrefs = preferredVoices[language] || [];
        const selectedVoice = voices.find(v => targetPrefs.some(p => v.name.includes(p))) || voices.find(v => v.lang.startsWith(language));

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            // Proactively listen after AI finishes speaking if not in DONE phase
            if (phase !== 'DONE') {
                setTimeout(() => toggleListening(), 500);
            }
        };

        synthRef.current.speak(utterance);
    }, [language, phase]);

    // Initial Greeting
    useEffect(() => {
        if (isOpen && phase === 'GREETING') {
            const greeting = language === 'hi'
                ? "नमस्ते! मैं आपकी जरूरत को पोस्ट करने में मदद करने के लिए यहाँ हूँ। कृपया मुझे विस्तार से बताएं कि आपको क्या मदद चाहिए?"
                : language === 'pa'
                    ? "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡੀ ਜ਼ਰੂਰਤ ਨੂੰ ਪੋਸਟ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰਨ ਲਈ ਇੱਥੇ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਵਿਸਥਾਰ ਵਿੱਚ ਦੱਸੋ ਕਿ ਤੁਹਾਨੂੰ ਕੀ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?"
                    : "Namaste! I'm here to help you post your requirement. Tell me in your own words—what exactly do you need help with?";

            setAiResponse(greeting);
            setHistory([{ role: 'model', parts: [{ text: greeting }] }]);
            setTimeout(() => speak(greeting), 800);
            setPhase('UNDERSTANDING');
        }
    }, [isOpen]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setIsListening(true);
            setTranscript('');
            recognitionRef.current.start();
        }
    };

    const handleUserSpeech = async (speech: string) => {
        if (!speech.trim() || isProcessing) return;

        setIsProcessing(true);
        try {
            const result = await processVoicePostingConversation(speech, history, extractedData, language);

            // Update History
            setHistory(prev => [
                ...prev,
                { role: 'user', parts: [{ text: speech }] },
                { role: 'model', parts: [{ text: result.nextResponse }] }
            ]);

            // Update State
            setAiResponse(result.nextResponse);
            setExtractedData(result.updatedData);
            setPhase(result.phase as any);

            if (result.isComplete) {
                setPhase('DONE');
            }

            speak(result.nextResponse);
        } catch (error) {
            console.error("Failed to process conversation", error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-indigo-950/98 backdrop-blur-3xl animate-in fade-in duration-500 overflow-hidden">
            {/* Background Liquid Mesh */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/30 blur-[120px] rounded-full animate-blob" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/30 blur-[120px] rounded-full animate-blob animation-delay-2000" />
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-fuchsia-500/20 blur-[120px] rounded-full animate-blob animation-delay-4000" />
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10"
            >
                <X size={24} />
            </button>

            {/* Header / Brand */}
            <div className="absolute top-10 left-0 right-0 z-20 flex justify-center pointer-events-none">
                <div className="flex items-center gap-3 px-6 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20 shadow-xl">
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                    <span className="text-[10px] font-black text-white tracking-[0.2em]">{ui.aiHelper}</span>
                </div>
            </div>

            {/* Main Content Scrollable Area */}
            <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8 py-20 px-4 overflow-y-auto max-h-screen">

                {/* Visualizer & Extracted Info Toggle */}
                <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center shrink-0">
                    {phase === 'DONE' || phase === 'CONFIRMING' ? (
                        <div className="w-full bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 p-8 space-y-6 animate-in zoom-in-95 duration-500 shadow-2xl">
                            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                                <ClipboardList className="text-white/60" size={20} />
                                <h3 className="text-lg font-black text-white tracking-tight">{ui.summary}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Requirement</span>
                                    <p className="text-lg font-bold text-white leading-tight">{extractedData.title || '...'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Category</span>
                                    <p className="text-sm font-bold text-indigo-300 uppercase tracking-wide">{extractedData.category || '...'}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <MapPin size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Location</span>
                                    </div>
                                    <p className="text-sm font-bold text-white/90">{extractedData.location || '...'}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <IndianRupee size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Budget</span>
                                    </div>
                                    <p className="text-lg font-black text-green-400">₹{extractedData.budget || '...'}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
                            {/* Inner Glow */}
                            <div className={`absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl transition-all duration-500 ${isListening ? 'scale-150' : 'scale-100'}`} />

                            {/* Outer Rings */}
                            <div className={`absolute inset-[-20%] border border-white/10 rounded-full transition-all duration-1000 ${isListening ? 'scale-110 opacity-100 animate-spin-slow' : 'scale-90 opacity-0'}`} />
                            <div className={`absolute inset-[-40%] border border-white/5 rounded-full transition-all duration-1000 delay-150 ${isListening ? 'scale-110 opacity-100 animate-reverse-spin-slow' : 'scale-90 opacity-0'}`} />

                            {/* Center Avatar */}
                            <div className={`relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isListening ? 'scale-110' : 'scale-100'}`}>
                                <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-indigo-800 shadow-[0_0_60px_rgba(99,102,241,0.4)] ${isSpeaking || isListening ? 'animate-pulse' : ''}`} />
                                <div className="absolute inset-2 rounded-full bg-indigo-950 border-4 border-white/20 flex items-center justify-center overflow-hidden">
                                    {isProcessing ? (
                                        <div className="relative w-12 h-12 flex items-center justify-center">
                                            <div className="absolute inset-0 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                                            <Sparkles size={24} className="text-white/20" />
                                        </div>
                                    ) : isSpeaking ? (
                                        <div className="flex items-end gap-1.5 h-12">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="w-1.5 bg-white rounded-full animate-voice-bar" style={{ animationDelay: `${i * 0.15}s`, height: `${20 + Math.random() * 80}%` }} />
                                            ))}
                                        </div>
                                    ) : (
                                        <Wand2 size={48} className={`text-white transition-opacity ${isListening ? 'opacity-40' : 'opacity-80'}`} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* AI & User Text */}
                <div className="w-full text-center space-y-8">
                    <h2 className="text-2xl md:text-4xl font-black text-white leading-[1.1] tracking-tight px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {aiResponse}
                    </h2>

                    <div className="relative group min-h-[5rem] flex items-center justify-center transition-all">
                        {isListening ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                                <p className="text-xl font-black text-indigo-300 lowercase italic tracking-wide">
                                    {transcript || ui.listening}
                                </p>
                            </div>
                        ) : transcript ? (
                            <p className="text-xl font-medium text-white/50 italic leading-relaxed max-w-md">
                                "{transcript}"
                            </p>
                        ) : (
                            <p className="text-white/20 font-bold uppercase tracking-[0.3em] text-[10px]">
                                {ui.ready}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-12 left-0 right-0 z-20 flex flex-col items-center gap-8">
                {phase !== 'DONE' && (
                    <button
                        onClick={toggleListening}
                        disabled={isSpeaking || isProcessing}
                        className={`group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isListening ? 'bg-white text-indigo-900 scale-110' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'} ${isSpeaking || isProcessing ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                    >
                        {isListening ? <MicOff size={36} /> : <Mic size={36} />}
                        {isListening && (
                            <div className="absolute inset-[-12px] border-4 border-white/30 rounded-full animate-ping" />
                        )}
                        {!isListening && !isSpeaking && !isProcessing && (
                            <div className="absolute -top-12 bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-bounce">
                                {ui.tapToTalk}
                            </div>
                        )}
                    </button>
                )}

                <div className="flex items-center gap-6 px-4">
                    <button
                        onClick={() => { setPhase('GREETING'); setTranscript(''); setAiResponse(''); setHistory([]); setExtractedData({}); }}
                        className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl text-white/60 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest border border-white/5"
                    >
                        <RotateCcw size={16} /> {ui.restart}
                    </button>
                    {phase === 'DONE' && (
                        <button
                            onClick={() => onComplete(extractedData)}
                            className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-[2rem] hover:scale-105 active:scale-95 transition-all font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40"
                        >
                            <Check size={20} strokeWidth={3} /> {ui.confirm}
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Styles */}
            <style>{`
                @keyframes voice-bar {
                    0%, 100% { height: 20%; transform: scaleY(1); }
                    50% { height: 100%; transform: scaleY(1.2); }
                }
                .animate-voice-bar {
                    animation: voice-bar 0.4s ease-in-out infinite;
                }
                .animate-spin-slow {
                    animation: spin 6s linear infinite;
                }
                .animate-reverse-spin-slow {
                    animation: spin 8s linear reverse infinite;
                }
                @keyframes blob {
                    0% { transform: scale(1) translate(0px, 0px); }
                    33% { transform: scale(1.1) translate(30px, -50px); }
                    66% { transform: scale(0.9) translate(-20px, 20px); }
                    100% { transform: scale(1) translate(0px, 0px); }
                }
                .animate-blob {
                    animation: blob 7s infinite alternate ease-in-out;
                }
                .animation-delay-2000 { animation-delay: 2s; }
                .animation-delay-4000 { animation-delay: 4s; }
            `}</style>
        </div>
    );
};

export default VoiceAssistantOverlay;
