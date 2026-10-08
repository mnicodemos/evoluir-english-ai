-- Launch campaign: the first 10 students who sign up from 10/10/2026
-- (São Paulo time) get 10 days of Premium. The 11th signup gets nothing and
-- the campaign is over once its 10 places are taken.
--
-- Premium access is the entitlements rows (AI quotas read them through
-- has_active_entitlement), granted here with expires_at = signup + 10 days, so
-- access ends on its own. profiles.plan only drives the "Premium" badge; it is
-- set at signup and put back to 'free' by the daily push cron (service role,
-- expireCampaignPremium in src/lib/premiumCampaign.server.ts), unless the
-- student subscribed meanwhile. Idempotent.

CREATE TABLE IF NOT EXISTS public.premium_campaigns (
  id text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  slots integer NOT NULL CHECK (slots > 0),
  days integer NOT NULL CHECK (days > 0),
  enabled boolean NOT NULL DEFAULT true
);

INSERT INTO public.premium_campaigns (id, starts_at, slots, days)
VALUES ('launch-10', '2026-10-10 00:00:00-03', 10, 10)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.premium_campaign_grants (
  campaign_id text NOT NULL REFERENCES public.premium_campaigns (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (campaign_id, user_id)
);

ALTER TABLE public.premium_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_campaign_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_campaigns, public.premium_campaign_grants
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premium_campaigns, public.premium_campaign_grants TO service_role;

-- BEFORE INSERT on profiles: claims a place (one at a time, under a lock) and
-- marks the new profile as Premium until the end of the campaign period.
CREATE OR REPLACE FUNCTION public.claim_premium_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign public.premium_campaigns%ROWTYPE;
  v_taken integer;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_campaign FROM public.premium_campaigns
  WHERE enabled AND starts_at <= now()
  ORDER BY starts_at
  LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('premium_campaign:' || v_campaign.id));
  SELECT count(*) INTO v_taken FROM public.premium_campaign_grants
  WHERE campaign_id = v_campaign.id;
  IF v_taken >= v_campaign.slots THEN RETURN NEW; END IF;

  v_expires := now() + make_interval(days => v_campaign.days);
  INSERT INTO public.premium_campaign_grants (campaign_id, user_id, expires_at)
  VALUES (v_campaign.id, NEW.id, v_expires)
  ON CONFLICT DO NOTHING;

  NEW.plan := 'premium';
  NEW.plan_started_at := now();
  NEW.plan_expires_at := v_expires;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A campaign problem must never block a signup.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_premium_campaign() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_claim_premium_campaign ON public.profiles;
CREATE TRIGGER profiles_claim_premium_campaign
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.claim_premium_campaign();

-- AFTER INSERT on profiles: the Premium access itself (entitlements reference
-- profiles, so they are written once the row exists).
CREATE OR REPLACE FUNCTION public.grant_premium_campaign_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expires timestamptz;
BEGIN
  SELECT expires_at INTO v_expires FROM public.premium_campaign_grants
  WHERE user_id = NEW.id
  ORDER BY granted_at DESC
  LIMIT 1;
  IF v_expires IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.entitlements (user_id, feature, plan, granted_at, expires_at)
  SELECT NEW.id, feature, 'premium', now(), v_expires
  FROM unnest(ARRAY['ai_teacher', 'ai_talking', 'writing_correction', 'advanced_reports']) AS feature
  ON CONFLICT (user_id, feature) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_premium_campaign_access() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_grant_premium_campaign ON public.profiles;
CREATE TRIGGER profiles_grant_premium_campaign
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_premium_campaign_access();

-- Public status for the site popup: only counts, never who took a place.
CREATE OR REPLACE FUNCTION public.premium_campaign_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'active', c.enabled AND c.starts_at <= now() AND taken.n < c.slots,
        'starts_at', c.starts_at,
        'slots', c.slots,
        'slots_left', greatest(c.slots - taken.n, 0),
        'days', c.days)
     FROM public.premium_campaigns c
     CROSS JOIN LATERAL (
       SELECT count(*)::integer AS n FROM public.premium_campaign_grants g
       WHERE g.campaign_id = c.id
     ) taken
     WHERE c.enabled
     ORDER BY c.starts_at DESC
     LIMIT 1),
    jsonb_build_object('active', false));
$$;

REVOKE ALL ON FUNCTION public.premium_campaign_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.premium_campaign_status() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
