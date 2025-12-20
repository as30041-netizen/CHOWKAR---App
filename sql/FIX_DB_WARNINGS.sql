-- FIX SECURITY WARNINGS (Corrected)
-- Only targeting functions we confirmed exist.

ALTER FUNCTION public.accept_bid(uuid, uuid, uuid, uuid, integer, integer) SET search_path = public;

ALTER FUNCTION public.update_user_rating() SET search_path = public;

-- Optional: try this, but if it fails, ignore it.
-- ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
