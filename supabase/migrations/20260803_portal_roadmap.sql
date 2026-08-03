-- Portal roadmap schema: run once in Supabase SQL Editor.
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists organisation text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists interests text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists mentor_capacity integer not null default 4;
alter table public.reports add column if not exists due_date timestamptz;
alter table public.reports add column if not exists version integer not null default 1;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null, content text not null,
  audience text not null default 'all' check (audience in ('all','student','mentor')),
  deadline_at timestamptz, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(), group_id text not null references public.groups(id) on delete cascade,
  title text not null, description text, due_date timestamptz, status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','approved')), updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(), group_id text not null references public.groups(id) on delete cascade,
  mentor_id uuid references public.profiles(id), held_at timestamptz not null default now(), notes text, next_actions text, attendance text, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, content text, link text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(), group_id text not null references public.groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid references public.profiles(id), issued_at timestamptz not null default now(), certificate_code text unique not null default ('EMBS-' || upper(substr(md5(random()::text), 1, 10))), unique(group_id, student_id)
);
create index if not exists announcements_created_at_idx on public.announcements(created_at desc);
create index if not exists milestones_group_idx on public.milestones(group_id);
create index if not exists meetings_group_idx on public.meetings(group_id, held_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- Enable RLS once all existing rows use Auth user UUIDs in profiles.id.
alter table public.announcements enable row level security;
alter table public.milestones enable row level security;
alter table public.meetings enable row level security;
alter table public.notifications enable row level security;
alter table public.certificates enable row level security;

create or replace function public.current_role() returns text language sql stable security definer set search_path = public as $$ select role::text from public.profiles where id = auth.uid() $$;
create policy "announcements visible to audience" on public.announcements for select to authenticated using (audience = 'all' or audience = public.current_role());
create policy "admins manage announcements" on public.announcements for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "group participants see milestones" on public.milestones for select to authenticated using (public.current_role() = 'admin' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.group_id = milestones.group_id) or exists (select 1 from public.groups g where g.id = milestones.group_id and g.mentor_id = auth.uid()));
create policy "admins and mentors update milestones" on public.milestones for all to authenticated using (public.current_role() = 'admin' or exists (select 1 from public.groups g where g.id = milestones.group_id and g.mentor_id = auth.uid())) with check (public.current_role() = 'admin' or exists (select 1 from public.groups g where g.id = milestones.group_id and g.mentor_id = auth.uid()));
create policy "group participants see meetings" on public.meetings for select to authenticated using (public.current_role() = 'admin' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.group_id = meetings.group_id) or mentor_id = auth.uid());
create policy "mentors create meetings" on public.meetings for insert to authenticated with check (public.current_role() = 'admin' or mentor_id = auth.uid());
create policy "users see their notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users mark notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users see own certificates" on public.certificates for select to authenticated using (student_id = auth.uid() or public.current_role() = 'admin');
create policy "admins issue certificates" on public.certificates for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');