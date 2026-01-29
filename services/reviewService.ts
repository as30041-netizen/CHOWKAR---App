import { safeFetch, safeRPC } from './fetchUtils';
import { logger } from '../lib/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export interface Review {
    id: string;
    reviewerId: string;
    reviewerName: string;
    reviewerPhoto?: string;
    revieweeId: string;
    jobId: string;
    rating: number;
    comment: string;
    date: number;
    isDeleted: boolean;
    tags?: string[];
}

/**
 * Fetch reviews for a user using the Secure View
 */
export const fetchUserReviews = async (userId: string): Promise<Review[]> => {
    try {
        // Query view_reviews instead of raw table
        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/view_reviews?reviewee_id=eq.${userId}&order=created_at.desc`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch reviews: ${response.status}`);
        }

        const data = await response.json();

        return data.map((r: any) => ({
            id: r.id,
            reviewerId: r.reviewer_id,
            reviewerName: r.reviewer_name || 'User',
            reviewerPhoto: r.reviewer_photo,
            revieweeId: r.reviewee_id,
            jobId: r.job_id,
            rating: r.rating,
            comment: r.comment, // Already masked by the View if deleted
            date: new Date(r.created_at).getTime(),
            isDeleted: r.is_deleted,
            tags: r.tags || []
        }));
    } catch (error) {
        console.error('[ReviewService] Error fetching reviews:', error);
        return [];
    }
};

/**
 * Submit a new review
 */
export const submitReview = async (
    reviewerId: string,
    revieweeId: string,
    jobId: string,
    rating: number,
    comment: string,
    tags: string[] = []
): Promise<{ success: boolean; error?: string }> => {
    try {
        logger.log('[ReviewService] Submitting review...');
        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/reviews`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    reviewer_id: reviewerId,
                    reviewee_id: revieweeId,
                    job_id: jobId,
                    rating,
                    comment,
                    tags
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Review submission failed: ${response.status}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('[ReviewService] Submit error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Soft Delete a review
 */
export const deleteReview = async (reviewId: string): Promise<{ success: boolean; error?: string }> => {
    // Use the secure RPC function
    const { error } = await safeRPC('soft_delete_review', { p_review_id: reviewId });

    if (error) {
        console.error('[ReviewService] Delete error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
};
