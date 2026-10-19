-- WhatsApp study integration foundation.
-- Phone ownership is established only after the user confirms a one-time code in WhatsApp.
-- These tables are server-managed; client roles cannot read or write them.

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL UNIQUE,
  connected_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_connections_phone_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_link_codes_user_created_idx
  ON public.whatsapp_link_codes (user_id, created_at DESC);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_connections FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_link_codes FROM anon, authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;
GRANT ALL ON public.whatsapp_link_codes TO service_role;
