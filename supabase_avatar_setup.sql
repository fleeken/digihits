-- Kör en gång i Supabase SQL Editor. Sparar avatarval och ger alla befintliga profiler en standardavatar.
alter table public.digihits_profiles add column if not exists avatar_genre text;
alter table public.digihits_profiles add column if not exists avatar_variant integer;

update public.digihits_profiles
set avatar_genre = (array['Pop','Rock','Hiphop','EDM','Country','Indie','R&B','Metal','Reggae','Jazz'])[1 + mod(abs(hashtext(user_id::text)), 10)],
    avatar_variant = mod(abs(hashtext(user_id::text)), 6)
where avatar_genre is null or avatar_variant is null;

drop function if exists public.digihits_my_friends();
create function public.digihits_my_friends()
returns table(friend_id text, display_name text, avatar_genre text, avatar_variant integer)
language sql security definer set search_path = public as $$
  select f.friend_id, p.display_name, p.avatar_genre, p.avatar_variant
  from public.digihits_friendships f
  join public.digihits_profiles p on p.user_id::text = f.friend_id
  where f.user_id = auth.uid()::text
  order by lower(p.display_name);
$$;

create or replace function public.digihits_my_avatar()
returns table(avatar_genre text, avatar_variant integer)
language sql security definer set search_path = public as $$
  select p.avatar_genre, p.avatar_variant
  from public.digihits_profiles p
  where p.user_id::text = auth.uid()::text;
$$;

create or replace function public.digihits_set_avatar(chosen_genre text, chosen_variant integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if chosen_genre not in ('Pop','Rock','Hiphop','EDM','Country','Indie','R&B','Metal','Reggae','Jazz') or chosen_variant not between 0 and 5 then
    raise exception 'Ogiltigt avatarval.';
  end if;
  update public.digihits_profiles
  set avatar_genre = chosen_genre, avatar_variant = chosen_variant
  where user_id::text = auth.uid()::text;
end;
$$;

grant execute on function public.digihits_my_friends(), public.digihits_my_avatar(), public.digihits_set_avatar(text, integer) to authenticated;
