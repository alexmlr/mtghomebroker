-- Drop view if exists to ensure clean slate
DROP VIEW IF EXISTS public.all_cards_with_prices;

-- Create View all_cards_with_prices
-- Join all_cards with card_prices AND sets to get canonical Set Name.
CREATE OR REPLACE VIEW public.all_cards_with_prices AS
SELECT 
    ac.id,
    ac.name,
    s.name as set_name, -- Canonical name from sets table
    ac.set_code,
    ac.collector_number,
    ac.collector_number_normalized AS collector_number_normalized,
    ac.mtgjson_uuid,
    cp.ck_buylist_usd,
    cp.ck_buylist_credit,
    cp.updated_at AS price_updated_at
FROM all_cards ac
LEFT JOIN card_prices cp ON ac.mtgjson_uuid::text = cp.mtgjson_uuid::text
LEFT JOIN sets s ON ac.set_code = s.code; -- Join for Set Name

GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;
