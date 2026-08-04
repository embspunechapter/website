-- CREATE TEMPLATES TABLE AND STORAGE BUCKET FOR FORMATS
-- Run this in your Supabase SQL Editor.

-- 1. Create templates table
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('report', 'presentation', 'certificate')),
  file_url text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.templates enable row level security;

-- Policies for templates
drop policy if exists "templates readable by authenticated" on public.templates;
create policy "templates readable by authenticated" on public.templates
  for select to authenticated using (true);

drop policy if exists "templates managed by admins" on public.templates;
create policy "templates managed by admins" on public.templates
  for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- 2. Storage bucket policies for templates
insert into storage.buckets (id, name, public) values ('templates', 'templates', true)
on conflict (id) do nothing;

drop policy if exists "template files readable by authenticated" on storage.objects;
create policy "template files readable by authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'templates');

drop policy if exists "template files managed by admins" on storage.objects;
create policy "template files managed by admins" on storage.objects
  for all to authenticated using (bucket_id = 'templates' and public.current_role() = 'admin');
