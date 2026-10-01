-- Run once in Supabase SQL Editor. Only normal online matches are affected.
begin;
create or replace function public.digihits_lock_online_round_two()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active and coalesce(new.rounds_started,0) >= 2 then
    update public.online_matches set phase='locked'
      where id=new.match_id and status='active' and code not like 'M0%' and code not like 'S0%';
  end if;
  return new;
end $$;
drop trigger if exists digihits_online_round_two_lock on public.online_players;
create trigger digihits_online_round_two_lock after insert or update of rounds_started on public.online_players
for each row execute function public.digihits_lock_online_round_two();

create or replace function public.digihits_guard_online_new_participant()
returns trigger language plpgsql security definer set search_path=public as $$
declare m public.online_matches%rowtype;
begin
  if tg_table_name='digihits_match_invites' then
    select * into m from public.online_matches where code=new.match_code for update;
  else
    select * into m from public.online_matches where id=new.match_id for update;
  end if;
  if m.id is not null and m.code not like 'M0%' and m.code not like 'S0%' then
    if m.status='finished' then raise exception 'Matchen är avslutad.'; end if;
    if m.phase='locked' or exists (select 1 from public.online_players where match_id=m.id and active and rounds_started>=2) then
      raise exception 'Matchen är låst eftersom omgång 2 har startat.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists digihits_online_invitation_guard on public.digihits_match_invites;
create trigger digihits_online_invitation_guard before insert on public.digihits_match_invites
for each row execute function public.digihits_guard_online_new_participant();
drop trigger if exists digihits_online_join_guard on public.online_players;
create trigger digihits_online_join_guard before insert on public.online_players
for each row execute function public.digihits_guard_online_new_participant();

update public.online_matches m set phase='locked'
where status='active' and code not like 'M0%' and code not like 'S0%'
and exists (select 1 from public.online_players p where p.match_id=m.id and p.active and p.rounds_started>=2);
commit;
