-- Musikquiz v1.4.4: Spela igen med samma grupp, namn och avatarer.
-- Kör efter v1.4. Nollställningen görs först när värden trycker Spela igen.
begin;
create or replace function musikquiz.api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if action='check' then
  if exists(select 1 from musikquiz.players where code=c and user_id=u) then return jsonb_build_object('code',c,'canJoin',true,'member',true); end if;
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if (select count(*) from musikquiz.players where code=c)>=20 then raise exception 'Matchen är full (20 spelare).'; end if;
  return jsonb_build_object('code',c,'canJoin',true,'member',false);
 end if;
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
 if action in ('start','round','heard','finish','restart') and r.host<>u then raise exception 'Bara värden kan göra det.'; end if;
 if action='start' then
  if r.phase<>'lobby' then raise exception 'Matchen har redan startat.'; end if;
  if (select count(*) from musikquiz.players where code=c)<2 then raise exception 'Vänta tills minst en gäst har anslutit.'; end if;
  if exists(select 1 from musikquiz.players where code=c and user_id<>r.host and not ready) then raise exception 'Alla gäster behöver markera sig redo.'; end if;
  update musikquiz.rooms set phase='start_countdown',starts_at=now()+interval '5 seconds' where code=c returning * into r;
 elsif action='round' then
  if r.phase not in ('ready','results') then raise exception 'Vänta tills omgången är klar.'; end if;
  if r.phase='results' and r.results_at is not null and now()<r.results_at+interval '8 seconds' then raise exception 'Vänta tills topplistan har visats klart.'; end if;
  if r.round>=array_length(r.deck,1) then
   update musikquiz.rooms set phase='finished' where code=c returning * into r;
  else
   update musikquiz.rooms set round=round+1,phase='round_countdown',starts_at=now()+interval '3 seconds',deadline=null,results_at=null where code=c returning * into r;
  end if;
 elsif action='restart' then
  if r.phase<>'finished' then raise exception 'Avsluta matchen innan ni spelar igen.'; end if;
  select array_agg(id) into d from (select id from musikquiz.questions where not (id=any(r.deck)) order by random() limit 10) t;
  if coalesce(array_length(d,1),0)<10 then
   select array_agg(id) into d from (select id from musikquiz.questions order by random() limit 10) t;
  end if;
  if coalesce(array_length(d,1),0)<10 then raise exception 'Frågorna är inte redo ännu.'; end if;
  delete from musikquiz.answers where code=c;
  update musikquiz.players set score=0,ready=(user_id=r.host) where code=c;
  update musikquiz.rooms set phase='lobby',round=0,deck=d,starts_at=null,deadline=null,results_at=null,expires_at=now()+interval '24 hours' where code=c returning * into r;
 elsif action='heard' then
  if r.phase='reading' then update musikquiz.rooms set phase='answering',deadline=now()+interval '20 seconds' where code=c returning * into r; end if;
 elsif action='answer' then
  if r.phase<>'answering' or now()>=r.deadline then raise exception 'Svarstiden är slut.'; end if;
  if (payload->>'choice')::int not between 0 and 3 then raise exception 'Välj ett svar.'; end if;
  insert into musikquiz.answers as existing(code,round,user_id,choice,answered_at) values(c,r.round,u,(payload->>'choice')::int,now())
   on conflict(code,round,user_id) do update set choice=excluded.choice,answered_at=excluded.answered_at where existing.choice<>excluded.choice;
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
  update musikquiz.answers a set points=case when a.choice=q.correct then greatest(100,least(1000,round(1000-900*extract(epoch from (a.answered_at-(r.deadline-interval '20 seconds')))/20)::int)) else 0 end where a.code=c and a.round=r.round;
  update musikquiz.players pl set score=pl.score+a.points from musikquiz.answers a where pl.code=c and a.code=c and a.round=r.round and a.user_id=pl.user_id;
  update musikquiz.rooms set phase='results',results_at=clock_timestamp() where code=c returning * into r;
 end if;
 select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'score',score,'avatar',avatar,'ready',ready,'host',user_id=r.host,'roundPoints',gain,'previousScore',score-gain,'previousRank',old_rank) order by score desc,joined_at,user_id) into p from (
  select pl.*,case when r.phase='results' then coalesce(a.points,0) else 0 end as gain,
   row_number() over(order by pl.score-case when r.phase='results' then coalesce(a.points,0) else 0 end desc,pl.joined_at,pl.user_id) as old_rank
  from musikquiz.players pl left join musikquiz.answers a on a.code=pl.code and a.user_id=pl.user_id and a.round=r.round where pl.code=c
 ) ranked;
 select choice into own_choice from musikquiz.answers where code=c and round=r.round and user_id=u;
 if r.phase in ('reading','answering','results') then
  select * into q from musikquiz.questions where id=r.deck[r.round];
  out_question:=jsonb_build_object('text',q.question,'category',q.category);
  if r.phase in ('answering','results') then out_question:=out_question||jsonb_build_object('options',q.options); end if;
  if r.phase='results' then out_question:=out_question||jsonb_build_object('correct',q.correct); end if;
 end if;
 return jsonb_build_object('code',c,'phase',r.phase,'round',r.round,'total',array_length(r.deck,1),'host',r.host=u,'me',u,'players',p,'startsAt',r.starts_at,'deadline',r.deadline,'serverTime',clock_timestamp(),'resultsAt',r.results_at,'scoringVersion',2,'question',out_question,'choice',own_choice,'answered',(select count(*) from musikquiz.answers where code=c and round=r.round));
end $$;
commit;
