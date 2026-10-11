-- Isolated Musikquiz schema. Clients use only the membership-checked RPC.
create schema musikquiz;
revoke all on schema musikquiz from public, anon, authenticated;
grant usage on schema musikquiz to authenticated;
create table musikquiz.questions(id int primary key, question text not null, options jsonb not null check(jsonb_array_length(options)=4), correct int not null check(correct between 0 and 3), category text not null);
create table musikquiz.rooms(code text primary key check(code ~ '^[0-9]{6}$'), host uuid not null, phase text not null default 'lobby' check(phase in ('lobby','start_countdown','ready','round_countdown','reading','answering','results','finished')), round int not null default 0, deck int[] not null, starts_at timestamptz, deadline timestamptz, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours');
create index rooms_host_created on musikquiz.rooms(host,created_at);
create table musikquiz.players(code text references musikquiz.rooms on delete cascade, user_id uuid not null, name text not null check(length(name) between 1 and 18), score int not null default 0, avatar int not null check(avatar between 0 and 11), ready boolean not null default false, joined_at timestamptz not null default now(), primary key(code,user_id));
create unique index player_name_unique on musikquiz.players(code,lower(name));
create table musikquiz.answers(code text references musikquiz.rooms on delete cascade, round int not null, user_id uuid not null, choice int not null check(choice between 0 and 3), primary key(code,round,user_id), foreign key(code,user_id) references musikquiz.players on delete cascade);
alter table musikquiz.questions enable row level security;
alter table musikquiz.rooms enable row level security;
alter table musikquiz.players enable row level security;
alter table musikquiz.answers enable row level security;
revoke all on all tables in schema musikquiz from public,anon,authenticated;

create function musikquiz.api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); c text := payload->>'code'; n text := trim(payload->>'name');
 r musikquiz.rooms%rowtype; q musikquiz.questions%rowtype; d int[]; own_choice int; p jsonb; out_question jsonb; tries int:=0;
