-- FIX NOTIFICATIONS RLS POLICIES & ACTIVATE REALTIME REPLICATION
-- Run this script in your Supabase SQL Editor.

-- 1. Enable authenticated users to insert notifications for other users
drop policy if exists "anyone authenticated can create notifications" on public.notifications;
create policy "anyone authenticated can create notifications" 
on public.notifications 
for insert 
to authenticated 
with check (true);

-- 2. Add notifications table to the Supabase Realtime publication
alter publication supabase_realtime add table public.notifications;
