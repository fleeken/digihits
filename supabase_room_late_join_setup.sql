-- Run once in Supabase SQL Editor after the room lobby setup.
-- Allows new guests until the match is finished, including locked phases.
-- Keeps the eight-player limit and appends newcomers to the turn order.
begin;

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
    0,0,true,false,now(),chosen_genre,chosen_variant,m.status <> 'waiting');
  update public.online_matches set used_track_ids = coalesce(used_track_ids, '[]'::jsonb) || jsonb_build_array(starter->>'id'),
    updated_at = now() where id = m.id;
  return jsonb_build_object('match_code', match_code_input);
end; $$;
revoke all on function public.digihits_join_room_match(text,text,text,integer) from public, anon;
grant execute on function public.digihits_join_room_match(text,text,text,integer) to authenticated;

commit;
