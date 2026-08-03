-- Provision Demo Accounts inside Supabase Auth & Profiles tables
-- Run this script once in your Supabase SQL Editor.

-- 1. Insert into auth.users (using standard crypt hash for password hashing)
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
  role, aud, confirmation_token
)
values
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a89', 
    '00000000-0000-0000-0000-000000000000', 
    'admin@embs.org', 
    crypt('admin123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    ''
  ),
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a90', 
    '00000000-0000-0000-0000-000000000000', 
    'mentor@embs.org', 
    crypt('mentor123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    ''
  ),
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a91', 
    '00000000-0000-0000-0000-000000000000', 
    'student@embs.org', 
    crypt('student123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    ''
  )
on conflict (id) do nothing;

-- 2. Insert into public.profiles
insert into public.profiles (
  id, full_name, email, role, domain, phone, organisation, bio, interests
)
values
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a89', 
    'Demo Coordinator', 
    'admin@embs.org', 
    'admin', 
    'Coordination', 
    '+91 99999 88888', 
    'IEEE EMBS Pune Chapter', 
    'Head Internship Program Coordinator.', 
    'Project Management'
  ),
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a90', 
    'Demo Mentor', 
    'mentor@embs.org', 
    'mentor', 
    'Bioinformatics', 
    '+91 77777 66666', 
    'IEEE Pune Research Labs', 
    'Guide for Bioengineering and Bioinformatics projects.', 
    'Bioinformatics, Machine Learning, Python'
  ),
  (
    'd3b07384-d113-4ec2-a5d5-86bbf5103a91', 
    'Demo Student', 
    'student@embs.org', 
    'student', 
    'Bioinformatics', 
    '+91 55555 44444', 
    'Pune Engineering College', 
    'Undergraduate researcher in Bioinformatics.', 
    'Bioinformatics, Data Analysis'
  )
on conflict (id) do nothing;

-- 3. Create a test group
insert into public.groups (id, domain, mentor_id)
values ('EMBS-TEAM-01', 'Bioinformatics', 'd3b07384-d113-4ec2-a5d5-86bbf5103a90')
on conflict (id) do nothing;

-- 4. Associate student with the test group
update public.profiles
set group_id = 'EMBS-TEAM-01'
where id = 'd3b07384-d113-4ec2-a5d5-86bbf5103a91';
