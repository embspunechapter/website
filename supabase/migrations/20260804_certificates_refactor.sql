-- REFACTOR CERTIFICATES TO SUPPORT CUSTOM FILE UPLOADS AND MENTOR CERTIFICATES
-- Run this in your Supabase SQL Editor.

-- 1. Alter certificates columns
alter table public.certificates alter column student_id drop not null;
alter table public.certificates alter column group_id drop not null;

alter table public.certificates add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;
alter table public.certificates add column if not exists recipient_role text check (recipient_role in ('student', 'mentor'));
alter table public.certificates add column if not exists file_url text;

-- Migrate existing certificates
update public.certificates 
set recipient_id = student_id, recipient_role = 'student' 
where recipient_id is null;

-- 2. Create storage bucket for issued certificates
insert into storage.buckets (id, name, public) values ('certificates', 'certificates', true)
on conflict (id) do nothing;

drop policy if exists "certificate files readable by authenticated" on storage.objects;
create policy "certificate files readable by authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'certificates');

drop policy if exists "certificate files managed by admins" on storage.objects;
create policy "certificate files managed by admins" on storage.objects
  for all to authenticated using (bucket_id = 'certificates' and public.current_role() = 'admin');
