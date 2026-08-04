-- ADD STATUS COLUMN TO MEETINGS TO SUPPORT SCHEDULED VS CONDUCTED/LOGGED MEETINGS
-- Run this in your Supabase SQL Editor.

alter table public.meetings 
add column if not exists status text not null default 'conducted' 
check (status in ('scheduled', 'conducted'));
