-- Daily opt-in reactivation emails. The endpoint reuses the existing DB-held cron key.
SELECT cron.schedule(
  'reactivation-emails-daily',
  '0 12 * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://project--7ebcd4f0-8a39-476b-b592-5d7dcbafe131.lovable.app/api/public/cron/reactivation-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT key FROM public.push_cron_key WHERE id = 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);
