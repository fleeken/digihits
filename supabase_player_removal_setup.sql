create table if not exists public.digihits_player_removal_votes (
  match_id text not null,
  player_id text not null,
  voter_id text not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id, voter_id)
);

alter table public.digihits_player_removal_votes enable row level security;

create or replace function public.digihits_vote_remove_match_player(match_code_input text, remove_player text)
returns table(removed boolean, votes integer, needed integer)
language plpgsql security definer set search_path = public as $$
declare m record; target_order integer; next_user text; vote_count integer; needed_count integer;
begin
  select * into m from public.online_matches where code = match_code_input;
  if not found then raise exception 'Matchkoden hittades inte.'; end if;
  if not exists (select 1 from public.online_players where match_id::text = m.id::text and user_id = auth.uid()::text and active = true) then raise exception 'Du är inte med i matchen.'; end if;
  if remove_player = auth.uid()::text then raise exception 'Du kan inte avvisa dig själv.'; end if;
  select turn_order into target_order from public.online_players where match_id::text = m.id::text and user_id = remove_player and active = true;
  if target_order is null then raise exception 'Spelaren är inte längre med i matchen.'; end if;
  select count(*) into needed_count from public.online_players where match_id::text = m.id::text and active = true and user_id <> remove_player;
  if needed_count < 2 then raise exception 'Avvisning är bara möjlig när minst tre spelare är med i matchen.'; end if;
  insert into public.digihits_player_removal_votes(match_id, player_id, voter_id) values(m.id::text, remove_player, auth.uid()::text) on conflict do nothing;
  select count(*) into vote_count from public.digihits_player_removal_votes v join public.online_players p on p.match_id::text = v.match_id and p.user_id = v.voter_id and p.active = true where v.match_id = m.id::text and v.player_id = remove_player;
  if vote_count >= needed_count then
    update public.online_players set active = false, updated_at = now() where match_id::text = m.id::text and user_id = remove_player;
    if m.current_user_id::text = remove_player then
      select user_id into next_user from public.online_players where match_id::text = m.id::text and active = true and turn_order > target_order order by turn_order limit 1;
      if next_user is null then select user_id into next_user from public.online_players where match_id::text = m.id::text and active = true order by turn_order limit 1; end if;
      update public.online_matches set current_user_id = next_user, updated_at = now() where id::text = m.id::text;
    else
      update public.online_matches set updated_at = now() where id::text = m.id::text;
    end if;
    delete from public.digihits_player_removal_votes where match_id = m.id::text and player_id = remove_player;
    return query select true, vote_count, needed_count;
  end if;
  return query select false, vote_count, needed_count;
end;
$$;

grant execute on function public.digihits_vote_remove_match_player(text, text) to authenticated;
