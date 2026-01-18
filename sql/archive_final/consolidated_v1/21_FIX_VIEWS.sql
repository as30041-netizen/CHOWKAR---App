-- ============================================================================
-- SECURE VIEWS
-- Ensure deleted reviews are filtered out at the DB level
-- ============================================================================

CREATE OR REPLACE VIEW view_reviews AS
SELECT 
    r.id,
    r.reviewer_id,
    p.name as reviewer_name,
    p.profile_photo as reviewer_photo,
    r.reviewee_id,
    r.job_id,
    r.rating,
    r.comment,
    r.tags,
    r.created_at,
    r.is_deleted -- Optional: Keep false only
FROM reviews r
LEFT JOIN profiles p ON r.reviewer_id = p.id
WHERE (r.is_deleted IS NULL OR r.is_deleted = FALSE);

-- Grant access
GRANT SELECT ON view_reviews TO authenticated;
GRANT SELECT ON view_reviews TO anon;
