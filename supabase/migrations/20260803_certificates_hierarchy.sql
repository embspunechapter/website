-- Setup 2-stage approval hierarchy on Certificates
-- Run this in your Supabase SQL Editor.

-- 1. Add approval columns to public.certificates
alter table public.certificates add column if not exists admin_approved boolean not null default false;
alter table public.certificates add column if not exists admin_approved_by uuid references public.profiles(id);
alter table public.certificates add column if not exists admin_approved_at timestamptz;

alter table public.certificates add column if not exists mentor_approved boolean not null default false;
alter table public.certificates add column if not exists mentor_approved_by uuid references public.profiles(id);
alter table public.certificates add column if not exists mentor_approved_at timestamptz;

-- 2. Enable RLS and adjust policies for certificates
alter table public.certificates enable row level security;

drop policy if exists "users see own certificates" on public.certificates;
create policy "users see own certificates" on public.certificates 
  for select to authenticated 
  using (
    (student_id = auth.uid() and admin_approved = true and mentor_approved = true)
    or public.current_role() = 'admin'
  );

drop policy if exists "mentors see certificates of their groups" on public.certificates;
create policy "mentors see certificates of their groups" on public.certificates 
  for select to authenticated 
  using (
    exists (
      select 1 from public.groups g 
      where g.id = certificates.group_id and g.mentor_id = auth.uid()
    )
  );

drop policy if exists "mentors update certificates of their groups" on public.certificates;
create policy "mentors update certificates of their groups" on public.certificates 
  for update to authenticated 
  using (
    exists (
      select 1 from public.groups g 
      where g.id = certificates.group_id and g.mentor_id = auth.uid()
    )
  );

drop policy if exists "admins issue certificates" on public.certificates;
create policy "admins issue certificates" on public.certificates 
  for all to authenticated 
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
