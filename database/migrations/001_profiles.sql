-- Run this in Supabase SQL Editor AFTER schema.sql

create table if not exists profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  role  text not null default 'customer' check (role in ('broker', 'customer')),
  name  text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can only read their own profile
create policy "users read own profile"
  on profiles for select using (auth.uid() = id);

-- Service role can do everything (used server-side)
create policy "service role full access"
  on profiles for all using (true);

-- Auto-create a profile row when a new auth user is created
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, role, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
