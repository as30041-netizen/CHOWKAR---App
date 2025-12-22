import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Fix for Capacitor: Use native WebSocket implementation
    transport: Capacitor.isNativePlatform() ? undefined : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': `supabase-js-capacitor/${Capacitor.getPlatform()}`,
    },
  },
});

// Debug logging for Capacitor (only in development)
if (Capacitor.isNativePlatform()) {
  logger.log('🔧 [Supabase] Running on native platform:', Capacitor.getPlatform());
  logger.log('🔧 [Supabase] Realtime enabled with Capacitor config');
}

// Database type helpers
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          auth_user_id: string | null;
          location: string;
          latitude: number | null;
          longitude: number | null;
          wallet_balance: number;
          rating: number;
          profile_photo: string | null;
          is_premium: boolean;
          ai_usage_count: number;
          bio: string | null;
          skills: string[];
          experience: string | null;
          jobs_completed: number;
          join_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          auth_user_id?: string | null;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          wallet_balance?: number;
          rating?: number;
          profile_photo?: string | null;
          is_premium?: boolean;
          ai_usage_count?: number;
          bio?: string | null;
          skills?: string[];
          experience?: string | null;
          jobs_completed?: number;
          join_date?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          wallet_balance?: number;
          rating?: number;
          profile_photo?: string | null;
          is_premium?: boolean;
          ai_usage_count?: number;
          bio?: string | null;
          skills?: string[];
          experience?: string | null;
          jobs_completed?: number;
        };
      };
      jobs: {
        Row: {
          id: string;
          poster_id: string;
          poster_name: string;
          poster_phone: string;
          poster_photo: string | null;
          title: string;
          description: string;
          category: string;
          location: string;
          latitude: number | null;
          longitude: number | null;
          job_date: string;
          duration: string;
          budget: number;
          status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id: string | null;
          image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          poster_id: string;
          poster_name: string;
          poster_phone: string;
          poster_photo?: string | null;
          title: string;
          description: string;
          category: string;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          job_date: string;
          duration: string;
          budget: number;
          status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id?: string | null;
          image?: string | null;
        };
        Update: {
          poster_name?: string;
          poster_phone?: string;
          poster_photo?: string | null;
          title?: string;
          description?: string;
          category?: string;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          job_date?: string;
          duration?: string;
          budget?: number;
          status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id?: string | null;
          image?: string | null;
        };
      };
      bids: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          worker_name: string;
          worker_phone: string;
          worker_rating: number;
          worker_location: string;
          worker_latitude: number | null;
          worker_longitude: number | null;
          worker_photo: string | null;
          amount: number;
          message: string;
          status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          worker_id: string;
          worker_name: string;
          worker_phone: string;
          worker_rating: number;
          worker_location: string;
          worker_latitude?: number | null;
          worker_longitude?: number | null;
          worker_photo?: string | null;
          amount: number;
          message: string;
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history?: any;
        };
        Update: {
          amount?: number;
          message?: string;
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history?: any;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: 'CREDIT' | 'DEBIT';
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: 'CREDIT' | 'DEBIT';
          description: string;
        };
        Update: {
          amount?: number;
          type?: 'CREDIT' | 'DEBIT';
          description?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read: boolean;
          related_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read?: boolean;
          related_job_id?: string | null;
        };
        Update: {
          title?: string;
          message?: string;
          type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read?: boolean;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          job_id: string;
          sender_id: string;
          receiver_id: string | null;
          text: string;
          translated_text: string | null;
          is_deleted: boolean;
          read: boolean;
          read_at: string | null;
          media_type: 'voice' | 'image' | 'video' | null;
          media_url: string | null;
          media_duration: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          sender_id: string;
          receiver_id?: string | null;
          text: string;
          translated_text?: string | null;
          is_deleted?: boolean;
          read?: boolean;
          read_at?: string | null;
          media_type?: 'voice' | 'image' | 'video' | null;
          media_url?: string | null;
          media_duration?: number | null;
        };
        Update: {
          text?: string;
          translated_text?: string | null;
          is_deleted?: boolean;
          read?: boolean;
          read_at?: string | null;
          media_type?: 'voice' | 'image' | 'video' | null;
          media_url?: string | null;
          media_duration?: number | null;
        };
      };
      reviews: {
        Row: {
          id: string;
          reviewer_id: string;
          reviewee_id: string;
          job_id: string | null;
          rating: number;
          comment: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          reviewee_id: string;
          job_id?: string | null;
          rating: number;
          comment?: string | null;
          tags?: string[];
        };
        Update: {
          rating?: number;
          comment?: string | null;
          tags?: string[];
        };
      };
    };
  };
};
