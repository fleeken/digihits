-- Run after supabase_room_guests_setup.sql in the same Supabase project.
alter table public.online_players add column if not exists room_ready boolean not null default false;

-- Joining a room now keeps everyone in the lobby until the host starts it.
create or replace function public.digihits_join_room_match(
  match_code_input text, guest_name text, chosen_genre text, chosen_variant integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; n integer; next_order integer; starter jsonb; cleaned_name text := btrim(guest_name);
begin
  if auth.uid() is null then raise exception 'Gästsession saknas.'; end if;
  if match_code_input !~ '^M0[A-Z2-9]{4}$' or not exists
    (select 1 from public.digihits_room_matches where match_code = match_code_input)
  then raise exception 'Inbjudningslänken hittades inte.'; end if;
  if cleaned_name is null or char_length(cleaned_name) not between 1 and 18 then
    raise exception 'Ange ett namn på högst 18 tecken.'; end if;
  if chosen_genre not in ('Pop','Rock','Hiphop','EDM','Country','Indie','R&B','Metal','Reggae','Jazz')
    or chosen_variant not between 0 and 5 then raise exception 'Välj en giltig avatar.'; end if;
  select * into m from public.online_matches where code = match_code_input for update;
  if m.id is null or m.status = 'finished' then raise exception 'Matchen är avslutad.'; end if;
  if exists (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text and active) then
    return jsonb_build_object('match_code', match_code_input);
  end if;
  if m.status <> 'waiting' then raise exception 'Matchen har redan startat.'; end if;
  if exists (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text) then
    raise exception 'Du har redan lämnat den här matchen.'; end if;
  select count(*) into n from public.online_players where match_id = m.id and active;
  if n >= 8 then raise exception 'Matchen är full – högst 8 spelare.'; end if;
  select coalesce(max(turn_order), 0) + 1 into next_order from public.online_players where match_id = m.id;
  if exists (select 1 from public.online_players where match_id = m.id and active and lower(display_name) = lower(cleaned_name))
  then raise exception 'Namnet används redan i matchen.'; end if;
  select card into starter from jsonb_array_elements(m.deck) card
    where not coalesce(m.used_track_ids, '[]'::jsonb) ? (card->>'id') order by random() limit 1;
  if starter is null then raise exception 'Inga startkort finns kvar.'; end if;
  insert into public.online_players(match_id,user_id,display_name,turn_order,locked_timeline,turn_cards,
    swap_cards,rounds_started,active,history_hidden,updated_at,avatar_genre,avatar_variant,room_ready)
  values(m.id,auth.uid()::text,cleaned_name,next_order,jsonb_build_array(starter),'[]'::jsonb,
    0,0,true,false,now(),chosen_genre,chosen_variant,false);
  update public.online_matches set updated_at = now() where id = m.id;
  return jsonb_build_object('match_code', match_code_input);
end; $$;
revoke all on function public.digihits_join_room_match(text,text,text,integer) from public, anon;
grant execute on function public.digihits_join_room_match(text,text,text,integer) to authenticated;

create or replace function public.digihits_set_room_ready(match_code_input text, is_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype;
begin
  select * into m from public.online_matches where code = match_code_input for update;
  if m.id is null or m.status <> 'waiting' or not exists
    (select 1 from public.digihits_room_matches where match_code = match_code_input)
  then raise exception 'Lobbyn är inte längre öppen.'; end if;
  if auth.uid() is null or not exists
    (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text and active)
  then raise exception 'Du deltar inte i matchen.'; end if;
  update public.online_players set room_ready = coalesce(is_ready, false), updated_at = now()
    where match_id = m.id and user_id = auth.uid()::text and active;
end; $$;
revoke all on function public.digihits_set_room_ready(text,boolean) from public, anon;
grant execute on function public.digihits_set_room_ready(text,boolean) to authenticated;

create or replace function public.digihits_update_room_profile(
  match_code_input text, new_name text, chosen_genre text, chosen_variant integer
) returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; cleaned_name text := btrim(new_name);
begin
  select * into m from public.online_matches where code = match_code_input for update;
  if m.id is null or m.status <> 'waiting' or not exists
    (select 1 from public.digihits_room_matches where match_code = match_code_input)
  then raise exception 'Namn och avatar kan bara ändras före matchstart.'; end if;
  if auth.uid() is null or not exists
    (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text and active)
  then raise exception 'Du deltar inte i matchen.'; end if;
  if cleaned_name is null or char_length(cleaned_name) not between 1 and 18 then
    raise exception 'Ange ett namn på högst 18 tecken.'; end if;
  if chosen_genre not in ('Pop','Rock','Hiphop','EDM','Country','Indie','R&B','Metal','Reggae','Jazz')
    or chosen_variant not between 0 and 5 then raise exception 'Välj en giltig avatar.'; end if;
  if exists (select 1 from public.online_players where match_id = m.id and active
    and user_id <> auth.uid()::text and lower(display_name) = lower(cleaned_name))
  then raise exception 'Namnet används redan i matchen.'; end if;
  update public.online_players set display_name = cleaned_name, avatar_genre = chosen_genre,
    avatar_variant = chosen_variant, room_ready = false, updated_at = now()
    where match_id = m.id and user_id = auth.uid()::text and active;
end; $$;
-- Names and avatars are chosen before joining; the profile change RPC is kept
-- for old schema compatibility but cannot be called by room participants.
revoke all on function public.digihits_update_room_profile(text,text,text,integer) from public, anon, authenticated;

create or replace function public.digihits_start_room_match(match_code_input text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; room_owner text; player_count integer; ready_count integer;
begin
  select * into m from public.online_matches where code = match_code_input for update;
  select owner_id into room_owner from public.digihits_room_matches where match_code = match_code_input;
  if m.id is null or m.status <> 'waiting' or room_owner is null then raise exception 'Lobbyn är inte längre öppen.'; end if;
  if auth.uid() is null or room_owner <> auth.uid()::text then raise exception 'Bara värden kan starta matchen.'; end if;
  select count(*), count(*) filter (where room_ready) into player_count, ready_count
    from public.online_players where match_id = m.id and active;
  if player_count < 2 then raise exception 'Minst två deltagare måste vara med.'; end if;
  if player_count <> ready_count then raise exception 'Alla deltagare måste trycka Jag är redo.'; end if;
  update public.online_matches set status = 'active', phase = 'turn_ready',
    current_user_id = room_owner, updated_at = now() where id = m.id;
end; $$;
revoke all on function public.digihits_start_room_match(text) from public, anon;
grant execute on function public.digihits_start_room_match(text) to authenticated;

-- Guests leave only their own seat. The host's departure closes the room.
create or replace function public.digihits_leave_room_match(match_code_input text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; room_owner text; next_user text; remaining integer; remaining_user text;
begin
  select * into m from public.online_matches where code = match_code_input for update;
  select owner_id into room_owner from public.digihits_room_matches where match_code = match_code_input;
  if m.id is null or m.status = 'finished' or room_owner is null then raise exception 'Matchen är avslutad.'; end if;
  if auth.uid() is null or not exists
    (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text and active)
  then raise exception 'Du deltar inte i matchen.'; end if;
  if room_owner = auth.uid()::text then
    update public.online_matches set status = 'finished', phase = 'finished', updated_at = now() where id = m.id;
    return;
  end if;
  update public.online_players set active = false, room_ready = false, updated_at = now()
    where match_id = m.id and user_id = auth.uid()::text;
  select count(*), min(user_id) into remaining, remaining_user
    from public.online_players where match_id = m.id and active;
  if m.status = 'active' and remaining = 1 then
    update public.online_matches set status = 'finished', phase = 'finished',
      last_result = jsonb_build_object('winner_id', remaining_user, 'type', 'walkover'), updated_at = now() where id = m.id;
  elsif m.status = 'active' and m.current_user_id::text = auth.uid()::text then
    select user_id into next_user from public.online_players where match_id = m.id and active
      order by turn_order limit 1;
    update public.online_matches set current_user_id = next_user, updated_at = now() where id = m.id;
  else
    update public.online_matches set updated_at = now() where id = m.id;
  end if;
end; $$;
revoke all on function public.digihits_leave_room_match(text) from public, anon;
grant execute on function public.digihits_leave_room_match(text) to authenticated;

-- Only the host may remove another participant; this also works after start.
create or replace function public.digihits_remove_room_guest(match_code_input text, guest_user_id text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; room_owner text; next_user text; remaining integer;
begin
  select * into m from public.online_matches where code = match_code_input for update;
  select owner_id into room_owner from public.digihits_room_matches where match_code = match_code_input;
  if m.id is null or m.status = 'finished' or room_owner is null then raise exception 'Matchen är avslutad.'; end if;
  if auth.uid() is null or room_owner <> auth.uid()::text then raise exception 'Bara värden kan ta bort deltagare.'; end if;
  if guest_user_id = room_owner or not exists
    (select 1 from public.online_players where match_id = m.id and user_id = guest_user_id and active)
  then raise exception 'Deltagaren finns inte i matchen.'; end if;
  update public.online_players set active = false, room_ready = false, updated_at = now()
    where match_id = m.id and user_id = guest_user_id;
  select count(*) into remaining from public.online_players where match_id = m.id and active;
  if m.status = 'active' and remaining = 1 then
    update public.online_matches set status = 'finished', phase = 'finished',
      last_result = jsonb_build_object('winner_id', room_owner, 'type', 'walkover'), updated_at = now() where id = m.id;
  elsif m.status = 'active' and m.current_user_id::text = guest_user_id then
    select user_id into next_user from public.online_players where match_id = m.id and active
      order by turn_order limit 1;
    update public.online_matches set current_user_id = next_user, updated_at = now() where id = m.id;
  else
    update public.online_matches set updated_at = now() where id = m.id;
  end if;
end; $$;
revoke all on function public.digihits_remove_room_guest(text,text) from public, anon;
grant execute on function public.digihits_remove_room_guest(text,text) to authenticated;
