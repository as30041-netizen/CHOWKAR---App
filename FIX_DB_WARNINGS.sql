-- FIX SECURITY WARNINGS (Mutable Search Path)
-- Explicitly force functions to use ONLY the 'public' schema
-- This prevents "search path hijacking" attacks.

ALTER FUNCTION public.accept_bid(uuid, uuid, uuid, uuid, integer, integer) SET search_path = public;

ALTER FUNCTION public.update_user_rating() SET search_path = public;

-- Also fixing common helpers likely present in your DB
ALTER FUNCTION public.calculate_distance(double precision, double precision, double precision, double precision) SET search_path = public;

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
