create table if not exists public.digihits_blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id), check (blocker_id <> blocked_id)
);
create table if not exists public.digihits_match_join_requests (
  id uuid primary key default gen_random_uuid(),
  match_code text not null, requester_id text not null, blocker_id text not null,
  starter jsonb not null, status text not null default 'pending', created_at timestamptz not null default now(),
  unique (match_code, requester_id, blocker_id), check (status in ('pending','allowed','declined'))
);
alter table public.digihits_blocks enable row level security;
alter table public.digihits_match_join_requests enable row level security;
drop policy if exists "Digihits reads own blocks" on public.digihits_blocks;
create policy "Digihits reads own blocks" on public.digihits_blocks for select to authenticated using (blocker_id = auth.uid()::text or blocked_id = auth.uid()::text);
drop policy if exists "Digihits reads own join requests" on public.digihits_match_join_requests;
create policy "Digihits reads own join requests" on public.digihits_match_join_requests for select to authenticated using (requester_id = auth.uid()::text or blocker_id = auth.uid()::text);
do $$ begin alter publication supabase_realtime add table public.digihits_blocks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.digihits_match_join_requests; exception when duplicate_object then null; end $$;

create or replace function public.digihits_block_friend(target text) returns void language plpgsql security definer set search_path = public as $$
begin
  if target=auth.uid()::text then raise exception 'Du kan inte blockera dig själv.'; end if;
  delete from public.digihits_friendships where (user_id=auth.uid()::text and friend_id=target) or (user_id=target and friend_id=auth.uid()::text);
  delete from public.digihits_friend_requests where (sender_id=auth.uid()::text and recipient_id=target) or (sender_id=target and recipient_id=auth.uid()::text);
  delete from public.digihits_match_invites where (sender_id=auth.uid()::text and recipient_id=target) or (sender_id=target and recipient_id=auth.uid()::text);
  insert into public.digihits_blocks(blocker_id,blocked_id) values(auth.uid()::text,target) on conflict do nothing;
end; $$;
create or replace function public.digihits_unblock_friend(target text) returns void language sql security definer set search_path = public as $$
  delete from public.digihits_blocks where blocker_id=auth.uid()::text and blocked_id=target;
$$;
create or replace function public.digihits_my_blocks() returns table(blocked_id text, display_name text) language sql security definer set search_path=public as $$
  select b.blocked_id,p.display_name from public.digihits_blocks b join public.digihits_profiles p on p.user_id::text=b.blocked_id where b.blocker_id=auth.uid()::text order by lower(p.display_name);
$$;
create or replace function public.digihits_send_friend_request(requested text) returns void language plpgsql security definer set search_path=public,auth as $$
declare target text := (select user_id from public.digihits_find_friend(requested));
begin
  if target is null then raise exception 'Spelarnamn hittades inte.'; end if;
  if target=auth.uid()::text then raise exception 'Du kan inte lägga till dig själv.'; end if;
  if exists(select 1 from public.digihits_blocks where blocker_id=auth.uid()::text and blocked_id=target) then raise exception 'Gick inte att lägga till spelaren eftersom du har blockerat personen.'; end if;
  if exists(select 1 from public.digihits_blocks where blocker_id=target and blocked_id=auth.uid()::text) then raise exception 'Gick inte att lägga till spelaren eftersom personen har blockerat dig.'; end if;
  if exists(select 1 from public.digihits_friendships where user_id=auth.uid()::text and friend_id=target) then raise exception 'Ni är redan vänner.'; end if;
  insert into public.digihits_friend_requests(sender_id,recipient_id) values(auth.uid()::text,target) on conflict(sender_id,recipient_id) do update set status='pending',created_at=now();
end; $$;
create or replace function public.digihits_complete_match_join(match_code_input text, requester text, starter_card jsonb) returns void language plpgsql security definer set search_path=public as $$
declare m public.online_matches%rowtype; n integer; name text;
begin
 select * into m from public.online_matches where code=match_code_input for update;
 if m.id is null or m.status='finished' then raise exception 'Matchkoden hittades inte eller matchen är avslutad.'; end if;
 if m.phase='locked' then raise exception 'Matchen är låst eftersom andra omgången redan är påbörjad.'; end if;
 select count(*) into n from public.online_players where match_id::text=m.id::text and active=true;
 if n>=8 then raise exception 'Matchen är full – 8 spelare är redan med i matchen.'; end if;
 if exists(select 1 from public.online_players where match_id::text=m.id::text and user_id=requester and active=true) then return; end if;
 select display_name into name from public.digihits_profiles where user_id::text=requester;
 insert into public.online_players(match_id,user_id,display_name,turn_order,locked_timeline,turn_cards,swap_cards,rounds_started,active,history_hidden,updated_at) values(m.id,requester,coalesce(name,'Motspelare'),n,jsonb_build_array(starter_card),'[]'::jsonb,0,0,true,false,now());
 update public.online_matches set status='active', phase=case when status='waiting' then 'turn_ready' else phase end, current_user_id=case when status='waiting' then (select user_id from public.online_players where match_id::text=m.id::text and active=true order by turn_order limit 1) else current_user_id end, used_track_ids=coalesce(used_track_ids,'[]'::jsonb)||jsonb_build_array(starter_card->>'id'), updated_at=now() where id=m.id;
