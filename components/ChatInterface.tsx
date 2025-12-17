import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchJobMessages } from '../services/chatService';
import { Job, ChatMessage, User } from '../types';
import { Send, Phone, CheckCircle, ArrowLeft, LockKeyhole, Paperclip, MoreVertical, Check, CheckCheck, Languages, Mic, MicOff, Loader2, Sparkles, Lock, Volume2, Square, Trash2 } from 'lucide-react';

interface ChatInterfaceProps {
  job: Job;
  currentUser: User;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onIncomingMessage?: (msg: ChatMessage) => void;
  onCompleteJob: () => void;
  onTranslateMessage: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  isPremium?: boolean;
  remainingTries?: number;
}
const QUICK_REPLIES_WORKER = [
  "I'm on my way",
  "I've arrived at the location",
  "How long will the work take?",
  "Please send exact location",
  "Ok, thank you"
];

const QUICK_REPLIES_POSTER = [
  "When will you reach?",
  "Please come quickly",
  "Call me when you arrive",
  "Is the work done?",
  "Ok, thanks"
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  job,
  currentUser,
  onClose,
  messages: liveMessages,
  onSendMessage,
  onIncomingMessage,
  onCompleteJob,
  onTranslateMessage,
  onDeleteMessage,
  isPremium,
  remainingTries
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Local History State (Lazy Loaded)
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Real-time Broadcast Channel
  const [channel, setChannel] = useState<any>(null);

  // Fetch History on Mount
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      const { messages, error } = await fetchJobMessages(job.id, 0); // Page 0
      if (!error && messages) {
        setHistoryMessages(messages.sort((a, b) => a.timestamp - b.timestamp));
      }
      setIsLoadingHistory(false);
    };
    loadHistory();
  }, [job.id]);

  useEffect(() => {
    // Subscribe to the specific job channel for broadcasts (Peer-to-Peer speed)
    // ... (existing Broadcast logic) ...
    const newChannel = supabase.channel(`chat_room:${job.id}`);

    newChannel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        // Only process if it's from the OTHER person (we handle our own optimistically)
        if (payload.senderId !== currentUser.id && onIncomingMessage) {
          console.log('[Chat] Broadcast received:', payload);
          onIncomingMessage(payload as ChatMessage);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // console.log('Joined chat room');
        }
      });

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [job.id]);

  const isPoster = job.posterId === currentUser.id;
  const showLockIcon = !isPremium && (remainingTries || 0) <= 0;

  // Determine the other person's details
  const acceptedBid = job.bids.find(b => b.id === job.acceptedBidId);

  let otherPersonName = '';
  let otherPersonPhone = '';
  let otherPersonPhoto = '';

  if (isPoster) {
    otherPersonName = acceptedBid?.workerName || 'Worker';
    otherPersonPhone = acceptedBid?.workerPhone || '';
    otherPersonPhoto = acceptedBid?.workerPhoto || '';
  } else {
    otherPersonName = job.posterName;
    otherPersonPhone = job.posterPhone;
    otherPersonPhoto = job.posterPhoto || '';
  }

  const quickReplies = isPoster ? QUICK_REPLIES_POSTER : QUICK_REPLIES_WORKER;

  // Merge and Deduplicate Messages
  const allMessages = [...historyMessages, ...liveMessages]
    .filter((msg, index, self) =>
      index === self.findIndex((m) => (
        m.id === msg.id // Unique ID check
      ))
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length]); // Scroll when count changes

  useEffect(() => {
    // Cleanup speech
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSend = async (text: string = inputText) => {
    if (text.trim()) {
      // 1. Persistence (DB)
      onSendMessage(text);

      // 2. Broadcast (Instant UI for peer)
      if (channel) {
        const tempMsg: ChatMessage = {
          id: `temp_${Date.now()}_${Math.random()}`,
          jobId: job.id,
          senderId: currentUser.id,
          text: text,
          timestamp: Date.now()
        };
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: tempMsg
        });
      }

      setInputText('');
      setShowQuickReplies(false); // Hide quick replies after interaction
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      try { (window as any).recognition?.stop(); } catch (e) { }
      return;
    }

    setIsListening(true);
    try {
      const recognition = new SpeechRecognition();
      (window as any).recognition = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN'; // Default to Hindi/English mix for chat usually

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${text}` : text);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleTranslateClick = async (msg: ChatMessage) => {
    setTranslatingId(msg.id);
    await onTranslateMessage(msg.id, msg.text);
    setTranslatingId(null);
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeakingMessageId(null);
      return;
    }

    // Read translated text if available, otherwise original
    const textToRead = msg.translatedText || msg.text;
    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Auto-detect Hindi characters to switch voice
    const hasHindiChars = /[\u0900-\u097F]/.test(textToRead);
    utterance.lang = hasHindiChars ? 'hi-IN' : 'en-IN';

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(msg.id);
    }
  };

  // Group messages by date
  const groupedMessages = allMessages.reduce((acc, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col h-full max-w-md mx-auto animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm border-b border-gray-100 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
            <ArrowLeft size={22} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
              {otherPersonPhoto ? (
                <img src={otherPersonPhoto} alt={otherPersonName} className="w-full h-full object-cover" />
              ) : (
                otherPersonName.charAt(0)
              )}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-none">{otherPersonName}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-gray-500 font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {otherPersonPhone ? (
            <a href={`tel:${otherPersonPhone}`} className="p-2.5 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
              <Phone size={20} />
            </a>
          ) : (
            <div className="p-2 text-gray-300">
              <LockKeyhole size={20} />
            </div>
          )}
          <button className="p-2 rounded-full text-gray-400 hover:bg-gray-100">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Job Context Banner */}
      <div className="bg-emerald-50/80 backdrop-blur-sm px-4 py-2 flex justify-between items-center text-xs border-b border-emerald-100">
        <span className="font-medium text-emerald-800 line-clamp-1 flex-1">{job.title}</span>
        <span className="font-bold text-emerald-700 ml-2">₹{acceptedBid?.amount || job.budget}</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#e5ddd5] bg-opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex justify-center mb-4">
              <span className="bg-gray-200/80 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                {date === new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) ? 'Today' : date}
              </span>
            </div>

            <div className="space-y-2">
              {(msgs as ChatMessage[]).map((msg) => {
                const isMe = msg.senderId === currentUser.id;
                const isThisSpeaking = speakingMessageId === msg.id;

                return (
                  <div key={msg.id} className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex items-end gap-1 max-w-[85%]">
                      {/* Left Side Actions (For received messages) */}
                      {!isMe && (
                        <div className="flex flex-col gap-1 mb-1">
                          <button
                            onClick={() => handleTranslateClick(msg)}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-emerald-600 shadow-sm transition-all"
                            disabled={translatingId === msg.id}
                            title="Translate"
                          >
                            {translatingId === msg.id ? <Loader2 size={12} className="animate-spin" /> : (showLockIcon ? <Lock size={12} /> : <Languages size={12} />)}
                          </button>
                          <button
                            onClick={() => handleSpeakMessage(msg)}
                            className={`p-1.5 rounded-full shadow-sm transition-all ${isThisSpeaking ? 'bg-red-50 text-red-500' : 'bg-white/80 hover:bg-white text-gray-600'}`}
                            title="Listen"
                          >
                            {isThisSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
                          </button>
                        </div>
                      )}

                      <div
                        className={`relative px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                          }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        {msg.translatedText && (
                          <div className={`mt-2 pt-2 border-t ${isMe ? 'border-emerald-500/50' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-1 mb-1 opacity-70">
                              <Sparkles size={10} />
                              <span className="text-[10px] font-bold uppercase">Translated</span>
                            </div>
                            <p className="leading-relaxed italic opacity-90">{msg.translatedText}</p>
                          </div>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCheck size={14} className="opacity-80" />}
                        </div>
                      </div>

                      {/* Right Side Actions (For sent messages) */}
                      {isMe && (
                        <div className="flex flex-col gap-1 mb-1 items-end">
                          <button
                            onClick={() => handleSpeakMessage(msg)}
                            className={`p-1.5 rounded-full shadow-sm transition-all ${isThisSpeaking ? 'bg-red-50 text-red-500' : 'bg-white/80 hover:bg-white text-gray-600'}`}
                            title="Listen"
                          >
                            {isThisSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
                          </button>
                          {onDeleteMessage && (
                            <button
                              onClick={() => {
                                if (confirm('Delete message?')) onDeleteMessage(msg.id);
                              }}
                              className="p-1.5 rounded-full shadow-sm bg-white/80 hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="bg-white border-t border-gray-100 flex-none z-20 pb-safe">

        {/* Quick Replies */}
        {showQuickReplies && (
          <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-gray-50 border-b border-gray-100">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => handleSend(reply)}
                className="whitespace-nowrap px-3 py-1.5 bg-white border border-emerald-100 rounded-full text-xs text-emerald-700 font-medium hover:bg-emerald-50 active:scale-95 transition-all shadow-sm"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <div className="p-3">
          {isPoster && job.status === 'IN_PROGRESS' && (
            <div className="mb-3 px-1">
              <button
                onClick={onCompleteJob}
                className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle size={18} className="mr-2 text-emerald-600" /> Mark Job as Completed
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={handleVoiceInput}
              className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-50 text-red-600 animate-pulse' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <div className="flex-1 bg-gray-100 rounded-2xl flex items-center min-h-[44px] px-4 py-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 max-h-24 resize-none"
                rows={1}
                style={{ lineHeight: '1.5' }}
              />
            </div>

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className={`p-3 rounded-full shadow-md transition-all transform hover:scale-105 active:scale-95 ${inputText.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-400 cursor-default'
                }`}
            >
              <Send size={20} className={inputText.trim() ? "ml-0.5" : ""} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};