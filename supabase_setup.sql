-- 1. Create a table for public profiles
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'subscriber' check (role in ('admin', 'subscriber')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. Create policies for Profiles
-- Drop existing policies to avoid errors on re-run
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update any profile" on profiles;
drop policy if exists "Admins can delete any profile" on profiles;

create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

create policy "Admins can update any profile"
  on profiles for update
  using ( 
    auth.uid() in (select id from public.profiles where role = 'admin') 
  );
  
create policy "Admins can delete any profile"
  on profiles for delete
  using ( 
    auth.uid() in (select id from public.profiles where role = 'admin') 
  );

-- 4. Create a trigger to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name, avatar_url)
  values (
    new.id, 
    new.email, 
    'subscriber', -- Default role
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Drop trigger if exists to avoid error
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Storage Bucket Setup (Run this in SQL Editor)

-- A) Branding Bucket (for System Logo)
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Drop policies for branding
drop policy if exists "Public Access Branding" on storage.objects;
drop policy if exists "Authenticated users can upload Branding" on storage.objects;
drop policy if exists "Admins can upload Branding" on storage.objects;
drop policy if exists "Admins can update Branding" on storage.objects;
drop policy if exists "Admins can delete Branding" on storage.objects;

create policy "Public Access Branding"
  on storage.objects for select
  using ( bucket_id = 'branding' );

create policy "Admins can upload Branding"
  on storage.objects for insert
  with check ( 
    bucket_id = 'branding' AND 
    auth.uid() in (select id from public.profiles where role = 'admin')
  );

create policy "Admins can update Branding"
  on storage.objects for update
  using ( 
    bucket_id = 'branding' AND 
    auth.uid() in (select id from public.profiles where role = 'admin')
  );

create policy "Admins can delete Branding"
  on storage.objects for delete
  using ( 
    bucket_id = 'branding' AND 
    auth.uid() in (select id from public.profiles where role = 'admin')
  );

-- B) Profile Pictures Bucket (for User Avatars)
insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Drop policies for profile-pictures
drop policy if exists "Public Access Profile Pictures" on storage.objects;
drop policy if exists "Authenticated users can upload Profile Pictures" on storage.objects;
drop policy if exists "Users can update own Profile Pictures" on storage.objects;

create policy "Public Access Profile Pictures"
  on storage.objects for select
  using ( bucket_id = 'profile-pictures' );

create policy "Authenticated users can upload Profile Pictures"
  on storage.objects for insert
  with check ( bucket_id = 'profile-pictures' and auth.role() = 'authenticated' );

create policy "Users can update own Profile Pictures"
  on storage.objects for update
  using ( bucket_id = 'profile-pictures' and auth.uid() = owner );
