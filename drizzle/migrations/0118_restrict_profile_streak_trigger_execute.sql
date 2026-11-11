-- Trigger-only guard: browser roles must not invoke this trigger function directly.
-- PostgreSQL checks EXECUTE privilege when a trigger is created, not on each
-- trigger invocation, so existing profile protection triggers keep working.
-- SECURITY INVOKER is preserved so the function can distinguish browser roles
-- from trusted database writers through current_user.

REVOKE ALL ON FUNCTION public.protect_profile_streak_fields()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
