-- Admin Email Center tables must be applied through the Lovable Cloud Drizzle migration pipeline.
-- OAuth verifier/state and mailbox tokens are server-only; no client RLS policies are created.
CREATE TABLE IF NOT EXISTS public.admin_email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'microsoft'),
  mailbox_email text NOT NULL,
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  delta_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_email_connections_active_provider_idx
  ON public.admin_email_connections(provider)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.admin_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  provider_conversation_id text,
  mailbox text NOT NULL CHECK (mailbox IN ('contact', 'support', 'unknown')),
  from_address text NOT NULL,
  to_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_email_messages_received_idx
  ON public.admin_email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS admin_email_messages_conversation_idx
  ON public.admin_email_messages(provider_conversation_id);

CREATE TABLE IF NOT EXISTS public.admin_email_oauth_states (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verifier_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_email_oauth_states_expiry_idx
  ON public.admin_email_oauth_states(expires_at);

ALTER TABLE public.admin_email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_oauth_states ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
