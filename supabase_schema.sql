-- WebAR Election Campaign Database Schema

-- 1. Users table to track scan allowance and authentication
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  scans integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Pledges table for recording voter pledge actions
create table if not exists public.pledges (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security (RLS) setup
alter table public.users enable row level security;
alter table public.pledges enable row level security;

-- Allow anon read/write for demo campaign endpoints (or customize as needed)
create policy "Allow anon insert/update users" on public.users
  for all using (true) with check (true);

create policy "Allow anon insert pledges" on public.pledges
  for insert with check (true);

create policy "Allow anon select pledges" on public.pledges
  for select using (true);
