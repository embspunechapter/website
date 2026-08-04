-- ADD IS_LEAD COLUMN TO PROFILES FOR GROUP TEAM LEAD RESTRICTIONS
-- Run this in your Supabase SQL Editor.

alter table public.profiles 
add column if not exists is_lead boolean not null default false;
