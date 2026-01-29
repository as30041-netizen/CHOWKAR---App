import { supabase, waitForSupabase } from '../lib/supabase';
import { User, Coordinates } from '../types';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { safeFetch } from './fetchUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Use Capacitor callback URL for native apps, web URL for browser
    // Ensure we capture the exact origin for local development (e.g. http://localhost:3000)
    const origin = window.location.origin;
    const redirectTo = Capacitor.isNativePlatform()
      ? 'in.chowkar.app://callback'
      : origin.endsWith('/') ? origin : `${origin}/`;

    console.log('[Auth] Redirect Details:', {
      platform: Capacitor.getPlatform(),
      origin: origin,
      finalRedirectTo: redirectTo,
      isNative: Capacitor.isNativePlatform()
    });

    // NO OPTIMISTIC FLAG: Let UserContext handle strictly after verification
    // localStorage.setItem('chowkar_isLoggedIn', 'true');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Capacitor.isNativePlatform(), // Important for mobile!
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          display: 'touch',  // Request touch-optimized fullscreen view
        }
      }
    });

    if (error) {
      console.error('[Auth] OAuth initialization error:', error);
      localStorage.removeItem('chowkar_isLoggedIn'); // Revert on immediate error
      throw error;
    }

    // For native platforms, open OAuth in system browser for fullscreen experience
    if (Capacitor.isNativePlatform() && data?.url) {
      console.log('[Auth] Opening OAuth URL in system browser:', data.url);
      await Browser.open({
        url: data.url,
        windowName: '_system',
      });
    }

    console.log('[Auth] OAuth redirect initiated successfully');
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error signing in with Google:', error);
    localStorage.removeItem('chowkar_isLoggedIn'); // Revert on error
    return { success: false, error: 'Failed to sign in with Google' };
  }
};

export const checkPhoneConflict = async (phone: string): Promise<{ exists: boolean; error?: string }> => {
  try {
    // Check if any profile already has this phone number
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    return { exists: !!data };
  } catch (error: any) {
    console.error('[Auth] Error checking phone conflict:', error);
    return { exists: false, error: error.message };
  }
};

export const signInWithPhone = async (phone: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Pre-check for conflict (Google account already has this number)
    const { exists, error: conflictError } = await checkPhoneConflict(phone);
    if (conflictError) throw new Error(conflictError);

    if (exists) {
      return {
        success: false,
        error: 'This phone number is already linked to a Google account. Please sign in with Google.'
      };
    }

    // 2. Trigger Supabase OTP
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('[Auth] Error signing in with phone:', error);
    return { success: false, error: error.message || 'Failed to send OTP' };
  }
};

export const verifyOTP = async (phone: string, token: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) throw error;
    if (!data.session) throw new Error('No session created');

    return { success: true };
  } catch (error: any) {
    console.error('[Auth] Error verifying OTP:', error);
    return { success: false, error: error.message || 'Invalid OTP' };
  }
};

export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: 'Failed to sign out' };
  }
};

const mapDbProfileToUser = (profile: any, authEmail?: string, reviews: any[] = []): User => {
  return {
    id: profile.id,
    name: profile.name,
    phone: profile.phone || '',
    email: profile.email || authEmail || '',
    location: profile.location || '',
    coordinates: profile.latitude && profile.longitude
      ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
      : undefined,
    rating: Number(profile.rating || 0),
    profilePhoto: profile.profile_photo || undefined,
    isPremium: profile.is_premium,
    subscription_plan: profile.subscription_plan, // FIX: Map the plan
    subscription_expiry: profile.subscription_expiry ? new Date(profile.subscription_expiry).getTime() : undefined,
    aiUsageCount: profile.ai_usage_count || 0,
    bio: profile.bio || '',
    skills: profile.skills || [],
    experience: profile.experience || '',
    jobsCompleted: profile.jobs_completed || 0,
    joinDate: profile.join_date ? new Date(profile.join_date).getTime() : Date.now(),
    verified: profile.verified,
    reviews: reviews
  };
};

