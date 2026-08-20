-- Kör en gång. Rensar endast tidigare testmeddelanden, inte matcher eller konton.
drop table if exists public.online_messages;

create table public.online_messages (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  user_id text not null,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.online_messages enable row level security;

create policy "Digihits players read chat"
on public.online_messages for select to authenticated
using (
  exists (
    select 1 from public.online_players p
    where p.match_id::text = online_messages.match_id
      and p.user_id::text = auth.uid()::text
  )
);

create policy "Digihits players send chat"
on public.online_messages for insert to authenticated
with check (
  user_id = auth.uid()::text
  and exists (
    select 1 from public.online_players p
    where p.match_id::text = online_messages.match_id
      and p.user_id::text = auth.uid()::text
  )
);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'online_messages'
  ) then
    alter publication supabase_realtime add table public.online_messages;
  end if;
end $$;
