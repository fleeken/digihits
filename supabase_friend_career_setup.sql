-- Kan köras fristående. Gör avatarer och onlinekarriär synliga i vänskapslistan.
alter table public.digihits_profiles add column if not exists avatar_genre text;
alter table public.digihits_profiles add column if not exists avatar_variant integer;
alter table public.digihits_profiles add column if not exists career_points integer not null default 0;

update public.digihits_profiles
set avatar_genre = coalesce(avatar_genre, (array['Pop','Rock','Hiphop','EDM','Country','Indie','R&B','Metal','Reggae','Jazz'])[1 + mod(abs(hashtext(user_id::text)), 10)]),
    avatar_variant = coalesce(avatar_variant, mod(abs(hashtext(user_id::text)), 6));

drop function if exists public.digihits_my_friends();
create function public.digihits_my_friends()
returns table(friend_id text, display_name text, avatar_genre text, avatar_variant integer, career_points integer)
language sql security definer set search_path = public as $$
  select f.friend_id, p.display_name, p.avatar_genre, p.avatar_variant, p.career_points
  from public.digihits_friendships f
  join public.digihits_profiles p on p.user_id::text = f.friend_id
  where f.user_id = auth.uid()::text
  order by lower(p.display_name);
$$;

create or replace function public.digihits_set_career(career_points_input integer)
returns void language sql security definer set search_path = public as $$
  update public.digihits_profiles
  set career_points = greatest(0, least(career_points_input, 1000000))
  where user_id::text = auth.uid()::text;
$$;

grant execute on function public.digihits_my_friends(), public.digihits_set_career(integer) to authenticated;
