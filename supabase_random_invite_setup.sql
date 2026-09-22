-- Kör en gång i Supabase SQL Editor. Skapar en ny matchinbjudan till ett
-- slumpmässigt registrerat konto, oavsett om mottagaren är online eller offline.
create or replace function public.digihits_invite_random_player(match_code_input text)
returns table(recipient_id text, recipient_name text)
language plpgsql security definer set search_path = public as $$
declare
  chosen record;
begin
  if not exists (
    select 1
    from public.online_matches m
    join public.online_players p on p.match_id::text = m.id::text
    where m.code = match_code_input
      and m.status = 'waiting'
      and p.user_id = auth.uid()::text
      and p.active = true
  ) then
    raise exception 'Matchen kan inte bjuda in en slumpvald spelare.';
  end if;

  select p.user_id::text as user_id, p.display_name
  into chosen
  from public.digihits_profiles p
  where p.user_id::text <> auth.uid()::text
    and not exists (
      select 1 from public.digihits_blocks b
      where (b.blocker_id = auth.uid()::text and b.blocked_id = p.user_id::text)
         or (b.blocker_id = p.user_id::text and b.blocked_id = auth.uid()::text)
    )
    and not exists (
      select 1 from public.digihits_match_invites i
      where i.match_code = match_code_input and i.recipient_id = p.user_id::text
    )
  order by random()
  limit 1;

  if not found then
    raise exception 'Det finns inget annat registrerat konto att bjuda in just nu.';
  end if;

  insert into public.digihits_match_invites(match_code, sender_id, recipient_id)
  values(match_code_input, auth.uid()::text, chosen.user_id);

  return query select chosen.user_id::text, chosen.display_name::text;
end;
$$;

grant execute on function public.digihits_invite_random_player(text) to authenticated;
