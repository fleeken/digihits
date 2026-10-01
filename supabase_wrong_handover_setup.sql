-- Digihits: run this complete file in the project's Supabase SQL Editor.
-- Server handover runs independently of browser/iOS background execution.
-- Requires pg_cron with support for second-based schedules (version 1.5+).
create extension if not exists pg_cron;
create table if not exists public.digihits_wrong_handovers (
  match_code text primary key, owner_id text not null, card_id text not null,
  due_at timestamptz not null, snapshot jsonb not null, local_snapshot jsonb,
  completed boolean not null default false, finished boolean not null default false,
  winner_name text
);
alter table public.digihits_wrong_handovers enable row level security;
revoke all on public.digihits_wrong_handovers from anon, authenticated;

create or replace function public.digihits_run_wrong_handovers()
returns void language plpgsql security definer set search_path=public as $$
declare
  q public.digihits_wrong_handovers%rowtype;
  m public.online_matches%rowtype; p public.online_players%rowtype;
  next_p public.online_players%rowtype;
  lr jsonb; loc jsonb; ps jsonb; a jsonb; ai jsonb; chosen jsonb;
  idx integer; nxt integer; count_players integer; ai_right boolean; won boolean;
  swaps integer; wrong_cards jsonb; winner text;
begin
  for q in select * from public.digihits_wrong_handovers
    where not completed and due_at <= now() for update skip locked
  loop
    select * into m from public.online_matches where code=q.match_code for update;
    select * into p from public.online_players
      where match_id=m.id and user_id::text=q.owner_id and active for update;
    if m.status <> 'active' or m.current_user_id::text is distinct from q.owner_id
      or p.current_card->>'id' is distinct from q.card_id then
      update public.digihits_wrong_handovers set completed=true where match_code=q.match_code;
      continue;
    end if;
    wrong_cards := coalesce(q.snapshot->'unlocked',p.turn_cards,'[]'::jsonb) ||
      jsonb_build_array(q.snapshot->'card' || jsonb_build_object('status','FELPLACERAT'));
    lr := jsonb_build_object('ended_at',now(),'rounds',coalesce(p.rounds_started,0),
      'outcome','wrong','guess',coalesce(q.snapshot->'guess','{}'::jsonb),
      'cards',wrong_cards,'timeline',q.snapshot->'timeline',
      'score',jsonb_build_object('correct',least(10,greatest(1,jsonb_array_length(coalesce(p.locked_timeline,'[]'::jsonb)))),
        'mistakes',coalesce((p.last_round->'score'->>'mistakes')::integer,0)+1));
    swaps := least(3,coalesce(p.swap_cards,0)+coalesce((q.snapshot->>'pending_swap_cards')::integer,0));
    won := false; winner := null; loc := q.local_snapshot;
    if loc is not null then
      ps := loc->'players'; idx := (loc->>'current')::integer;
      count_players := jsonb_array_length(ps); a := ps->idx;
      a := a || jsonb_build_object('rounds',coalesce((a->>'rounds')::integer,0)+1,
        'mistakes',coalesce((a->>'mistakes')::integer,0)+1,'swapCards',swaps);
      lr := lr || jsonb_build_object('rounds',a->'rounds',
        'score',jsonb_build_object('correct',jsonb_array_length(a->'timeline'),'mistakes',a->'mistakes'));
      a := a || jsonb_build_object('lastRound',lr);
      ps := jsonb_set(ps,array[idx::text],a); nxt := (idx+1)%count_players;
      if loc->>'mode'='computer' and nxt=1 then
        ai := ps->1;
        select value into chosen from jsonb_array_elements(coalesce(m.deck,'[]'::jsonb)) d
          where not exists (select 1 from jsonb_array_elements(ai->'timeline') t where t->>'id'=d.value->>'id')
          order by random() limit 1;
        ai_right := chosen is not null and random()<0.68;
        ai := ai || jsonb_build_object('rounds',coalesce((ai->>'rounds')::integer,0)+1,
          'mistakes',coalesce((ai->>'mistakes')::integer,0)+case when ai_right then 0 else 1 end);
        if ai_right then ai := ai || jsonb_build_object('timeline',ai->'timeline'||jsonb_build_array(chosen)); end if;
        won := jsonb_array_length(ai->'timeline')>=10;
        ai := ai || jsonb_build_object('lastRound',jsonb_build_object('ended_at',now(),
          'rounds',ai->'rounds','outcome',case when won then 'won' when ai_right then 'locked' else 'wrong' end,
          'cards',case when chosen is null then '[]'::jsonb else jsonb_build_array(chosen||jsonb_build_object('status',case when ai_right then 'LÅST DENNA OMGÅNG' else 'FELPLACERAT' end)) end,
          'timeline',ai->'timeline','score',jsonb_build_object('correct',least(10,jsonb_array_length(ai->'timeline')),'mistakes',ai->'mistakes')));
        ps := jsonb_set(ps,array['1'],ai); nxt := 0;
        if won then winner := ai->>'name'; end if;
      end if;
      loc := loc || jsonb_build_object('players',ps,'current',nxt);
      a := ps->nxt;
      update public.online_players set display_name=a->>'name',locked_timeline=a->'timeline',
        swap_cards=coalesce((a->>'swapCards')::integer,0),rounds_started=coalesce((a->>'rounds')::integer,0),
        last_round=a->'lastRound',turn_cards='[]'::jsonb,current_card=null,room_live_placement=null,updated_at=now() where id=p.id;
      update public.online_matches set status=case when won then 'finished' else 'active' end,
        current_user_id=case when won then null else m.current_user_id end,
        phase=case when won then 'finished' else 'solo' end,last_result=lr,updated_at=now() where id=m.id;
    else
      select * into next_p from public.online_players where match_id=m.id and active
        order by case when turn_order>p.turn_order then 0 else 1 end,turn_order limit 1;
      update public.online_players set last_round=lr,swap_cards=swaps,turn_cards='[]'::jsonb,
        current_card=null,room_live_placement=null,updated_at=now() where id=p.id;
      update public.online_matches set current_user_id=next_p.user_id,
        phase=case when m.code like 'S0%' then 'solo_locked' when coalesce(p.rounds_started,0)>=2 then 'locked' else 'turn_ready' end,
        last_result=lr||jsonb_build_object('player_id',p.user_id),turn_started_at=now(),
        turn_reminder_sent_at=null,turn_notice=null,updated_at=now() where id=m.id;
    end if;
    update public.digihits_wrong_handovers set completed=true,local_snapshot=loc,
      finished=won,winner_name=winner where match_code=q.match_code;
  end loop;
