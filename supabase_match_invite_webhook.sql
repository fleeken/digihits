create extension if not exists pg_net;

create or replace function public.digihits_notify_match_invite()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://zttkujhoyuxerdewofkb.supabase.co/functions/v1/match-invitation-notification',
    body := jsonb_build_object('record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-digihits-push-secret', '76y1MlUG4jxmWsB9i_ZDcf3n1Ld9gITR_QRLQDZdBcM'),
    timeout_milliseconds := 1000
  );
  return new;
end;
$$;

drop trigger if exists digihits_match_invite_push on public.digihits_match_invites;
create trigger digihits_match_invite_push
after insert on public.digihits_match_invites
for each row execute function public.digihits_notify_match_invite();
