-- DIAGNOSE CHAT MESSAGES
-- Job ID: da02fe47-8605-4a4a-a9ab-22b3dec47864
-- User ID: e266fa3d-d854-4445-be8b-cd054a2fa859

SELECT 
    id, 
    sender_id, 
    receiver_id, 
    text::text, 
    CASE 
        WHEN sender_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859' THEN 'SENT_BY_USER' 
        ELSE 'RECEIVED_BY_USER' 
    END as direction
FROM chat_messages
WHERE job_id = 'da02fe47-8605-4a4a-a9ab-22b3dec47864';
