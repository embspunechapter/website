-- ADD NEW FIELDS TO PROFILES, MEETINGS, AND REPORTS FOR FILTERS, WEEK-WISE REPORTS, AND MEETING SCREENSHOTS
-- Run this in your Supabase SQL Editor.

-- 1. Profiles Table extensions for advanced filtering
alter table public.profiles add column if not exists section text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists is_ieee_member boolean not null default false;
alter table public.profiles add column if not exists graduation_year text;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists designation text;

-- 2. Reports Table extension for week-wise tracking
alter table public.reports add column if not exists week_number integer;

-- 3. Meetings Table extension for uploading meeting screenshots
alter table public.meetings add column if not exists screenshot_url text;

-- 4. Enable Storage bucket for meeting screenshots if it does not exist
-- (we will upload screenshot files to a 'meetings' bucket in storage)
insert into storage.buckets (id, name, public) 
values ('meetings', 'meetings', false)
on conflict (id) do nothing;

-- 5. Enable Storage access policy for meetings screenshots
drop policy if exists "mentors upload meeting screenshots" on storage.objects;
create policy "mentors upload meeting screenshots" on storage.objects for insert to authenticated
with check (bucket_id = 'meetings');

drop policy if exists "anyone authenticated read meeting screenshots" on storage.objects;
create policy "anyone authenticated read meeting screenshots" on storage.objects for select to authenticated
using (bucket_id = 'meetings');
