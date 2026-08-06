-- ADJUST GROUPS SELECT POLICY TO SUPPORT PUBLIC LANDING PAGE DYNAMIC STATS
-- Run this in your Supabase SQL Editor.

-- Drop the old policy that restricted reads to logged-in users only
drop policy if exists "groups readable by authenticated" on public.groups;

-- Allow both anonymous and authenticated visitors to fetch group counts/domains for stats
create policy "groups readable by everyone" on public.groups
  for select
  using (true);
