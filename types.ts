
export enum UserRole {
  WORKER = 'WORKER',
  POSTER = 'POSTER',
  ADMIN = 'ADMIN'
}

export enum JobStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export type Language = 'en' | 'hi' | 'pa';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  date: number;
  tags?: string[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string; // PRIVATE: Only visible to self or accepted counterparty
  location?: string; // PRIVATE
  coordinates?: Coordinates; // PRIVATE
  rating: number;
  profilePhoto?: string;
  isPremium?: boolean;
  aiUsageCount?: number;
  bio?: string;
  skills?: string[];
  experience?: string;
  jobsCompleted?: number;
  joinDate?: number;
  verified?: boolean;
  reviews?: Review[];
}

export interface NegotiationEntry {
  amount: number;
  by: UserRole;
  timestamp: number;
  message?: string;
  agreed?: boolean;
}

export interface Bid {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerRating: number;
  workerLocation: string;
  workerCoordinates?: Coordinates;
  workerPhoto?: string;
  amount: number; // Current active amount
  message: string;
  createdAt: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  negotiationHistory: NegotiationEntry[]; // Track the back and forth
  posterId?: string; // Denormalized for simpler RLS/Realtime
}

export interface Job {
  id: string;
  posterId: string;
  posterName: string;
  posterPhone: string;
  posterPhoto?: string;
  posterRating?: number;
  title: string;
  description: string;
  category: string;
  location: string;
  coordinates?: Coordinates;
  jobDate: string;
  duration: string;
  budget: number;
  status: JobStatus;
  createdAt: number;
  bids: Bid[];
  acceptedBidId?: string;
  workerId?: string; // ID of the hired worker (if status is IN_PROGRESS/COMPLETED)
  workerName?: string; // Name of the hired worker
  image?: string; // Base64 or URL of job image
  reviews?: Review[];
  // === FEED OPTIMIZATION FIELDS (populated by get_home_feed RPC) ===
  bidCount?: number;      // Pre-computed bid count (avoids fetching all bids)
  myBidId?: string;       // Current user's bid ID if exists
  myBidStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';  // Current user's bid status
  myBidAmount?: number;   // Current user's bid amount
  myBidLastNegotiationBy?: UserRole; // Last turn in negotiation (for card UI)
  hasNewBid?: boolean;    // Transient: Poster has unread new bid
  hasNewCounter?: boolean; // Transient: Poster has unread new counter (calculated from action_required)
  actionRequiredCount?: number; // Transient: Number of bids requiring attention
  hasAgreement?: boolean;  // Pre-computed: At least one worker has agreed to terms
  hasMyReview?: boolean;   // Pre-computed: Current user has already reviewed this job
  hiredWorkerName?: string;
  hiredWorkerPhone?: string;
  hiredWorkerId?: string;
  isRecommended?: boolean; // Personalization Flag
  translations?: Record<string, {
    title: string;
    description: string;
    cachedAt: number;
  }>;
}

export interface DashboardStats {
  poster_active: number;
  poster_history: number;
  worker_active: number;
  worker_history: number;
  discover_active: number;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  receiverId?: string;
  text: string;
  timestamp: number;
  translatedText?: string;
  isDeleted?: boolean;
  read?: boolean;
  readAt?: number;
  mediaType?: 'voice' | 'image' | 'video';
  mediaUrl?: string;
  mediaDuration?: number; // Duration in seconds for voice/video
}


export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  timestamp: number;
  relatedJobId?: string;
}

// --- Web Speech API Types ---
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
  prototype: SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    recognition?: SpeechRecognition; // Store instance on window for access
    Razorpay: any; // Razorpay SDK
  }
}

// --- Razorpay Types ---
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string; // Generated by backend
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}