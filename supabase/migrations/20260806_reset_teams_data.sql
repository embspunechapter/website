-- SQL SCRIPT TO RESET IMPORTED TEAMS, MEETINGS, REPORTS, MILESTONES, AND CERTIFICATES
-- KEEPS THE DEMO TEAM (EMBS-TEAM-01) INTACT FOR FRESH TESTING
-- Run this in your Supabase SQL Editor.

-- 1. Delete certificates of students not in the demo group
delete from public.certificates 
where recipient_id not in (
  select id from public.profiles where group_id = 'EMBS-TEAM-01'
);

-- 2. Clear group assignments in profiles for students not in the demo group
update public.profiles 
set group_id = null, 
    is_lead = false
where group_id != 'EMBS-TEAM-01';

-- 3. Delete all groups except the demo group (cascade deletes reports, meetings, milestones)
delete from public.groups 
where id != 'EMBS-TEAM-01';
