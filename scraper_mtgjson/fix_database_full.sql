-- MASTER FIX SCRIPT
-- Run this to resolve all View and Column issues

-- 1. Ensure Column Exists in Base Table
ALTER TABLE public.all_cards 
ADD COLUMN IF NOT EXISTS liga_magic_url TEXT;

-- 2. Recreate View 1: all_cards_with_prices
-- Adds liga_magic_url and uses Case-Insensitive Join for Sets
DROP VIEW IF EXISTS public.my_tracked_cards_view; -- Drop dependent first
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
    ac.liga_magic_url, -- ADDED THIS
    cp.ck_buylist_usd,
    cp.ck_buylist_credit,
    cp.updated_at AS price_updated_at
FROM all_cards ac
LEFT JOIN card_prices cp ON ac.mtgjson_uuid::text = cp.mtgjson_uuid::text
LEFT JOIN sets s ON LOWER(ac.set_code) = LOWER(s.code); 

GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;

-- 3. Recreate View 2: my_tracked_cards_view
-- Now valid because 'all_cards_with_prices' has 'liga_magic_url'
CREATE OR REPLACE VIEW public.my_tracked_cards_view AS
SELECT 
    utc.user_id,
    utc.created_at AS tracked_at,
    ac.id,
    ac.name,
    ac.set_name,
    ac.set_code,
    ac.collector_number,
    ac.collector_number_normalized,
    ac.liga_magic_url,
    ac.ck_buylist_usd,
    ac.ck_buylist_credit,
    0 as lm_sell_brl, -- Placeholder if no LM price yet, or join separate table if exists
    ac.price_updated_at as ck_last_update
FROM user_tracked_cards utc
JOIN all_cards_with_prices ac ON utc.card_id = ac.id;

GRANT SELECT ON public.my_tracked_cards_view TO anon, authenticated, service_role;

-- 4. RLS Policies
ALTER TABLE public.user_tracked_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tracked_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tracked cards" ON public.user_tracked_cards;
DROP POLICY IF EXISTS "Users can manage their own tracked sets" ON public.user_tracked_sets;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_tracked_cards;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_tracked_sets;

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

GRANT ALL ON public.user_tracked_cards TO authenticated;
GRANT ALL ON public.user_tracked_sets TO authenticated;
GRANT SELECT ON public.user_tracked_cards TO anon;
GRANT SELECT ON public.user_tracked_sets TO anon;
