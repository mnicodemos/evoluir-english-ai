-- Persist admin replies sent through Resend and retain RFC message IDs for threading.
ALTER TABLE public.admin_email_messages
  ADD COLUMN IF NOT EXISTS internet_message_id text;

CREATE TABLE IF NOT EXISTS public.admin_email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  parent_message_id uuid NOT NULL REFERENCES public.admin_email_messages(id) ON DELETE CASCADE,
  resend_email_id text,
  recipient_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_email_replies_parent_idx
  ON public.admin_email_replies(parent_message_id, created_at ASC);

ALTER TABLE public.admin_email_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_email_replies_admin_access ON public.admin_email_replies;
CREATE POLICY admin_email_replies_admin_access
  ON public.admin_email_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
