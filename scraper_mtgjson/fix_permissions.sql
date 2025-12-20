-- Enable RLS on tables (good practice, ensures policies apply)
ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON public.card_prices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.all_cards;

-- Create policies allowing SELECT for everyone (anon and authenticated)
CREATE POLICY "Enable read access for all users" ON public.card_prices
    FOR SELECT
    USING (true);

CREATE POLICY "Enable read access for all users" ON public.all_cards
    FOR SELECT
    USING (true);

-- Ensure views have permissions (though Views usually run as owner, strict security might require underlying access)
GRANT SELECT ON public.card_prices TO anon, authenticated, service_role;
GRANT SELECT ON public.all_cards TO anon, authenticated, service_role;
GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;
