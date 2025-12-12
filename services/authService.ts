import { supabase } from '../lib/supabase';
import { User, Coordinates } from '../types';

export interface SignUpData {
  phone: string;
  name: string;
  location: string;
  coordinates?: Coordinates;
}

// For development/testing: Mock OTP verification
// In production, this would integrate with an SMS provider
export const sendOTP = async (phone: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // TODO: Integrate with SMS provider (Twilio, MSG91, etc.)
    // For now, we'll just return success
    console.log(`OTP would be sent to: ${phone}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: 'Failed to send OTP' };
  }
};

// Verify OTP and sign in/sign up
export const verifyOTP = async (
  phone: string,
  otp: string,
  signUpData?: SignUpData
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // For development: Accept 123456 as valid OTP
    if (otp !== '123456') {
      return { success: false, error: 'Invalid OTP' };
    }

    // Check if user exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    if (existingProfile) {
      // User exists - sign in
      // Create a session using Supabase auth
      // For now, we'll use a mock user ID based on phone
      const mockUserId = `user_${phone.replace(/\D/g, '')}`;

      const user: User = {
        id: existingProfile.id,
        name: existingProfile.name,
        phone: existingProfile.phone,
        location: existingProfile.location,
        coordinates: existingProfile.latitude && existingProfile.longitude
          ? { lat: Number(existingProfile.latitude), lng: Number(existingProfile.longitude) }
          : undefined,
        walletBalance: existingProfile.wallet_balance,
        rating: Number(existingProfile.rating),
        profilePhoto: existingProfile.profile_photo || undefined,
        isPremium: existingProfile.is_premium,
        aiUsageCount: existingProfile.ai_usage_count,
        bio: existingProfile.bio || undefined,
        skills: existingProfile.skills || [],
        experience: existingProfile.experience || undefined,
        jobsCompleted: existingProfile.jobs_completed,
        joinDate: new Date(existingProfile.join_date).getTime(),
        reviews: [] // Load reviews separately if needed
      };

      return { success: true, user };
    } else {
      // User doesn't exist - sign up
      if (!signUpData) {
        return { success: false, error: 'Sign up data required' };
      }

      // Generate a unique user ID
      const userId = crypto.randomUUID();

      // Create profile
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: signUpData.name,
          phone: signUpData.phone,
          location: signUpData.location,
          latitude: signUpData.coordinates?.lat,
          longitude: signUpData.coordinates?.lng,
          wallet_balance: 100, // Welcome bonus
          rating: 5.0,
          is_premium: false,
          ai_usage_count: 0,
          jobs_completed: 0
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create welcome transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: 100,
          type: 'CREDIT',
          description: 'Welcome Bonus'
        });

      const user: User = {
        id: newProfile.id,
        name: newProfile.name,
        phone: newProfile.phone,
        location: newProfile.location,
        coordinates: newProfile.latitude && newProfile.longitude
          ? { lat: Number(newProfile.latitude), lng: Number(newProfile.longitude) }
          : undefined,
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

      return { success: true, user };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
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
