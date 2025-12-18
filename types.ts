
export enum UserRole {
  WORKER = 'WORKER',
  POSTER = 'POSTER',
  ADMIN = 'ADMIN'
}

export enum JobStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

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
  phone: string;
  location: string;
  coordinates?: Coordinates;
  walletBalance: number;
  rating: number;
  profilePhoto?: string;
  isPremium?: boolean;
  aiUsageCount?: number;
  bio?: string;
  skills?: string[];
  experience?: string;
  jobsCompleted?: number;
  joinDate?: number;
  reviews?: Review[];
}

export interface NegotiationEntry {
  amount: number;
  by: UserRole;
  timestamp: number;
  message?: string;
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
  image?: string; // Base64 or URL of job image
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  text: string;
  timestamp: number;
  translatedText?: string;
  isDeleted?: boolean;
  receiverId?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  timestamp: number;
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