-- Digihits: 48 h påminnelse och automatiskt turbyte efter 72 h.
-- Ersätt YOUR_PUSH_WEBHOOK_SECRET med samma värde som PUSH_WEBHOOK_SECRET
-- i Supabase Edge Function-secrets. Kör sedan hela filen i SQL Editor.

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.online_matches
  add column if not exists turn_started_at timestamptz,
  add column if not exists turn_reminder_sent_at timestamptz,
  add column if not exists turn_notice jsonb;

update public.online_matches
set turn_started_at = coalesce(turn_started_at, updated_at, now())
where status = 'active' and current_user_id is not null and turn_started_at is null;

select cron.unschedule(jobid)
from cron.job
where jobname = 'digihits-turn-watchdog';

select cron.schedule(
  'digihits-turn-watchdog',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://zttkujhoyuxerdewofkb.supabase.co/functions/v1/turn-watchdog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-digihits-push-secret', 'YOUR_PUSH_WEBHOOK_SECRET'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