export const getCurrentUser = async (
  existingAuthUser?: any,
  explicitToken?: string
): Promise<{ user: User | null; error?: string }> => {
  try {
    let authUser = existingAuthUser;
    if (!authUser) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      authUser = user;
    }

    if (!authUser) return { user: null };

    let finalProfile: any = null;

    // 1. Fetch Source of Truth from DB using SAFE fetch with timeout
    try {
      const { safeFetch } = await import('./fetchUtils');
      console.log('[AuthService] Fetching profile with safety timeout...');

      // Note: safeFetch automatically handles the token if not provided in headers,
      // but since we might have an explicitToken passed in, we can optimize by using it if present,
      // or letting safeFetch handle it. To keep it simple and leverage safeFetch's auto-auth:
      // We will just pass the URL. If explicitToken is needed for edge cases (like signup where session isn't fully set globally yet), 
      // we can pass it in headers.

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (explicitToken) {
        headers['Authorization'] = `Bearer ${explicitToken}`;
      }

      // safeFetch defaults to 10s, but for profile we might want to be snappier or just stick to standard.
      // Let's stick to the standard 10s to avoid "Safety timeout" race conditions in UserContext.

      const response = await safeFetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${authUser.id}`,
        {
          method: 'GET',
          headers,
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.status}`);
      }

      const profiles = await response.json();
      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // 2. Resilient Auto-creation if missing (Self-Healing Client)
      if (!profile) {
        console.log('[AuthService] No profile found. Initializing Super App profile...');

        const rawName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
        const userName = (rawName && rawName.length > 1) ? rawName : (authUser.email?.split('@')[0] || 'User');

        const profilePayload = {
          id: authUser.id,
          name: userName,
          email: authUser.email || '',
          phone: authUser.phone || `pending_${authUser.id}`,
          location: 'Not set',
          join_date: Date.now(),
          auth_user_id: authUser.id
        };

        try {
          const createResponse = await safeFetch(
            `${supabaseUrl}/rest/v1/profiles`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(profilePayload)
            }
          );

          if (createResponse.ok) {
            const createdData = await createResponse.json();
            profile = createdData && createdData.length > 0 ? createdData[0] : null;
          } else {
            const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
            profile = existing;
          }
        } catch (createErr) {
          const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
          profile = existing;
        }
      }

      finalProfile = profile;
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Profile request timed out.');
      throw err;
    }

    if (!finalProfile) return { user: null, error: 'Database sync failed' };

    // 3. Fetch Reviews
    // 3. Fetch Reviews using safeFetch (Reliable)
    let reviews: any[] = [];
    try {
      const { safeFetch } = await import('./fetchUtils');
      const response = await safeFetch(
        `${supabaseUrl}/rest/v1/reviews?reviewee_id=eq.${authUser.id}&select=*,reviewer:profiles!reviewer_id(name)&order=created_at.desc`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store'
        }
      );

      if (response.ok) {
        const reviewsData = await response.json();
        reviews = (reviewsData || []).map((r: any) => ({
          id: r.id,
          reviewerId: r.reviewer_id,
          reviewerName: r.reviewer?.name || 'User',
          rating: r.rating,
          comment: r.comment,
          date: new Date(r.created_at).getTime(),
          tags: r.tags || []
        }));
      }
    } catch (err) {
      console.warn('[AuthService] Reviews fetch failed, continuing without reviews:', err);
    }

    const user = mapDbProfileToUser(finalProfile, authUser.email, reviews);
    console.log(`[AuthService] Source of Truth Synced: ${user.name} (Phone: ${user.phone})`);
    return { user };

  } catch (error) {
    console.error('[AuthService] Critical Sync Error:', error);
    return { user: null, error: 'Profile synchronization failed' };
  }
};


