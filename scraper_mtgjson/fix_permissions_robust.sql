-- Grant usage on public schema (often missed)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Tables
ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_cards ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Public Read Access" ON public.card_prices;
DROP POLICY IF EXISTS "Public Read Access" ON public.all_cards;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.card_prices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.all_cards;

-- Create generous read policies
CREATE POLICY "Public Read Access" ON public.card_prices FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.all_cards FOR SELECT USING (true);

-- Explicit Grants
GRANT SELECT ON public.card_prices TO anon, authenticated, service_role;
GRANT SELECT ON public.all_cards TO anon, authenticated, service_role;
GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;
GRANT SELECT ON public.my_tracked_cards_view TO anon, authenticated, service_role;
