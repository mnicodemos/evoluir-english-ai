-- Security audit (2026-10-09): has_active_entitlement answers only for the
-- caller's own account (or the server's service role), like has_role since
-- migration 0029, so a student cannot ask whether another account is Premium.
-- The server (service role) and reserve_ai_usage keep working unchanged.
-- Idempotent: CREATE OR REPLACE and GRANT can run more than once.

CREATE OR REPLACE FUNCTION public.has_active_entitlement(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR auth.uid() = _user_id THEN EXISTS (
      SELECT 1
      FROM public.entitlements
      WHERE user_id = _user_id
        AND feature = _feature
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.has_active_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_entitlement(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
