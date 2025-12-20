-- 1. FIX VIEW with Case-Insensitive Join
DROP VIEW IF EXISTS public.all_cards_with_prices;

CREATE OR REPLACE VIEW public.all_cards_with_prices AS
SELECT 
    ac.id,
    ac.name,
    s.name as set_name,
    ac.set_code,
    ac.collector_number,
    ac.collector_number_normalized AS collector_number_normalized,
    ac.mtgjson_uuid,
    cp.ck_buylist_usd,
    cp.ck_buylist_credit,
    cp.updated_at AS price_updated_at
FROM all_cards ac
LEFT JOIN card_prices cp ON ac.mtgjson_uuid::text = cp.mtgjson_uuid::text
LEFT JOIN sets s ON LOWER(ac.set_code) = LOWER(s.code); -- Case Insensitive Join

GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;


-- 2. FIX TRACKING RLS
-- Enable RLS
ALTER TABLE public.user_tracked_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tracked_sets ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid duplicates
DROP POLICY IF EXISTS "Users can manage their own tracked cards" ON public.user_tracked_cards;
DROP POLICY IF EXISTS "Users can manage their own tracked sets" ON public.user_tracked_sets;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_tracked_cards;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_tracked_sets;

-- Create Policies
-- Allow users to SELECT, INSERT, DELETE rows where user_id matches their own
CREATE POLICY "Users can manage their own tracked cards"
ON public.user_tracked_cards
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tracked sets"
ON public.user_tracked_sets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT ALL ON public.user_tracked_cards TO authenticated;
GRANT ALL ON public.user_tracked_sets TO authenticated;
GRANT SELECT ON public.user_tracked_cards TO anon; -- Fallback if needed, though RLS protects
GRANT SELECT ON public.user_tracked_sets TO anon;