end $$;
revoke all on function public.digihits_run_wrong_handovers() from public, anon, authenticated;

create or replace function public.digihits_arm_wrong_handover(
 match_code_input text,result_snapshot jsonb,local_snapshot jsonb default null
) returns void language plpgsql security definer set search_path=public as $$
declare m public.online_matches%rowtype; p public.online_players%rowtype;
begin
  select * into m from public.online_matches where code=match_code_input;
  if auth.uid() is null or m.status<>'active' or m.current_user_id::text is distinct from auth.uid()::text
    then raise exception 'Det är inte din tur.'; end if;
  select * into p from public.online_players where match_id=m.id and user_id::text=auth.uid()::text and active;
  if p.id is null or p.current_card->>'id' is distinct from result_snapshot->'card'->>'id'
    then raise exception 'Kortet är inte aktivt.'; end if;
  if local_snapshot is not null and (local_snapshot->>'mode' not in ('room','computer')
    or jsonb_typeof(local_snapshot->'players') <> 'array'
    or jsonb_array_length(local_snapshot->'players') not between 2 and 8
    or (local_snapshot->>'current')::integer not between 0 and jsonb_array_length(local_snapshot->'players')-1)
    then raise exception 'Ogiltig lokal match.'; end if;
  insert into public.digihits_wrong_handovers(match_code,owner_id,card_id,due_at,snapshot,local_snapshot)
    values(m.code,auth.uid()::text,p.current_card->>'id',now()+interval '30 seconds',result_snapshot,digihits_arm_wrong_handover.local_snapshot)
    on conflict(match_code) do update set owner_id=excluded.owner_id,card_id=excluded.card_id,
      due_at=case when digihits_wrong_handovers.card_id=excluded.card_id and not digihits_wrong_handovers.completed
        then digihits_wrong_handovers.due_at else excluded.due_at end,
      snapshot=excluded.snapshot,local_snapshot=excluded.local_snapshot,completed=false,finished=false,winner_name=null;
end $$;
create or replace function public.digihits_finish_wrong_handover(match_code_input text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.digihits_wrong_handovers set due_at=least(due_at,now())
    where match_code=match_code_input and owner_id=auth.uid()::text and not completed;
  perform public.digihits_run_wrong_handovers();
end $$;
create or replace function public.digihits_wrong_handover_result(match_code_input text)
returns table(completed boolean,card_id text,local_snapshot jsonb,finished boolean,winner_name text)
language sql security definer set search_path=public as $$
  select q.completed,q.card_id,q.local_snapshot,q.finished,q.winner_name
  from public.digihits_wrong_handovers q where q.match_code=match_code_input and q.owner_id=auth.uid()::text;
$$;
revoke all on function public.digihits_arm_wrong_handover(text,jsonb,jsonb) from public,anon;
revoke all on function public.digihits_finish_wrong_handover(text) from public,anon;
revoke all on function public.digihits_wrong_handover_result(text) from public,anon;
grant execute on function public.digihits_arm_wrong_handover(text,jsonb,jsonb) to authenticated;
grant execute on function public.digihits_finish_wrong_handover(text) to authenticated;
grant execute on function public.digihits_wrong_handover_result(text) to authenticated;
select cron.unschedule(jobid) from cron.job where jobname='digihits-wrong-handovers';
select cron.schedule('digihits-wrong-handovers','1 second',$$select public.digihits_run_wrong_handovers();$$);
