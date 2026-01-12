-- Check bids table UPDATE policies
SELECT policyname, cmd, qual as using_expr, with_check 
FROM pg_policies 
WHERE tablename = 'bids' AND cmd = 'UPDATE';
