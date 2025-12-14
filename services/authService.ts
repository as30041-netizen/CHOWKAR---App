import { supabase } from '../lib/supabase';
import { User, Coordinates } from '../types';

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[Auth] Initiating Google OAuth, redirect URL:', window.location.origin);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error('[Auth] OAuth initialization error:', error);
      throw error;
    }

    console.log('[Auth] OAuth redirect initiated successfully');
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error signing in with Google:', error);
    return { success: false, error: 'Failed to sign in with Google' };
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

export const getCurrentUser = async (existingAuthUser?: any): Promise<{ user: User | null; error?: string }> => {
  try {
    let authUser = existingAuthUser;

    if (!authUser) {
      console.log('[AuthService] Fetching auth user from Supabase...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      authUser = user;
    } else {
      console.log('[AuthService] Using provided auth user');
    }

    if (!authUser) return { user: null };

    console.log('[AuthService] Fetching profile from DB for:', authUser.id);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('[AuthService] Profile fetch error:', profileError);
      throw profileError;
    }

    if (!profile) {
      console.log('[Auth] Profile not found, creating one for auth user:', authUser.id);

      const userName = authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User';

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          auth_user_id: authUser.id,
          name: userName,
          email: authUser.email || '',
          phone: '',
          location: 'Not set',
          wallet_balance: 0,
          rating: 5.0,
          profile_photo: authUser.user_metadata?.avatar_url || null,
          is_premium: false,
          ai_usage_count: 0,
          jobs_completed: 0,
          join_date: new Date().toISOString(),
          skills: []
        })
        .select()
        .single();

      if (createError) {
        console.error('[Auth] Error creating profile:', createError);
        return { user: null, error: 'Failed to create user profile' };
      }

      const user: User = {
        id: newProfile.id,
        name: newProfile.name,
        phone: newProfile.phone || '',
        email: newProfile.email || authUser.email || '',
        location: newProfile.location,
        coordinates: undefined,
        walletBalance: newProfile.wallet_balance,
        rating: Number(newProfile.rating),
        profilePhoto: newProfile.profile_photo || undefined,
        isPremium: newProfile.is_premium,
        aiUsageCount: newProfile.ai_usage_count,
        bio: newProfile.bio || undefined,
        skills: newProfile.skills || [],
        experience: newProfile.experience || undefined,
        jobsCompleted: newProfile.jobs_completed,
        joinDate: new Date(newProfile.join_date).getTime(),
        reviews: []
      };

      return { user };
    }

    console.log('[AuthService] Profile found, processing...');
    const user: User = {
      id: profile.id,
      name: profile.name,
      phone: profile.phone || '',
      email: profile.email || authUser.email || '',
      location: profile.location,
      coordinates: profile.latitude && profile.longitude
        ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
        : undefined,
      walletBalance: profile.wallet_balance,
      rating: Number(profile.rating),
      profilePhoto: profile.profile_photo || undefined,
      isPremium: profile.is_premium,
      aiUsageCount: profile.ai_usage_count,
      bio: profile.bio || undefined,
      skills: profile.skills || [],
      experience: profile.experience || undefined,
      jobsCompleted: profile.jobs_completed,
      joinDate: new Date(profile.join_date).getTime(),
      reviews: []
    };

    return { user };
  } catch (error) {
    console.error('Error getting current user:', error);
    return { user: null, error: 'Failed to get current user' };
  }
};

export const completeProfile = async (
  userId: string,
  phone: string,
  location: string,
  coordinates?: Coordinates
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        phone,
        location,
        latitude: coordinates?.lat,
        longitude: coordinates?.lng
      })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error completing profile:', error);
    return { success: false, error: 'Failed to complete profile' };
  }
};

export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
        location: updates.location,
        latitude: updates.coordinates?.lat,
        longitude: updates.coordinates?.lng,
        profile_photo: updates.profilePhoto,
        bio: updates.bio,
        skills: updates.skills,
        experience: updates.experience
      })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }
};

// Update wallet balance
export const updateWalletBalance = async (
  userId: string,
  newBalance: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating wallet:', error);
    return { success: false, error: 'Failed to update wallet' };
  }
};

// Increment AI usage count
export const incrementAIUsage = async (
  userId: string,
  currentCount: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ai_usage_count: currentCount + 1 })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error incrementing AI usage:', error);
    return { success: false, error: 'Failed to update AI usage' };
  }
};
