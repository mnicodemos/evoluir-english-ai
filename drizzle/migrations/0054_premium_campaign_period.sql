ALTER TABLE public.premium_campaigns ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.premium_campaigns ALTER COLUMN slots DROP NOT NULL;

UPDATE public.premium_campaigns
SET slots = NULL,
    ends_at = '2026-10-21 00:00:00-03',
    starts_at = '2026-10-10 00:00:00-03',
    days = 10
WHERE id = 'launch-10';

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
  WHERE enabled
    AND starts_at <= now()
    AND (ends_at IS NULL OR now() < ends_at)
  ORDER BY starts_at
  LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_campaign.slots IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('premium_campaign:' || v_campaign.id));
    SELECT count(*) INTO v_taken FROM public.premium_campaign_grants
    WHERE campaign_id = v_campaign.id;
    IF v_taken >= v_campaign.slots THEN RETURN NEW; END IF;
  END IF;

  v_expires := now() + make_interval(days => v_campaign.days);
  INSERT INTO public.premium_campaign_grants (campaign_id, user_id, expires_at)
  VALUES (v_campaign.id, NEW.id, v_expires)
  ON CONFLICT DO NOTHING;

  NEW.plan := 'premium';
  NEW.plan_started_at := now();
  NEW.plan_expires_at := v_expires;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_premium_campaign() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.premium_campaign_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'active', c.enabled
          AND c.starts_at <= now()
          AND (c.ends_at IS NULL OR now() < c.ends_at)
          AND (c.slots IS NULL OR taken.n < c.slots),
        'starts_at', c.starts_at,
        'ends_at', c.ends_at,
        'slots', c.slots,
        'slots_left', CASE WHEN c.slots IS NULL THEN NULL ELSE greatest(c.slots - taken.n, 0) END,
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