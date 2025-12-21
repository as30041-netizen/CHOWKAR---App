// Supabase Storage Service for file uploads
// Uploads files to Supabase Storage and returns public URLs

import { supabase } from '../lib/supabase';

const JOB_IMAGES_BUCKET = 'job-images';

/**
 * Upload a job image to Supabase Storage
 * @param base64Data - Base64 encoded image data (without data URL prefix)
 * @param jobId - Job ID or temp ID for file naming
 * @param mimeType - Image MIME type (default: image/jpeg)
 * @returns Public URL of the uploaded image, or null on error
 */
export const uploadJobImage = async (
    base64Data: string,
    jobId: string,
    mimeType: string = 'image/jpeg'
): Promise<{ url: string | null; error: string | null }> => {
    try {
        // Convert base64 to Blob
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: mimeType });

        // Generate unique filename
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${jobId}_${Date.now()}.${extension}`;
        const filePath = `jobs/${fileName}`;

        console.log('[Storage] Uploading image:', filePath);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(JOB_IMAGES_BUCKET)
            .upload(filePath, blob, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error('[Storage] Upload error:', error);
            return { url: null, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(JOB_IMAGES_BUCKET)
            .getPublicUrl(data.path);

        console.log('[Storage] Upload successful:', urlData.publicUrl);
        return { url: urlData.publicUrl, error: null };

    } catch (err: any) {
        console.error('[Storage] Unexpected error:', err);
        return { url: null, error: err.message || 'Failed to upload image' };
    }
};

/**
 * Delete a job image from Supabase Storage
 * @param imageUrl - Full public URL of the image
 */
export const deleteJobImage = async (imageUrl: string): Promise<{ success: boolean; error: string | null }> => {
    try {
        // Extract file path from URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/job-images/jobs/filename.jpg
        const urlParts = imageUrl.split('/job-images/');
        if (urlParts.length < 2) {
            return { success: false, error: 'Invalid image URL format' };
        }

        const filePath = urlParts[1];
        console.log('[Storage] Deleting image:', filePath);

        const { error } = await supabase.storage
            .from(JOB_IMAGES_BUCKET)
            .remove([filePath]);

        if (error) {
            console.error('[Storage] Delete error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, error: null };
    } catch (err: any) {
        console.error('[Storage] Unexpected delete error:', err);
        return { success: false, error: err.message || 'Failed to delete image' };
    }
};

/**
 * Check if a string is a base64 data URL (vs a URL)
 */
export const isBase64Image = (str: string): boolean => {
    return str.startsWith('data:image/');
};

const PROFILE_IMAGES_BUCKET = 'job-images';  // Reuse same bucket, different folder

/**
 * Upload a profile image to Supabase Storage
 * @param base64Data - Base64 encoded image data (without data URL prefix)
 * @param userId - User ID for file naming
 * @param mimeType - Image MIME type (default: image/jpeg)
 * @returns Public URL of the uploaded image, or null on error
 */
export const uploadProfileImage = async (
    base64Data: string,
    userId: string,
    mimeType: string = 'image/jpeg'
): Promise<{ url: string | null; error: string | null }> => {
    try {
        // Convert base64 to Blob
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: mimeType });

        // Generate unique filename
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${userId}_${Date.now()}.${extension}`;
        const filePath = `profiles/${fileName}`;

        console.log('[Storage] Uploading profile image:', filePath);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(PROFILE_IMAGES_BUCKET)
            .upload(filePath, blob, {
                contentType: mimeType,
                upsert: true  // Allow overwrite for profile photos
            });

        if (error) {
            console.error('[Storage] Profile upload error:', error);
            return { url: null, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(PROFILE_IMAGES_BUCKET)
            .getPublicUrl(data.path);

        console.log('[Storage] Profile upload successful:', urlData.publicUrl);
        return { url: urlData.publicUrl, error: null };

    } catch (err: any) {
        console.error('[Storage] Unexpected profile upload error:', err);
        return { url: null, error: err.message || 'Failed to upload profile image' };
    }
};
