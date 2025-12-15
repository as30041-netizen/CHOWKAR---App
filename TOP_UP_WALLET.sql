-- Add money to a user's wallet (replace EMAIL with the actual user email from logs)
-- The log showed the user email is: as30041@gmail.com

UPDATE profiles 
SET wallet_balance = wallet_balance + 1000 
WHERE email = 'as30041@gmail.com';

-- Verify the update
SELECT email, wallet_balance FROM profiles WHERE email = 'as30041@gmail.com';
