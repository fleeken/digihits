-- Kör en gång i Supabase SQL Editor. Sparar den personliga 2D-avataren.
alter table public.digihits_profiles add column if not exists avatar_traits jsonb;

update public.digihits_profiles
set avatar_traits = coalesce(avatar_traits, '{"skin":"Mellan","presentation":"Androgyn","eyes":"Brun","hair":"Vågor","hairColor":"Mörk","outfit":"Pop","accessory":"Hörlurar","headwear":"Ingen","facialHair":"Ingen"}'::jsonb);

drop function if exists public.digihits_my_avatar();
create function public.digihits_my_avatar()
returns table(avatar_genre text, avatar_variant integer, avatar_traits jsonb)
language sql security definer set search_path = public as $$
  select p.avatar_genre, p.avatar_variant, p.avatar_traits
  from public.digihits_profiles p where p.user_id::text = auth.uid()::text;
$$;

drop function if exists public.digihits_set_avatar(text, integer);
create function public.digihits_set_avatar(chosen_genre text, chosen_variant integer, chosen_traits jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.digihits_profiles
  set avatar_genre = chosen_genre, avatar_variant = chosen_variant, avatar_traits = chosen_traits
  where user_id::text = auth.uid()::text;
end;
$$;

drop function if exists public.digihits_my_friends();
create function public.digihits_my_friends()
returns table(friend_id text, display_name text, avatar_genre text, avatar_variant integer, career_points integer, avatar_traits jsonb)
language sql security definer set search_path = public as $$
  select f.friend_id, p.display_name, p.avatar_genre, p.avatar_variant, coalesce(p.career_points, 0), p.avatar_traits
  from public.digihits_friendships f
  join public.digihits_profiles p on p.user_id::text = f.friend_id
  where f.user_id = auth.uid()::text order by lower(p.display_name);
$$;

grant execute on function public.digihits_my_avatar(), public.digihits_set_avatar(text, integer, jsonb), public.digihits_my_friends() to authenticated;
