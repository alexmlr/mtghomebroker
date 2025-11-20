-- Create a table for system-wide settings
create table if not exists public.system_settings (
  key text not null primary key,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users
);

-- Enable RLS
alter table public.system_settings enable row level security;

-- Policies
create policy "Public settings are viewable by everyone"
  on system_settings for select
  using ( true );

create policy "Admins can update settings"
  on system_settings for update
  using ( 
    auth.uid() in (select id from public.profiles where role = 'admin') 
  );

create policy "Admins can insert settings"
  on system_settings for insert
  with check ( 
    auth.uid() in (select id from public.profiles where role = 'admin') 
  );

-- Insert default footer text if not exists
insert into public.system_settings (key, value)
values ('footer_text', '© 2025 Boost Homebroker. Todos os direitos reservados.')
on conflict (key) do nothing;
