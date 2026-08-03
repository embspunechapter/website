-- Run this once in Supabase SQL Editor before using report uploads.
alter table public.reports add column if not exists status text not null default 'submitted'
  check (status in ('submitted', 'in_review', 'approved', 'changes_requested'));
alter table public.reports add column if not exists feedback text;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.reports add column if not exists reviewed_at timestamptz;
create index if not exists reports_group_id_created_at_idx on public.reports (group_id, created_at desc);

-- Private attachments: only a submitting student, that group's mentor, or an admin can read them.
insert into storage.buckets (id, name, public) values ('reports', 'reports', false)
on conflict (id) do update set public = false;

drop policy if exists "students upload own reports" on storage.objects;
create policy "students upload own reports" on storage.objects for insert to authenticated
with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.group_id = (storage.foldername(name))[2]
));

drop policy if exists "report participants read attachments" on storage.objects;
create policy "report participants read attachments" on storage.objects for select to authenticated
using (bucket_id = 'reports' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and (
    p.role = 'admin' or
    (p.role = 'student' and p.group_id = (storage.foldername(name))[2]) or
    (p.role = 'mentor' and exists (select 1 from public.groups g where g.id = (storage.foldername(name))[2] and g.mentor_id = p.id))
  )
));