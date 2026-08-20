create extension if not exists pg_net;

create or replace function public.digihits_notify_turn()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://zttkujhoyuxerdewofkb.supabase.co/functions/v1/turn-notification',
    body := jsonb_build_object('record', to_jsonb(new), 'old_record', to_jsonb(old)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-digihits-push-secret', '76y1MlUG4jxmWsB9i_ZDcf3n1Ld9gITR_QRLQDZdBcM'),
    timeout_milliseconds := 1000
  );
  return new;
end;
$$;

drop trigger if exists digihits_turn_push on public.online_matches;
create trigger digihits_turn_push
after update of current_user_id on public.online_matches
for each row
when (old.current_user_id is distinct from new.current_user_id)
execute function public.digihits_notify_turn();
