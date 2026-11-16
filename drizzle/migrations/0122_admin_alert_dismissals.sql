-- Persist admin dismissals without deleting operational or product history.
CREATE TABLE IF NOT EXISTS public.admin_alert_dismissals (
  alert_key text PRIMARY KEY,
  dismissed_by uuid NOT NULL REFERENCES auth.users(id),
  dismissed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alert_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_alert_dismissals_admin_read ON public.admin_alert_dismissals;
CREATE POLICY admin_alert_dismissals_admin_read
  ON public.admin_alert_dismissals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
