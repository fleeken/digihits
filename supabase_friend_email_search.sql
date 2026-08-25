-- Kör en gång i Supabase SQL Editor. Vänförfrågan kan sedan sökas via spelarnamn eller e-post.
create or replace function public.digihits_find_friend(requested text)
returns table(user_id text, display_name text) language sql security definer set search_path = public, auth as $$
  select p.user_id::text, p.display_name
  from public.digihits_profiles p
  join auth.users u on u.id::text = p.user_id::text
  where lower(p.display_name_key) = lower(trim(requested))
     or lower(u.email) = lower(trim(requested))
  limit 1;
$$;

create or replace function public.digihits_send_friend_request(requested text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare target text := (select user_id from public.digihits_find_friend(requested));
begin
  if target is null then raise exception 'Spelarnamn eller e-post hittades inte.'; end if;
  if target = auth.uid()::text then raise exception 'Du kan inte lägga till dig själv.'; end if;
  if exists(select 1 from public.digihits_blocks where blocker_id = auth.uid()::text and blocked_id = target) then raise exception 'Gick inte att lägga till spelaren eftersom du har blockerat personen.'; end if;
  if exists(select 1 from public.digihits_blocks where blocker_id = target and blocked_id = auth.uid()::text) then raise exception 'Gick inte att lägga till spelaren eftersom personen har blockerat dig.'; end if;
  if exists(select 1 from public.digihits_friendships where user_id = auth.uid()::text and friend_id = target) then raise exception 'Ni är redan vänner.'; end if;
  insert into public.digihits_friend_requests(sender_id, recipient_id)
  values(auth.uid()::text, target)
  on conflict(sender_id, recipient_id) do update set status = 'pending', created_at = now();
end;
$$;

grant execute on function public.digihits_find_friend(text), public.digihits_send_friend_request(text) to authenticated;
