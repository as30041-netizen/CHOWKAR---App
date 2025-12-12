import { supabase } from '../lib/supabase';
import { User, Coordinates } from '../types';

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  try {
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

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error signing in with Google:', error);
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

export const getCurrentUser = async (): Promise<{ user: User | null; error?: string }> => {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!authUser) return { user: null };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return { user: null };

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
