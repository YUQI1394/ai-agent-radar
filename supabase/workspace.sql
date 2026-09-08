create table if not exists public.user_workspace (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('validation', 'saved')),
  record_key text not null check (char_length(record_key) between 1 and 200),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_type, record_key)
);

alter table public.user_workspace enable row level security;

revoke all on table public.user_workspace from anon;
grant select, insert, update, delete on table public.user_workspace to authenticated;

drop policy if exists "Users read their workspace" on public.user_workspace;
create policy "Users read their workspace" on public.user_workspace
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create their workspace" on public.user_workspace;
create policy "Users create their workspace" on public.user_workspace
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their workspace" on public.user_workspace;
create policy "Users update their workspace" on public.user_workspace
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their workspace" on public.user_workspace;
create policy "Users delete their workspace" on public.user_workspace
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists user_workspace_updated_idx
  on public.user_workspace (user_id, record_type, updated_at desc);
