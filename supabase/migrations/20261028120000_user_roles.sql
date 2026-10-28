-- Roles table used by src/lib/admin.ts (isAdmin, listUsers, setAdmin, getDemoSignIn).
-- Only the server (service role) reads and writes it, so RLS is on with no policies.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- First admin (replace with Daniel's email), then reload the PostgREST schema cache.
-- insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'daniel@appbuilder.ai';

notify pgrst, 'reload schema';