begin
 if u is null then raise exception 'Anslutningen saknas. Försök igen.'; end if;
 if action='create' then
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if (select count(*) from musikquiz.rooms where host=u and created_at>now()-interval '1 hour')>=15 then raise exception 'Du har skapat många matcher. Försök igen senare.'; end if;
  select array_agg(id) into d from (select id from musikquiz.questions order by random() limit 10) t;
  if coalesce(array_length(d,1),0)<10 then raise exception 'Frågorna är inte redo ännu.'; end if;
  loop
   c:=(100000+floor(random()*900000))::int::text;
   begin
    insert into musikquiz.rooms(code,host,deck) values(c,u,d); exit;
   exception when unique_violation then tries:=tries+1; if tries>10 then raise exception 'Försök skapa matchen igen.'; end if;
   end;
  end loop;
  insert into musikquiz.players(code,user_id,name,avatar,ready) values(c,u,n,(payload->>'avatar')::int,true);
 end if;
 if c is null or c !~ '^[0-9]{6}$' then raise exception 'Matchkoden ska vara sex siffror.'; end if;
 select * into r from musikquiz.rooms where code=c for update;
 if not found or r.expires_at<now() then raise exception 'Matchen finns inte eller har gått ut.'; end if;
 if action='join' and not exists(select 1 from musikquiz.players where code=c and user_id=u) then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if n is null or length(n) not between 1 and 18 then raise exception 'Skriv ett namn med 1–18 tecken.'; end if;
  if (select count(*) from musikquiz.players where code=c)>=20 then raise exception 'Matchen är full (20 spelare).'; end if;
  begin
   insert into musikquiz.players(code,user_id,name,avatar) values(c,u,n,(payload->>'avatar')::int);
  exception when unique_violation then raise exception 'Namnet används i matchen. Välj ett annat.';
  end;
 end if;
 if not exists(select 1 from musikquiz.players where code=c and user_id=u) then raise exception 'Du är inte med i den här matchen.'; end if;
 if r.phase='start_countdown' and now()>=r.starts_at then
  update musikquiz.rooms set phase='ready' where code=c returning * into r;
 elsif r.phase='round_countdown' and now()>=r.starts_at then
  update musikquiz.rooms set phase='reading' where code=c returning * into r;
 end if;
 if action in ('start','round','heard','finish') and r.host<>u then raise exception 'Bara värden kan göra det.'; end if;
 if action='start' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if (select count(*) from musikquiz.players where code=c)<2 then raise exception 'Vänta tills minst en gäst har anslutit.'; end if;
  if exists(select 1 from musikquiz.players where code=c and user_id<>r.host and not ready) then raise exception 'Alla gäster behöver markera sig redo.'; end if;
  update musikquiz.rooms set phase='start_countdown',starts_at=now()+interval '5 seconds' where code=c returning * into r;
 elsif action='round' then
  if r.phase not in ('ready','results') then raise exception 'Vänta tills omgången är klar.'; end if;
  if r.round>=array_length(r.deck,1) then
   update musikquiz.rooms set phase='finished' where code=c returning * into r;
  else
   update musikquiz.rooms set round=round+1,phase='round_countdown',starts_at=now()+interval '3 seconds',deadline=null where code=c returning * into r;
  end if;
 elsif action='heard' then
  if r.phase='reading' then update musikquiz.rooms set phase='answering',deadline=now()+interval '20 seconds' where code=c returning * into r; end if;
 elsif action='answer' then
  if r.phase<>'answering' or now()>=r.deadline then raise exception 'Svarstiden är slut.'; end if;
  if (payload->>'choice')::int not between 0 and 3 then raise exception 'Välj ett svar.'; end if;
  insert into musikquiz.answers(code,round,user_id,choice) values(c,r.round,u,(payload->>'choice')::int) on conflict do nothing;
 elsif action='finish' then
  update musikquiz.rooms set phase='finished' where code=c returning * into r;
 elsif action='ready' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if r.host<>u then update musikquiz.players set ready=coalesce((payload->>'ready')::boolean,false) where code=c and user_id=u; end if;
 elsif action='leave' then
  if r.host=u then raise exception 'Värden behöver avsluta matchen.'; end if;
  if r.phase not in ('lobby','ready','results') then raise exception 'Du kan lämna matchen mellan frågorna.'; end if;
  delete from musikquiz.players where code=c and user_id=u; return jsonb_build_object('left',true);
 elsif action not in ('state','create','join') then raise exception 'Okänd åtgärd.';
 end if;
 if r.phase='answering' and (now()>=r.deadline or (select count(*) from musikquiz.answers where code=c and round=r.round)=(select count(*) from musikquiz.players where code=c)) then
  select * into q from musikquiz.questions where id=r.deck[r.round];
  update musikquiz.players pl set score=pl.score+1 where pl.code=c and exists(select 1 from musikquiz.answers a where a.code=c and a.round=r.round and a.user_id=pl.user_id and a.choice=q.correct);
  update musikquiz.rooms set phase='results' where code=c returning * into r;
 end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'score',score,'avatar',avatar,'ready',ready,'host',user_id=r.host) order by score desc,joined_at) into p from musikquiz.players where code=c;
 select choice into own_choice from musikquiz.answers where code=c and round=r.round and user_id=u;
 if r.phase in ('reading','answering','results') then
  select * into q from musikquiz.questions where id=r.deck[r.round];
  out_question:=jsonb_build_object('text',q.question,'category',q.category);
  if r.phase in ('answering','results') then out_question:=out_question||jsonb_build_object('options',q.options); end if;
  if r.phase='results' then out_question:=out_question||jsonb_build_object('correct',q.correct); end if;
 end if;
 return jsonb_build_object('code',c,'phase',r.phase,'round',r.round,'total',array_length(r.deck,1),'host',r.host=u,'me',u,'players',p,'startsAt',r.starts_at,'deadline',r.deadline,'serverTime',clock_timestamp(),'question',out_question,'choice',own_choice,'answered',(select count(*) from musikquiz.answers where code=c and round=r.round));
end $$;
revoke all on function musikquiz.api(text,jsonb) from public,anon,authenticated;
grant execute on function musikquiz.api(text,jsonb) to authenticated;
create function public.musikquiz(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select musikquiz.api(action,payload); $$;
revoke all on function public.musikquiz(text,jsonb) from public,anon,authenticated;
grant execute on function public.musikquiz(text,jsonb) to authenticated;
