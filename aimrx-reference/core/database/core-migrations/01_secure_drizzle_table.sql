-- Secure the __drizzle_migrations__ table with RLS
-- This ensures only service role (terminal/CLI) can access migration history

-- Revoke all permissions from public roles
revoke all on table public.__drizzle_migrations__ from authenticated, anon;

-- Enable RLS on the migrations table
alter table public.__drizzle_migrations__ enable row level security;

-- Create a policy that denies all access
-- Since we're not creating any "allow" policies, and RLS is enabled,
-- only service role (which bypasses RLS) can access this table
create policy "No public access to migrations table" 
  on public.__drizzle_migrations__
  for all
  using (false);

comment on table public.__drizzle_migrations__ is 'Drizzle migration history - accessible only via service role';