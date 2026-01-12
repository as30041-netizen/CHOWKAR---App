-- CHECK CHAT CONTENT & PARTICIPANTS (FIXED COLUMN NAMES)
WITH target_job AS (
  SELECT id FROM jobs WHERE title = 'Kaam krne wali chaiye' LIMIT 1
)
SELECT 
  cm.id,
  cm.job_id,
  cm.sender_id,
  cm.receiver_id,
  LEFT(cm.text, 30) as text,
  cm.created_at,
  p_sender.name as sender,
  p_receiver.name as receiver
FROM chat_messages cm
JOIN profiles p_sender ON cm.sender_id = p_sender.id
JOIN profiles p_receiver ON cm.receiver_id = p_receiver.id
WHERE cm.job_id IN (SELECT id FROM target_job)
ORDER BY cm.created_at DESC;

-- ALSO CHECK: Did the notification get created for the worker?
SELECT 
  n.id,
  n.user_id,
  n.title,
  n.message,
  n.read,
  n.created_at
FROM notifications n
WHERE n.related_job_id IN (SELECT id FROM jobs WHERE title = 'Kaam krne wali chaiye')
AND n.title LIKE 'New Message%'
ORDER BY n.created_at DESC;
