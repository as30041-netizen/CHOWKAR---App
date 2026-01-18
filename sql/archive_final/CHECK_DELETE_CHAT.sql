-- check_delete_chat_source.sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'delete_chat';
