-- Radioboll v1.0. Kör hela filen manuellt i samma Supabase SQL Editor.
-- Ett nytt isolerat schema. Ändrar inga Musikquiz- eller Digihits-tabeller.
-- Ingen Realtime-policy, Edge Function eller betald relätjänst krävs.
begin;
create schema if not exists radioboll;
revoke all on schema radioboll from public,anon,authenticated;
grant usage on schema radioboll to authenticated;
create table if not exists radioboll.rooms(
 code text primary key check(code ~ '^[0-9]{6}$'),host uuid not null,
 phase text not null default 'lobby' check(phase in ('lobby','playing','finished')),
 game_id uuid not null default gen_random_uuid(),world jsonb,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',
 checkpoint_at timestamptz
);
create index if not exists radioboll_host_created on radioboll.rooms(host,created_at);
create table if not exists radioboll.players(
 code text references radioboll.rooms on delete cascade,user_id uuid not null,
 name text not null check(length(name) between 1 and 18),skin int not null check(skin between 0 and 5),
 team int not null check(team in (0,1)),ready boolean not null default false,
 joined_at timestamptz not null default now(),last_seen timestamptz not null default now(),primary key(code,user_id)
);
create unique index if not exists radioboll_unique_name on radioboll.players(code,lower(name));
create table if not exists radioboll.signals(
 id bigint generated always as identity primary key,code text references radioboll.rooms on delete cascade,
 game_id uuid not null,sender uuid not null,target uuid not null,data jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists radioboll_signal_inbox on radioboll.signals(code,game_id,target,id);
alter table radioboll.rooms enable row level security;
alter table radioboll.players enable row level security;
alter table radioboll.signals enable row level security;
revoke all on all tables in schema radioboll from public,anon,authenticated;
revoke all on all sequences in schema radioboll from public,anon,authenticated;

create or replace function radioboll.api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid();c text:=payload->>'code';n text:=trim(payload->>'name');r radioboll.rooms%rowtype;
 p jsonb;inbox jsonb;t uuid;w jsonb;cnt0 int;cnt1 int;tries int:=0;
begin
 if u is null then raise exception 'Gästanslutningen saknas. Ladda om och försök igen.';end if;
 if action='create' then
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.';end if;
  perform pg_advisory_xact_lock(hashtextextended('radioboll:'||u::text,0));
  if (select count(*) from radioboll.rooms where host=u and created_at>now()-interval '1 hour')>=15 then raise exception 'För många nya matcher. Försök igen senare.';end if;
  loop
   c:=(100000+floor(random()*900000))::int::text;
   begin insert into radioboll.rooms(code,host) values(c,u);exit;
   exception when unique_violation then tries:=tries+1;if tries>10 then raise exception 'Försök skapa matchen igen.';end if;end;
  end loop;
  insert into radioboll.players(code,user_id,name,skin,team,ready) values(c,u,n,coalesce((payload->>'skin')::int,0),0,true);
 end if;
 if c is null or c !~ '^[0-9]{6}$' then raise exception 'Matchkoden ska vara sex siffror.';end if;
 select * into r from radioboll.rooms where code=c for update;
 if not found or r.expires_at<now() then raise exception 'Matchen finns inte eller har gått ut.';end if;
 if action='check' then
  if exists(select 1 from radioboll.players where code=c and user_id=u) then return jsonb_build_object('code',c,'canJoin',true,'member',true);end if;
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.';end if;
  if (select count(*) from radioboll.players where code=c)>=8 then raise exception 'Matchen är full (8 spelare).';end if;
  return jsonb_build_object('code',c,'canJoin',true,'member',false);
 end if;
 if action='join' and not exists(select 1 from radioboll.players where code=c and user_id=u) then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.';end if;
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.';end if;
  if (select count(*) from radioboll.players where code=c)>=8 then raise exception 'Matchen är full (8 spelare).';end if;
  select count(*) filter(where team=0),count(*) filter(where team=1) into cnt0,cnt1 from radioboll.players where code=c;
  begin insert into radioboll.players(code,user_id,name,skin,team) values(c,u,n,coalesce((payload->>'skin')::int,0),case when cnt0<=cnt1 then 0 else 1 end);
  exception when unique_violation then raise exception 'Namnet används redan i matchen.';end;
 end if;
 if not exists(select 1 from radioboll.players where code=c and user_id=u) then raise exception 'Du är inte med i matchen.';end if;
 update radioboll.players set last_seen=now() where code=c and user_id=u;
 if action in ('start','checkpoint','finish','restart') and r.host<>u then raise exception 'Bara värden kan göra det.';end if;
 if action='ready' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.';end if;
  if r.host<>u then update radioboll.players set ready=coalesce((payload->>'ready')::boolean,false) where code=c and user_id=u;end if;
 elsif action='team' then
  if r.phase<>'lobby' then raise exception 'Laget är låst under matchen.';end if;
  if (payload->>'team')::int not in (0,1) then raise exception 'Välj ett lag.';end if;
  update radioboll.players set team=(payload->>'team')::int,ready=(user_id=r.host) where code=c and user_id=u;
 elsif action='start' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.';end if;
  if (select count(*) from radioboll.players where code=c)<2 then raise exception 'Minst två spelare behövs.';end if;
  if not exists(select 1 from radioboll.players where code=c and team=0) or not exists(select 1 from radioboll.players where code=c and team=1) then raise exception 'Båda lagen behöver en spelare.';end if;
  if exists(select 1 from radioboll.players where code=c and (not ready or last_seen<now()-interval '15 seconds')) then raise exception 'Alla behöver vara anslutna och redo.';end if;
  update radioboll.rooms set phase='playing',world=null,checkpoint_at=now() where code=c returning * into r;
 elsif action='signal' then
  t:=(payload->>'target')::uuid;
  if payload->>'gameId'<>r.game_id::text then raise exception 'Anslutningen gäller en gammal match.';end if;
  if t=u or not exists(select 1 from radioboll.players where code=c and user_id=t) or (u<>r.host and t<>r.host) then raise exception 'Ogiltig spelanslutning.';end if;
  if jsonb_typeof(payload->'data')<>'object' or octet_length((payload->'data')::text)>20000 or (payload->'data'->>'kind') not in ('offer','answer','ice') then raise exception 'Ogiltigt anslutningsmeddelande.';end if;
  if (select count(*) from radioboll.signals where code=c and sender=u and created_at>now()-interval '1 minute')>200 then raise exception 'Anslutningen arbetar för snabbt. Vänta lite.';end if;
  insert into radioboll.signals(code,game_id,sender,target,data) values(c,r.game_id,u,t,payload->'data');
  return jsonb_build_object('ok',true);
 elsif action='checkpoint' then
  if r.phase<>'playing' then raise exception 'Matchen pågår inte.';end if;
  w:=payload->'world';
  if w is null or jsonb_typeof(w)<>'object' or octet_length(w::text)>20000 or w->>'gameId'<>r.game_id::text or jsonb_typeof(w->'cars')<>'array' then raise exception 'Ogiltigt matchläge.';end if;
  if jsonb_array_length(w->'cars')<>(select count(*) from radioboll.players where code=c) or (w->>'seq')::bigint<0 then raise exception 'Ogiltigt matchläge.';end if;
  if w->>'phase' not in ('playing','kickoff','goal','between','finished') then raise exception 'Ogiltigt matchläge.';end if;
  if r.world is null or (w->>'seq')::bigint>coalesce((r.world->>'seq')::bigint,-1) then
   update radioboll.rooms set world=w,checkpoint_at=now(),phase=case when w->>'phase'='finished' then 'finished' else 'playing' end where code=c returning * into r;
  end if;
 elsif action='finish' then
  update radioboll.rooms set phase='finished' where code=c returning * into r;
 elsif action='restart' then
  if r.phase<>'finished' then raise exception 'Avsluta matchen innan ni spelar igen.';end if;
  delete from radioboll.signals where code=c;
  update radioboll.players set ready=(user_id=r.host) where code=c;
  update radioboll.rooms set phase='lobby',world=null,game_id=gen_random_uuid(),checkpoint_at=null,expires_at=now()+interval '24 hours' where code=c returning * into r;
 elsif action='leave' then
  if r.host=u then raise exception 'Värden behöver avsluta matchen.';end if;
  if r.phase='playing' then raise exception 'Lämna efter matchen, eller be värden avsluta.';end if;
  delete from radioboll.signals where code=c and (sender=u or target=u);
  delete from radioboll.players where code=c and user_id=u;return jsonb_build_object('left',true);
 elsif action not in ('state','create','join') then raise exception 'Okänd åtgärd.';
 end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'skin',skin,'team',team,'ready',ready,'host',user_id=r.host,'online',last_seen>now()-interval '15 seconds') order by joined_at,user_id) into p from radioboll.players where code=c;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'sender',sender,'data',data) order by id),'[]'::jsonb) into inbox from (
  select id,sender,data from radioboll.signals where code=c and game_id=r.game_id and target=u and id>coalesce((payload->>'after')::bigint,0) and created_at>now()-interval '2 minutes' order by id limit 100
 ) messages;
 return jsonb_build_object('code',c,'phase',r.phase,'gameId',r.game_id,'host',r.host=u,'hostId',r.host,'me',u,'players',p,'world',r.world,'checkpointAt',r.checkpoint_at,'serverTime',clock_timestamp(),'signals',inbox);
end $$;
revoke all on function radioboll.api(text,jsonb) from public,anon,authenticated;
grant execute on function radioboll.api(text,jsonb) to authenticated;
create or replace function public.radioboll(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select radioboll.api(action,payload);$$;
revoke all on function public.radioboll(text,jsonb) from public,anon,authenticated;
grant execute on function public.radioboll(text,jsonb) to authenticated;
commit;
