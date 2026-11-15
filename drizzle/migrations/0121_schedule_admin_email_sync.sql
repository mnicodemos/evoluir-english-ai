-- Synchronize the admin Contato and Suporte inboxes every 30 minutes.
-- Reuses the existing database-held scheduler key; no browser credential is exposed.
SELECT cron.schedule(
  'admin-email-sync-every-30-minutes',
  '*/30 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://project--7ebcd4f0-8a39-476b-b592-5d7dcbafe131.lovable.app/api/public/cron/admin-email-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT key FROM public.push_cron_key WHERE id = 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);
