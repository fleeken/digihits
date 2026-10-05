-- Kör i Supabase SQL Editor efter att ha valt Digihits-projektet.
-- Bevarar stavningen som visas; jämförelser och unikhet ignorerar skiftläge.
-- Kör inga namnändringar på befintliga konton. Avbryt vid befintliga kollisioner.
begin;
lock table public.digihits_profiles in share row exclusive mode;
do $$
begin
  if exists (
    select lower(btrim(display_name)) from public.digihits_profiles
    where display_name is not null
    group by lower(btrim(display_name)) having count(*) > 1
  ) then
    raise exception 'Befintliga användarnamn skiljer sig bara i stora/små bokstäver. Välj nya namn för dessa konton innan migreringen körs.';
  end if;
end;
$$;
create unique index if not exists digihits_profiles_display_name_case_unique
  on public.digihits_profiles (lower(btrim(display_name)));

create or replace function public.digihits_player_name_taken(requested_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.digihits_profiles p
    where lower(btrim(p.display_name)) = lower(btrim(requested_name))
  );
$$;
revoke all on function public.digihits_player_name_taken(text) from public;
grant execute on function public.digihits_player_name_taken(text) to anon, authenticated;

-- Returnera samma sparade avatar som vänskapslistan använder.
-- Funktionssignaturen ändras från äldre installationer med bara namn och ID.
drop function if exists public.digihits_find_friend(text);
create function public.digihits_find_friend(requested text)
returns table(user_id text, display_name text, avatar_genre text, avatar_variant integer, career_points integer)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select p.user_id::text, p.display_name, p.avatar_genre, p.avatar_variant, coalesce(p.career_points, 0)
  from public.digihits_profiles p
  join auth.users u on u.id::text = p.user_id::text
  where auth.uid() is not null
    and (lower(btrim(p.display_name)) = lower(btrim(requested))
      or lower(btrim(u.email)) = lower(btrim(requested)))
  order by p.user_id::text
  limit 1;
$$;
revoke all on function public.digihits_find_friend(text) from public;
grant execute on function public.digihits_find_friend(text) to authenticated;
notify pgrst, 'reload schema';
commit;

-- Om migreringen rapporterar kollisioner, använd denna läsfråga för att se dem:
-- select lower(btrim(display_name)) as name_key, array_agg(display_name) as names,
--        array_agg(user_id::text) as account_ids
-- from public.digihits_profiles
-- group by lower(btrim(display_name)) having count(*) > 1;
