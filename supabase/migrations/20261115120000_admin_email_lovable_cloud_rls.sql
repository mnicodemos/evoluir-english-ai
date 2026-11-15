-- Admin Email Center: authenticated admin access through the existing Lovable Cloud session.
-- Secrets remain encrypted in the database; non-admin users cannot read or mutate these tables.

DO $$
BEGIN
  IF to_regclass('public.admin_email_connections') IS NULL
     OR to_regclass('public.admin_email_messages') IS NULL
     OR to_regclass('public.admin_email_oauth_states') IS NULL THEN
    RAISE EXCEPTION 'Admin Email base tables are missing. Run the three Admin Email foundation migrations first.';
  END IF;
END
$$;

ALTER TABLE public.admin_email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_connections_admin_access ON public.admin_email_connections;
CREATE POLICY admin_email_connections_admin_access
  ON public.admin_email_connections
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admin_email_messages_admin_access ON public.admin_email_messages;
CREATE POLICY admin_email_messages_admin_access
  ON public.admin_email_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admin_email_oauth_states_admin_access ON public.admin_email_oauth_states;
CREATE POLICY admin_email_oauth_states_admin_access
  ON public.admin_email_oauth_states
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS admin_email_oauth_states_expiry_idx
  ON public.admin_email_oauth_states(expires_at);