export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Map frontend User fields to DB Profile fields
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.coordinates?.lat !== undefined) dbUpdates.latitude = updates.coordinates.lat;
    if (updates.coordinates?.lng !== undefined) dbUpdates.longitude = updates.coordinates.lng;
    if (updates.profilePhoto !== undefined) dbUpdates.profile_photo = updates.profilePhoto;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
    if (updates.experience !== undefined) dbUpdates.experience = updates.experience;

    console.log('[AuthService] Updating profile via safe fetch...', dbUpdates);

    // Use safeFetch for standardized timeouts and auth injection
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(dbUpdates)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AuthService] Profile PATCH failed:', response.status, errorText);
      throw new Error(`Profile update failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      console.warn('[AuthService] Profile update affected 0 rows. Likely RLS block or invalid userId.');
      throw new Error('Update failed: No permissions or user not found. Please try logging out and in again.');
    }

    console.log('[AuthService] Profile update verified in DB');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
};


// Direct profile fetch by ID (skips auth check)
export const getUserProfile = async (userId: string): Promise<{ user: User | null; error?: string }> => {
  try {
    // Use safeFetch for standardized timeouts (default 10s) and auth injection
    console.log('[AuthService] Fetching profile directly for:', userId);

    // safeFetch handles the access token automatically if one exists in the session
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`Profile fetch failed: ${response.status}`);
    }

    const profiles = await response.json();
    console.log('[AuthService] Profile REST response:', profiles?.length || 0, 'profiles');
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!profile) {
      console.log('[AuthService] No profile found for userId:', userId);
      return { user: null };
    }

    console.log('[AuthService] Profile found:', profile.name, '- fetching reviews via REST...');

    // Fetch reviews via REST API (same fix as profile - Supabase client hangs)
    let reviews: any[] = [];
    try {
      const reviewsResponse = await safeFetch(
        `${supabaseUrl}/rest/v1/reviews?reviewee_id=eq.${userId}&select=*,reviewer:profiles!reviewer_id(name)&order=created_at.desc`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store'
        }
      );

      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        reviews = (reviewsData || []).map((r: any) => ({
          id: r.id,
          reviewerId: r.reviewer_id,
          reviewerName: r.reviewer?.name || 'User',
          rating: r.rating,
          comment: r.comment,
          date: new Date(r.created_at).getTime(),
          tags: r.tags || []
        }));
        console.log('[AuthService] Reviews loaded via REST:', reviews.length);
      }
    } catch (reviewErr) {
      console.warn('[AuthService] Reviews fetch failed (non-fatal):', reviewErr);
    }

    console.log('[AuthService] Building user object...');

    const user: User = {
      id: profile.id,
      name: profile.name,
      phone: profile.phone || '',
      email: profile.email || '',
      location: profile.location,
      coordinates: profile.latitude && profile.longitude
        ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
        : undefined,
      rating: Number(profile.rating),
      profilePhoto: profile.profile_photo || undefined,
      isPremium: profile.is_premium,
      subscription_plan: profile.subscription_plan, // FIX: Map the plan
      subscription_expiry: profile.subscription_expiry ? new Date(profile.subscription_expiry).getTime() : undefined,
      aiUsageCount: profile.ai_usage_count,
      bio: profile.bio || undefined,
      skills: profile.skills || [],
      experience: profile.experience || undefined,
      jobsCompleted: profile.jobs_completed,
      joinDate: new Date(profile.join_date).getTime(),
      verified: profile.verified,
      reviews: reviews
    };

    return { user };
  } catch (error) {
    console.error('[AuthService] Error fetching profile direclty:', error);
    return { user: null, error: 'Failed to fetch profile' };
  }
};

// Increment AI usage count
export const incrementAIUsage = async (
  userId: string,
  currentCount: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await safeFetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ai_usage_count: currentCount + 1 })
      }
    );

    if (!response.ok) {
      throw new Error(`AI Usage update failed: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error incrementing AI usage:', error);
    return { success: false, error: error.message || 'Failed to update AI usage' };
  }
};



// Permanent Account Deletion
export const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { safeRPC } = await import('./fetchUtils');
    const { error } = await safeRPC('delete_own_account', {});

    if (error) {
      console.error('[AuthService] Delete Account RPC failed:', error);
      return { success: false, error: error.message };
    }

    // Force sign out to clear session
    await signOut();
    return { success: true };
  } catch (error: any) {
    console.error('[AuthService] Error deleting account:', error);
    return { success: false, error: error.message || 'Failed to delete account' };
  }
};
