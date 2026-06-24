-- Create profiles table linked to Supabase auth.users
create table if not exists profiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'customer' check (role in ('customer', 'broker', 'admin', 'manager')),
  name    text,
  email   text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Service role can do everything
drop policy if exists "service role full access" on profiles;
create policy "service role full access"
  on profiles for all
  using (true);

-- Auto-create a profile row when a new auth user is created
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Backfill existing auth users who don't have a profile yet
insert into profiles (id, role, name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'customer'),
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;
