/*
  ============================================================
  ENHANCED ADMIN CONFIGURATION - COIN RATIO SUPPORT
  ============================================================
  This script adds the 'coin_price_inr' setting to allow
  dynamic control over the exchange rate.
  ============================================================
*/

BEGIN;

-- Insert the new ratio setting if it doesn't exist
INSERT INTO public.global_settings (key, value, description)
VALUES 
    ('coin_price_inr', '1', 'Price of 1 Coin in ₹ (INR)')
ON CONFLICT (key) DO NOTHING;

COMMIT;

SELECT '✅ Coin Ratio setting added successfully' as status;
