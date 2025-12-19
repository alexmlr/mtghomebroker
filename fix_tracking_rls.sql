-- Enable RLS on tracking tables
alter table public.user_tracked_cards enable row level security;
alter table public.user_tracked_sets enable row level security;

-- Policies for user_tracked_cards
create policy "Users can view own tracked cards" 
on public.user_tracked_cards 
for select 
using (auth.uid() = user_id);

create policy "Users can insert own tracked cards" 
on public.user_tracked_cards 
for insert 
with check (auth.uid() = user_id);

create policy "Users can delete own tracked cards" 
on public.user_tracked_cards 
for delete 
using (auth.uid() = user_id);

-- Policies for user_tracked_sets
create policy "Users can view own tracked sets" 
on public.user_tracked_sets 
for select 
using (auth.uid() = user_id);

create policy "Users can insert own tracked sets" 
on public.user_tracked_sets 
for insert 
with check (auth.uid() = user_id);

create policy "Users can delete own tracked sets" 
on public.user_tracked_sets 
for delete 
using (auth.uid() = user_id);