end; $$;
create or replace function public.digihits_request_match_join(match_code_input text, starter_card jsonb, allow_own_block boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.online_matches%rowtype; own_name text; blocker text; blocker_name text; has_blocker boolean := false;
begin
 select * into m from public.online_matches where code=match_code_input;
 if m.id is null or m.status='finished' then raise exception 'Matchkoden hittades inte eller matchen är avslutad.'; end if;
 if m.phase='locked' then raise exception 'Matchen är låst eftersom andra omgången redan är påbörjad.'; end if;
 select p.display_name into own_name from public.digihits_blocks b join public.online_players p on p.user_id=b.blocked_id and p.match_id::text=m.id::text and p.active=true where b.blocker_id=auth.uid()::text limit 1;
 if own_name is not null then raise exception 'Du har blockerat %, du kan därmed inte gå med i denna match.', own_name; end if;
 for blocker in select distinct b.blocker_id from public.digihits_blocks b join public.online_players p on p.user_id=b.blocker_id and p.match_id::text=m.id::text and p.active=true where b.blocked_id=auth.uid()::text loop
   has_blocker := true;
   select display_name into blocker_name from public.digihits_profiles where user_id::text=blocker;
   insert into public.digihits_match_join_requests(match_code,requester_id,blocker_id,starter) values(match_code_input,auth.uid()::text,blocker,starter_card) on conflict(match_code,requester_id,blocker_id) do update set status='pending',starter=excluded.starter,created_at=now();
 end loop;
 if has_blocker then return jsonb_build_object('status','pending','name',blocker_name); end if;
 perform public.digihits_complete_match_join(match_code_input,auth.uid()::text,starter_card);
 return jsonb_build_object('status','joined');
end; $$;

-- Blockeringar gäller även om någon försöker anropa funktionerna direkt.
create or replace function public.digihits_invite_friend(match_code_input text, recipient text) returns void language plpgsql security definer set search_path=public as $$
declare name text;
begin
  select display_name into name from public.digihits_profiles where user_id::text=recipient;
  if exists(select 1 from public.digihits_blocks where blocker_id=auth.uid()::text and blocked_id=recipient) then raise exception 'Du har blockerat %, du kan därmed inte bjuda in denna person till matcher.', coalesce(name,'spelaren'); end if;
  if exists(select 1 from public.digihits_blocks where blocker_id=recipient and blocked_id=auth.uid()::text) then raise exception '% har blockerat dig, du kan därmed inte bjuda in denna person till matcher.', coalesce(name,'Spelaren'); end if;
  if not exists(select 1 from public.digihits_friendships where user_id=auth.uid()::text and friend_id=recipient) then raise exception 'Spelaren är inte din vän.'; end if;
  if not exists(select 1 from public.online_players p join public.online_matches m on m.id::text=p.match_id::text where m.code=match_code_input and p.user_id=auth.uid()::text and m.phase<>'locked') then raise exception 'Matchen kan inte ta emot fler inbjudningar.'; end if;
  if exists(select 1 from public.digihits_match_invites where match_code=match_code_input and recipient_id=recipient) then raise exception 'Inbjudan redan skickad.'; end if;
  insert into public.digihits_match_invites(match_code,sender_id,recipient_id) values(match_code_input,auth.uid()::text,recipient);
end; $$;
create or replace function public.digihits_accept_match_invite(invite uuid, starter jsonb) returns text language plpgsql security definer set search_path=public as $$
declare invite_row public.digihits_match_invites%rowtype; match_row public.online_matches%rowtype; player_count integer; recipient_name text; blocked_name text;
begin
  select * into invite_row from public.digihits_match_invites where id=invite and recipient_id=auth.uid()::text and status='pending' for update;
  if invite_row.id is null then raise exception 'Matchinbjudan hittades inte.'; end if;
  select * into match_row from public.online_matches where code=invite_row.match_code for update;
  if match_row.id is null or match_row.status='finished' then raise exception 'Matchkoden hittades inte eller matchen är avslutad.'; end if;
  select p.display_name into blocked_name from public.digihits_blocks b join public.online_players p on p.user_id=b.blocked_id and p.match_id::text=match_row.id::text and p.active=true where b.blocker_id=auth.uid()::text limit 1;
  if blocked_name is not null then raise exception 'Du har blockerat %, du kan därmed inte gå med i denna match.', blocked_name; end if;
  select p.display_name into blocked_name from public.digihits_blocks b join public.online_players p on p.user_id=b.blocker_id and p.match_id::text=match_row.id::text and p.active=true where b.blocked_id=auth.uid()::text limit 1;
  if blocked_name is not null then raise exception '% har blockerat dig, du kan därmed inte gå med i denna match om du inte blir accepterad att gå med.', blocked_name; end if;
  if match_row.phase='locked' then raise exception 'Matchen är låst eftersom andra omgången redan är påbörjad.'; end if;
  if not exists(select 1 from public.online_players where match_id::text=match_row.id::text and user_id=auth.uid()::text and active=true) then
    select count(*) into player_count from public.online_players where match_id::text=match_row.id::text and active=true;
    if player_count>=8 then raise exception 'Matchen är full – 8 spelare är redan med i matchen.'; end if;
    if coalesce(match_row.used_track_ids,'[]'::jsonb) @> jsonb_build_array(starter->>'id') then raise exception 'Försök gå med igen.'; end if;
    select display_name into recipient_name from public.digihits_profiles where user_id::text=auth.uid()::text;
    insert into public.online_players(match_id,user_id,display_name,turn_order,locked_timeline,turn_cards,swap_cards,rounds_started,active,history_hidden,updated_at) values(match_row.id,auth.uid()::text,coalesce(recipient_name,'Motspelare'),player_count,jsonb_build_array(starter),'[]'::jsonb,0,0,true,false,now());
    update public.online_matches set status='active',phase=case when status='waiting' then 'turn_ready' else phase end,used_track_ids=coalesce(used_track_ids,'[]'::jsonb)||jsonb_build_array(starter->>'id'),updated_at=now() where id=match_row.id;
  end if;
  update public.digihits_match_invites set status='accepted' where id=invite_row.id; return invite_row.match_code;
end; $$;
create or replace function public.digihits_my_friend_messages(friend text) returns table(id uuid,sender_id text,body text,created_at timestamptz) language plpgsql security definer set search_path=public as $$
declare name text;
begin
  select display_name into name from public.digihits_profiles where user_id::text=friend;
  if exists(select 1 from public.digihits_blocks where blocker_id=auth.uid()::text and blocked_id=friend) then raise exception 'Du har blockerat %, du kan därmed inte chatta med denna person.', coalesce(name,'spelaren'); end if;
  if exists(select 1 from public.digihits_blocks where blocker_id=friend and blocked_id=auth.uid()::text) then raise exception '% har blockerat dig, du kan därmed inte chatta med denna person.', coalesce(name,'Spelaren'); end if;
  return query select m.id,m.sender_id,m.body,m.created_at from public.digihits_friend_messages m where (m.sender_id=auth.uid()::text and m.recipient_id=friend) or (m.sender_id=friend and m.recipient_id=auth.uid()::text) order by m.created_at;
end; $$;
create or replace function public.digihits_send_friend_message(friend text,message_body text) returns void language plpgsql security definer set search_path=public as $$
declare name text;
begin
  select display_name into name from public.digihits_profiles where user_id::text=friend;
  if exists(select 1 from public.digihits_blocks where blocker_id=auth.uid()::text and blocked_id=friend) then raise exception 'Du har blockerat %, du kan därmed inte chatta med denna person.', coalesce(name,'spelaren'); end if;
  if exists(select 1 from public.digihits_blocks where blocker_id=friend and blocked_id=auth.uid()::text) then raise exception '% har blockerat dig, du kan därmed inte chatta med denna person.', coalesce(name,'Spelaren'); end if;
  if not exists(select 1 from public.digihits_friendships where user_id=auth.uid()::text and friend_id=friend) then raise exception 'Spelaren är inte din vän.'; end if;
  insert into public.digihits_friend_messages(sender_id,recipient_id,body) values(auth.uid()::text,friend,trim(message_body));
end; $$;
create or replace function public.digihits_my_match_join_requests(match_code_input text) returns table(request_id uuid, requester_name text) language sql security definer set search_path=public as $$
 select r.id,p.display_name from public.digihits_match_join_requests r join public.digihits_profiles p on p.user_id::text=r.requester_id where r.match_code=match_code_input and r.blocker_id=auth.uid()::text and r.status='pending';
$$;
create or replace function public.digihits_answer_match_join_request(request uuid, allow_join boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.digihits_match_join_requests%rowtype;
begin
 select * into r from public.digihits_match_join_requests where id=request and blocker_id=auth.uid()::text and status='pending' for update;
 if r.id is null then raise exception 'Förfrågan hittades inte.'; end if;
 update public.digihits_match_join_requests set status=case when allow_join then 'allowed' else 'declined' end where id=r.id;
 if allow_join and not exists(select 1 from public.digihits_match_join_requests where match_code=r.match_code and requester_id=r.requester_id and status='pending') and not exists(select 1 from public.digihits_match_join_requests where match_code=r.match_code and requester_id=r.requester_id and status='declined') then perform public.digihits_complete_match_join(r.match_code,r.requester_id,r.starter); end if;
end; $$;
grant execute on function public.digihits_block_friend(text),public.digihits_unblock_friend(text),public.digihits_my_blocks(),public.digihits_request_match_join(text,jsonb,boolean),public.digihits_my_match_join_requests(text),public.digihits_answer_match_join_request(uuid,boolean) to authenticated;
