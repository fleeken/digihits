-- Run once in Supabase SQL Editor. Existing online notification settings stay intact.
-- Multi-phone rooms use M0 codes. Pass-one-phone matches already use S0,
-- have a single backend participant and are excluded from turn reminders.
begin;

create or replace function public.digihits_disable_room_turn_notices()
returns trigger language plpgsql set search_path = public as $$
begin
  new.turn_started_at := null;
  new.turn_reminder_sent_at := null;
  new.turn_notice := null;
  return new;
end;
$$;

drop trigger if exists digihits_room_turn_notices_off on public.online_matches;
create trigger digihits_room_turn_notices_off
before insert or update on public.online_matches
for each row when (new.code like 'M0%')
execute function public.digihits_disable_room_turn_notices();

-- Reuse existing functions, including their existing authentication settings.
do $$ begin
  if to_regprocedure('public.digihits_notify_turn()') is not null then
    execute 'drop trigger if exists digihits_turn_push on public.online_matches';
    execute 'create trigger digihits_turn_push after update of current_user_id on public.online_matches
      for each row when (old.current_user_id is distinct from new.current_user_id and new.code not like ''M0%'')
      execute function public.digihits_notify_turn()';
  end if;
  if to_regprocedure('public.digihits_notify_match_invite()') is not null then
    execute 'drop trigger if exists digihits_match_invite_push on public.digihits_match_invites';
    execute 'create trigger digihits_match_invite_push after insert on public.digihits_match_invites
      for each row when (new.match_code not like ''M0%'')
      execute function public.digihits_notify_match_invite()';
  end if;
end; $$;

update public.online_matches
set turn_started_at = null, turn_reminder_sent_at = null, turn_notice = null
where code like 'M0%';

commit;
