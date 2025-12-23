-- Add theme column to profiles table
alter table public.profiles 
add column if not exists theme text default 'dark';

-- Update existing profiles to default 'dark' if null (though default handles new ones)
update public.profiles set theme = 'dark' where theme is null;
