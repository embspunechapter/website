-- Enable RLS and define security rules for core tables: profiles, groups, queries, reports.
-- Run this in your Supabase SQL Editor.

-- ==========================================
-- 1. PROFILES Table RLS
-- ==========================================
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "users update own details" on public.profiles;
create policy "users update own details" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ==========================================
-- 2. GROUPS Table RLS
-- ==========================================
alter table public.groups enable row level security;

drop policy if exists "groups readable by authenticated" on public.groups;
create policy "groups readable by authenticated" on public.groups
  for select to authenticated
  using (true);

drop policy if exists "admins manage groups" on public.groups;
create policy "admins manage groups" on public.groups
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ==========================================
-- 3. QUERIES Table RLS
-- ==========================================
alter table public.queries enable row level security;

drop policy if exists "queries visible to group participants and admins" on public.queries;
create policy "queries visible to group participants and admins" on public.queries
  for select to authenticated
  using (
    public.current_role() = 'admin' or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.group_id = queries.group_id
    ) or
    exists (
      select 1 from public.groups g
      where g.id = queries.group_id and g.mentor_id = auth.uid()
    )
  );

drop policy if exists "students insert own group queries" on public.queries;
create policy "students insert own group queries" on public.queries
  for insert to authenticated
  with check (
    public.current_role() = 'student' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.group_id = queries.group_id
    )
  );

drop policy if exists "mentors and admins answer queries" on public.queries;
create policy "mentors and admins answer queries" on public.queries
  for update to authenticated
  using (
    public.current_role() = 'admin' or
    exists (
      select 1 from public.groups g
      where g.id = queries.group_id and g.mentor_id = auth.uid()
    )
  );

-- ==========================================
-- 4. REPORTS Table RLS
-- ==========================================
alter table public.reports enable row level security;

drop policy if exists "reports visible to group participants and admins" on public.reports;
create policy "reports visible to group participants and admins" on public.reports
  for select to authenticated
  using (
    public.current_role() = 'admin' or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.group_id = reports.group_id
    ) or
    exists (
      select 1 from public.groups g
      where g.id = reports.group_id and g.mentor_id = auth.uid()
    )
  );

drop policy if exists "students upload own group reports" on public.reports;
create policy "students upload own group reports" on public.reports
  for insert to authenticated
  with check (
    public.current_role() = 'student' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.group_id = reports.group_id
    )
  );

drop policy if exists "mentors and admins update reports" on public.reports;
create policy "mentors and admins update reports" on public.reports
  for update to authenticated
  using (
    public.current_role() = 'admin' or
    exists (
      select 1 from public.groups g
      where g.id = reports.group_id and g.mentor_id = auth.uid()
    )
  );
