-- Add meeting link support to meetings table
-- Run this in your Supabase SQL Editor.

alter table public.meetings add column if not exists meeting_link text;
