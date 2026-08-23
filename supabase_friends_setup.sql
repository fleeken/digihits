create table if not exists public.digihits_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  recipient_id text not null,
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
alter table public.digihits_friend_requests add column if not exists status text not null default 'pending';
alter table public.digihits_friend_requests drop constraint if exists digihits_friend_requests_status_check;
alter table public.digihits_friend_requests add constraint digihits_friend_requests_status_check check (status in ('pending', 'declined', 'accepted'));
create table if not exists public.digihits_friendships (
  user_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create table if not exists public.digihits_match_invites (
  id uuid primary key default gen_random_uuid(),
  match_code text not null,
  sender_id text not null,
  recipient_id text not null,
  created_at timestamptz not null default now(),
  unique (match_code, recipient_id)
);
alter table public.digihits_match_invites add column if not exists status text not null default 'pending';
alter table public.digihits_match_invites drop constraint if exists digihits_match_invites_status_check;
alter table public.digihits_match_invites add constraint digihits_match_invites_status_check check (status in ('pending', 'declined', 'accepted'));
create table if not exists public.digihits_friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  recipient_id text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create table if not exists public.digihits_friend_chat_reads (
  user_id text not null,
  friend_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.digihits_friend_requests enable row level security;
alter table public.digihits_friendships enable row level security;
alter table public.digihits_match_invites enable row level security;
alter table public.digihits_friend_messages enable row level security;
alter table public.digihits_friend_chat_reads enable row level security;

drop policy if exists "Digihits reads own friendships" on public.digihits_friendships;
create policy "Digihits reads own friendships" on public.digihits_friendships for select to authenticated using (user_id = auth.uid()::text);
drop policy if exists "Digihits reads own friend requests" on public.digihits_friend_requests;
create policy "Digihits reads own friend requests" on public.digihits_friend_requests for select to authenticated using (sender_id = auth.uid()::text or recipient_id = auth.uid()::text);
drop policy if exists "Digihits reads own match invites" on public.digihits_match_invites;
create policy "Digihits reads own match invites" on public.digihits_match_invites for select to authenticated using (sender_id = auth.uid()::text or recipient_id = auth.uid()::text);
drop policy if exists "Digihits reads own friend messages" on public.digihits_friend_messages;
create policy "Digihits reads own friend messages" on public.digihits_friend_messages for select to authenticated using (sender_id = auth.uid()::text or recipient_id = auth.uid()::text);

do $$ begin alter publication supabase_realtime add table public.digihits_friend_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.digihits_friendships; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.digihits_match_invites; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.digihits_friend_messages; exception when duplicate_object then null; end $$;

create or replace function public.digihits_find_friend(requested text)
returns table(user_id text, display_name text) language sql security definer set search_path = public, auth as $$
  select p.user_id::text, p.display_name
  from public.digihits_profiles p join auth.users u on u.id::text = p.user_id::text
  where lower(p.display_name_key) = lower(trim(requested)) or lower(u.email) = lower(trim(requested))
  limit 1;
$$;
create or replace function public.digihits_send_friend_request(requested text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare target text := (select user_id from public.digihits_find_friend(requested));
begin
  if target is null then raise exception 'Spelarnamn hittades inte.'; end if;
  if target = auth.uid()::text then raise exception 'Du kan inte lägga till dig själv.'; end if;
  if exists (select 1 from public.digihits_friendships where user_id = auth.uid()::text and friend_id = target) then raise exception 'Ni är redan vänner.'; end if;
  insert into public.digihits_friend_requests(sender_id, recipient_id) values (auth.uid()::text, target) on conflict do nothing;
end;
$$;
create or replace function public.digihits_answer_friend_request(request_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path = public as $$
declare sender text;
begin
  select sender_id into sender from public.digihits_friend_requests where id = request_id and recipient_id = auth.uid()::text and status = 'pending';
  if sender is null then raise exception 'Vänförfrågan hittades inte.'; end if;
  if accept_request then
    update public.digihits_friend_requests set status = 'accepted' where id = request_id;
    insert into public.digihits_friendships(user_id, friend_id) values (auth.uid()::text, sender), (sender, auth.uid()::text) on conflict do nothing;
  else
    update public.digihits_friend_requests set status = 'declined' where id = request_id;
  end if;
end;
$$;
create or replace function public.digihits_remove_friend(target text)
returns void language sql security definer set search_path = public as $$
  delete from public.digihits_friendships where (user_id = auth.uid()::text and friend_id = target) or (user_id = target and friend_id = auth.uid()::text);
$$;
create or replace function public.digihits_my_friends()
returns table(friend_id text, display_name text) language sql security definer set search_path = public as $$
  select f.friend_id, p.display_name from public.digihits_friendships f join public.digihits_profiles p on p.user_id::text = f.friend_id where f.user_id = auth.uid()::text order by lower(p.display_name);
$$;
create or replace function public.digihits_my_friend_requests()
returns table(request_id uuid, sender_id text, display_name text) language sql security definer set search_path = public as $$
  select r.id, r.sender_id, p.display_name from public.digihits_friend_requests r join public.digihits_profiles p on p.user_id::text = r.sender_id where r.recipient_id = auth.uid()::text and r.status = 'pending' order by r.created_at;
$$;
drop function if exists public.digihits_my_sent_friend_requests();
create function public.digihits_my_sent_friend_requests()
returns table(request_id uuid, recipient_id text, display_name text, status text) language sql security definer set search_path = public as $$
  select r.id, r.recipient_id, p.display_name, r.status from public.digihits_friend_requests r join public.digihits_profiles p on p.user_id::text = r.recipient_id where r.sender_id = auth.uid()::text;
$$;
create or replace function public.digihits_dismiss_sent_friend_request(request_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.digihits_friend_requests where id = request_id and sender_id = auth.uid()::text and status in ('declined', 'accepted');
$$;
create or replace function public.digihits_invite_friend(match_code_input text, recipient text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.digihits_friendships where user_id = auth.uid()::text and friend_id = recipient) then raise exception 'Spelaren är inte din vän.'; end if;
  if not exists (select 1 from public.online_players p join public.online_matches m on m.id::text = p.match_id::text where m.code = match_code_input and p.user_id = auth.uid()::text and m.phase <> 'locked') then raise exception 'Matchen kan inte ta emot fler inbjudningar.'; end if;
  if exists (select 1 from public.digihits_match_invites where match_code = match_code_input and recipient_id = recipient) then raise exception 'Inbjudan redan skickad.'; end if;
  insert into public.digihits_match_invites(match_code, sender_id, recipient_id) values (match_code_input, auth.uid()::text, recipient);
end;
$$;
create or replace function public.digihits_add_friend_to_match(match_code_input text, recipient text, starter jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare match_row public.online_matches%rowtype; player_count integer; friend_name text;
begin
  if not exists (select 1 from public.digihits_friendships where user_id = auth.uid()::text and friend_id = recipient) then raise exception 'Spelaren är inte din vän.'; end if;
  select * into match_row from public.online_matches where code = match_code_input for update;
  if match_row.id is null or match_row.phase = 'locked' then raise exception 'Matchen är låst.'; end if;
  select count(*) into player_count from public.online_players where match_id::text = match_row.id::text and active = true;
  if player_count >= 8 then raise exception 'Matchen är full – 8 spelare är redan med i matchen.'; end if;
  if exists (select 1 from public.online_players where match_id::text = match_row.id::text and user_id = recipient and active = true) then return; end if;
  select display_name into friend_name from public.digihits_profiles where user_id::text = recipient;
  insert into public.online_players(match_id, user_id, display_name, turn_order, locked_timeline, turn_cards, swap_cards, rounds_started, active, history_hidden, updated_at)
  values (match_row.id, recipient, coalesce(friend_name, 'Motspelare'), player_count, jsonb_build_array(starter), '[]'::jsonb, 0, 0, true, false, now());
  update public.online_matches set status = 'active', phase = case when status = 'waiting' then 'turn_ready' else phase end, used_track_ids = coalesce(used_track_ids, '[]'::jsonb) || jsonb_build_array(starter->>'id'), updated_at = now() where id = match_row.id;
end;
$$;
create or replace function public.digihits_my_match_invites()
returns table(invite_id uuid, match_code text, sender_name text) language sql security definer set search_path = public as $$
  select i.id, i.match_code, p.display_name from public.digihits_match_invites i join public.digihits_profiles p on p.user_id::text = i.sender_id where i.recipient_id = auth.uid()::text and i.status = 'pending' order by i.created_at desc;
$$;
drop function if exists public.digihits_my_sent_match_invites();
create function public.digihits_my_sent_match_invites()
returns table(invite_id uuid, recipient_id text, recipient_name text, match_code text, status text) language sql security definer set search_path = public as $$
  select i.id, i.recipient_id, p.display_name, i.match_code, i.status from public.digihits_match_invites i join public.digihits_profiles p on p.user_id::text = i.recipient_id where i.sender_id = auth.uid()::text order by i.created_at desc;
$$;
create or replace function public.digihits_dismiss_match_invite(invite uuid)
returns void language sql security definer set search_path = public as $$
  update public.digihits_match_invites set status = 'declined' where id = invite and recipient_id = auth.uid()::text and status = 'pending';
$$;
create or replace function public.digihits_dismiss_sent_match_invite(invite uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.digihits_match_invites where id = invite and sender_id = auth.uid()::text and status in ('declined', 'accepted');
$$;
create or replace function public.digihits_accept_match_invite(invite uuid, starter jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare invite_row public.digihits_match_invites%rowtype; match_row public.online_matches%rowtype; player_count integer; recipient_name text;
begin
  select * into invite_row from public.digihits_match_invites where id = invite and recipient_id = auth.uid()::text and status = 'pending' for update;
  if invite_row.id is null then raise exception 'Matchinbjudan hittades inte.'; end if;
  select * into match_row from public.online_matches where code = invite_row.match_code for update;
  if match_row.id is null or match_row.status = 'finished' then raise exception 'Matchkoden hittades inte eller matchen är avslutad.'; end if;
  if match_row.phase = 'locked' then raise exception 'Matchen är låst eftersom andra omgången redan är påbörjad.'; end if;
  if not exists (select 1 from public.online_players where match_id::text = match_row.id::text and user_id = auth.uid()::text and active = true) then
    select count(*) into player_count from public.online_players where match_id::text = match_row.id::text and active = true;
    if player_count >= 8 then raise exception 'Matchen är full – 8 spelare är redan med i matchen.'; end if;
    if coalesce(match_row.used_track_ids, '[]'::jsonb) @> jsonb_build_array(starter->>'id') then raise exception 'Försök gå med igen.'; end if;
    select display_name into recipient_name from public.digihits_profiles where user_id::text = auth.uid()::text;
    insert into public.online_players(match_id, user_id, display_name, turn_order, locked_timeline, turn_cards, swap_cards, rounds_started, active, history_hidden, updated_at)
    values (match_row.id, auth.uid()::text, coalesce(recipient_name, 'Motspelare'), player_count, jsonb_build_array(starter), '[]'::jsonb, 0, 0, true, false, now());
    update public.online_matches set status = 'active', phase = case when status = 'waiting' then 'turn_ready' else phase end, used_track_ids = coalesce(used_track_ids, '[]'::jsonb) || jsonb_build_array(starter->>'id'), updated_at = now() where id = match_row.id;
  end if;
  update public.digihits_match_invites set status = 'accepted' where id = invite_row.id;
  return invite_row.match_code;
end;
$$;
create or replace function public.digihits_my_friend_messages(friend text)
returns table(id uuid, sender_id text, body text, created_at timestamptz) language sql security definer set search_path = public as $$
  select m.id, m.sender_id, m.body, m.created_at from public.digihits_friend_messages m
  where (m.sender_id = auth.uid()::text and m.recipient_id = friend) or (m.sender_id = friend and m.recipient_id = auth.uid()::text)
  order by m.created_at;
$$;
create or replace function public.digihits_send_friend_message(friend text, message_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.digihits_friendships where user_id = auth.uid()::text and friend_id = friend) then raise exception 'Spelaren är inte din vän.'; end if;
  insert into public.digihits_friend_messages(sender_id, recipient_id, body) values (auth.uid()::text, friend, trim(message_body));
end;
$$;
create or replace function public.digihits_mark_friend_chat_read(friend text)
returns void language sql security definer set search_path = public as $$
  insert into public.digihits_friend_chat_reads(user_id, friend_id, read_at) values (auth.uid()::text, friend, now())
  on conflict (user_id, friend_id) do update set read_at = excluded.read_at;
$$;
create or replace function public.digihits_my_friend_unreads()
returns table(friend_id text, unread_count bigint) language sql security definer set search_path = public as $$
  select m.sender_id, count(*) from public.digihits_friend_messages m
  join public.digihits_friendships f on f.user_id = auth.uid()::text and f.friend_id = m.sender_id
  left join public.digihits_friend_chat_reads r on r.user_id = auth.uid()::text and r.friend_id = m.sender_id
  where m.recipient_id = auth.uid()::text and m.created_at > coalesce(r.read_at, 'epoch'::timestamptz)
  group by m.sender_id;
$$;

grant execute on function public.digihits_find_friend(text), public.digihits_send_friend_request(text), public.digihits_answer_friend_request(uuid, boolean), public.digihits_remove_friend(text), public.digihits_my_friends(), public.digihits_my_friend_requests(), public.digihits_my_sent_friend_requests(), public.digihits_dismiss_sent_friend_request(uuid), public.digihits_invite_friend(text, text), public.digihits_add_friend_to_match(text, text, jsonb), public.digihits_my_match_invites(), public.digihits_my_sent_match_invites(), public.digihits_dismiss_match_invite(uuid), public.digihits_dismiss_sent_match_invite(uuid), public.digihits_accept_match_invite(uuid, jsonb), public.digihits_my_friend_messages(text), public.digihits_send_friend_message(text, text), public.digihits_mark_friend_chat_read(text), public.digihits_my_friend_unreads() to authenticated;
