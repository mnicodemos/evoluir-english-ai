SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-push-word'),
  command := $cmd$select net.http_post(url:='https://project--7ebcd4f0-8a39-476b-b592-5d7dcbafe131.lovable.app/api/public/cron/daily-push', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select key from public.push_cron_key where id=1)), body:='{"kind":"word"}'::jsonb, timeout_milliseconds:=60000)$cmd$
) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-push-word');

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-push-reminder'),
  command := $cmd$select net.http_post(url:='https://project--7ebcd4f0-8a39-476b-b592-5d7dcbafe131.lovable.app/api/public/cron/daily-push', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select key from public.push_cron_key where id=1)), body:='{"kind":"reminder"}'::jsonb, timeout_milliseconds:=60000)$cmd$
) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-push-reminder');