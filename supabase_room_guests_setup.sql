-- Run in the Supabase SQL editor before enabling multi-device room matches.
-- Also enable Authentication > Providers > Anonymous Sign-Ins in the Supabase dashboard.
create table if not exists public.digihits_room_matches (
  match_code text primary key,
  owner_id text not null,
  created_at timestamptz not null default now()
);
alter table public.digihits_room_matches enable row level security;
revoke all on public.digihits_room_matches from anon, authenticated;

alter table public.online_players add column if not exists avatar_genre text;
alter table public.online_players add column if not exists avatar_variant integer;
alter table public.online_players add column if not exists room_live_placement jsonb;

-- Only the player whose turn it is can publish the public placement state.
create or replace function public.digihits_publish_room_placement(
  match_code_input text, placed_position integer, live_phase text
) returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; p public.online_players%rowtype; slot_count integer;
begin
  if auth.uid() is null or match_code_input !~ '^M0[A-Z2-9]{4}$'
    or not exists (select 1 from public.digihits_room_matches where match_code = match_code_input)
  then raise exception 'Ogiltig rumsmatch.'; end if;
  select * into m from public.online_matches where code = match_code_input;
  if m.id is null or m.status <> 'active' or m.current_user_id::text <> auth.uid()::text
  then raise exception 'Det är inte din tur.'; end if;
  select * into p from public.online_players where match_id = m.id and user_id = auth.uid()::text and active for update;
  if p.id is null then raise exception 'Du deltar inte i matchen.'; end if;
  if live_phase not in ('guessing', 'choosing', 'placing', 'revealed') then raise exception 'Ogiltigt steg.'; end if;
  slot_count := jsonb_array_length(coalesce(p.locked_timeline, '[]'::jsonb)) + jsonb_array_length(coalesce(p.turn_cards, '[]'::jsonb));
  if live_phase in ('placing','revealed') and (p.current_card is null or placed_position is null or placed_position < 0 or placed_position > slot_count)
  then raise exception 'Ogiltig placering.'; end if;
  update public.online_players set room_live_placement = jsonb_build_object(
    'phase', live_phase, 'position', case when live_phase in ('placing','revealed') then placed_position else null end,
    'card_id', p.current_card->>'id', 'updated_at', now(),
    'artist', case when p.room_live_placement->>'card_id' = p.current_card->>'id' then coalesce(p.room_live_placement->>'artist', '') else '' end,
    'title', case when p.room_live_placement->>'card_id' = p.current_card->>'id' then coalesce(p.room_live_placement->>'title', '') else '' end
  ), updated_at = now() where id = p.id;
end; $$;
revoke all on function public.digihits_publish_room_placement(text,integer,text) from public, anon;
grant execute on function public.digihits_publish_room_placement(text,integer,text) to authenticated;

-- Publish only the current player's draft, without exposing or changing the secret card.
create or replace function public.digihits_publish_room_guess(
  match_code_input text, guess_artist text, guess_title text
) returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; p public.online_players%rowtype;
begin
  if auth.uid() is null or match_code_input !~ '^M0[A-Z2-9]{4}$'
    or not exists (select 1 from public.digihits_room_matches where match_code = match_code_input)
  then raise exception 'Ogiltig rumsmatch.'; end if;
  select * into m from public.online_matches where code = match_code_input;
  if m.id is null or m.status <> 'active' or m.current_user_id::text <> auth.uid()::text
  then raise exception 'Det är inte din tur.'; end if;
  select * into p from public.online_players where match_id = m.id and user_id = auth.uid()::text and active for update;
  if p.id is null or p.current_card is null then raise exception 'Inget kort att gissa på.'; end if;
  update public.online_players set room_live_placement = jsonb_build_object(
    'phase', 'guessing', 'position', null, 'card_id', p.current_card->>'id',
    'artist', left(coalesce(guess_artist, ''), 120), 'title', left(coalesce(guess_title, ''), 120), 'updated_at', now()
  ), updated_at = now() where id = p.id;
end; $$;
revoke all on function public.digihits_publish_room_guess(text,text,text) from public, anon;
grant execute on function public.digihits_publish_room_guess(text,text,text) to authenticated;

create or replace function public.digihits_register_room_match(match_code_input text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Logga in för att skapa en match.'; end if;
  if match_code_input !~ '^M0[A-Z2-9]{4}$' then raise exception 'Ogiltig matchkod.'; end if;
  if not exists (
    select 1 from public.online_matches m join public.online_players p on p.match_id = m.id
    where m.code = match_code_input and m.status = 'waiting' and p.user_id = auth.uid()::text
      and p.turn_order = 0 and p.active = true
  ) then raise exception 'Matchen tillhör inte dig.'; end if;
  insert into public.digihits_room_matches(match_code, owner_id)
  values(match_code_input, auth.uid()::text) on conflict do nothing;
end; $$;

create or replace function public.digihits_join_room_match(
  match_code_input text, guest_name text, chosen_genre text, chosen_variant integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; n integer; starter jsonb; cleaned_name text := btrim(guest_name);
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
  if m.phase = 'locked' then raise exception 'Matchen tar inte emot fler deltagare.'; end if;
  if exists (select 1 from public.online_players where match_id = m.id and user_id = auth.uid()::text and active) then
    return jsonb_build_object('match_code', match_code_input);
  end if;
  select count(*) into n from public.online_players where match_id = m.id and active;
  if n >= 8 then raise exception 'Matchen är full – högst 8 spelare.'; end if;
  if exists (select 1 from public.online_players where match_id = m.id and active and lower(display_name) = lower(cleaned_name))
  then raise exception 'Namnet används redan i matchen.'; end if;
  select card into starter from jsonb_array_elements(m.deck) card
    where not coalesce(m.used_track_ids, '[]'::jsonb) ? (card->>'id') order by random() limit 1;
  if starter is null then raise exception 'Inga startkort finns kvar.'; end if;
  insert into public.online_players(match_id,user_id,display_name,turn_order,locked_timeline,turn_cards,
    swap_cards,rounds_started,active,history_hidden,updated_at,avatar_genre,avatar_variant)
  values(m.id,auth.uid()::text,cleaned_name,n,jsonb_build_array(starter),'[]'::jsonb,
    0,0,true,false,now(),chosen_genre,chosen_variant);
  update public.online_matches set status = 'active',
    phase = case when status = 'waiting' then 'turn_ready' else phase end,
    used_track_ids = coalesce(used_track_ids, '[]'::jsonb) || jsonb_build_array(starter->>'id'),
    updated_at = now() where id = m.id;
  return jsonb_build_object('match_code', match_code_input);
end; $$;

revoke all on function public.digihits_register_room_match(text) from public, anon;
revoke all on function public.digihits_join_room_match(text,text,text,integer) from public, anon;
grant execute on function public.digihits_register_room_match(text) to authenticated;
grant execute on function public.digihits_join_room_match(text,text,text,integer) to authenticated;
