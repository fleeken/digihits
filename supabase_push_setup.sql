create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Digihits manage own push subscriptions" on public.push_subscriptions;
create policy "Digihits manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);
