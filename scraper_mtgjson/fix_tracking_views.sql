-- 1. RECREATE my_tracked_cards_view to ensure it exists and matches current schema
DROP VIEW IF EXISTS public.my_tracked_cards_view;

CREATE OR REPLACE VIEW public.my_tracked_cards_view AS
SELECT 
    utc.user_id,
    utc.card_id AS id, -- Flatten ID for easier frontend consumption
    ac.name,
    ac.set_name,
    ac.set_code,
    ac.collector_number,
    ac.collector_number_normalized,
    ac.liga_magic_url, -- Make sure this is pulled
    ac.ck_buylist_usd,
    ac.ck_buylist_credit,
    ac.lm_sell_brl,
    ac.updated_at AS ck_last_update, -- or price_updated_at from join
    cp.updated_at AS price_updated_at,
    utc.created_at AS tracked_at
FROM user_tracked_cards utc
JOIN all_cards_with_prices ac ON utc.card_id = ac.id
LEFT JOIN card_prices cp ON ac.mtgjson_uuid::text = cp.mtgjson_uuid::text; 
-- Note: all_cards_with_prices ALREADY joins card_prices, so 'ac' has the price columns.
-- Let's simplify and just join user_tracked_cards with all_cards_with_prices.

CREATE OR REPLACE VIEW public.my_tracked_cards_view AS
SELECT 
    utc.user_id,
    utc.created_at AS tracked_at,
    ac.* 
FROM user_tracked_cards utc
JOIN all_cards_with_prices ac ON utc.card_id = ac.id;

-- Grant permissions
GRANT SELECT ON public.my_tracked_cards_view TO anon, authenticated, service_role;

-- 2. RECREATE my_tracked_sets_view just in case
DROP VIEW IF EXISTS public.my_tracked_sets_view;

CREATE OR REPLACE VIEW public.my_tracked_sets_view AS
SELECT 
    uts.user_id,
    uts.created_at AS tracked_at,
    s.code AS set_code,
    s.name AS set_name,
    s.release_date
FROM user_tracked_sets uts
JOIN sets s ON LOWER(uts.set_code) = LOWER(s.code);

GRANT SELECT ON public.my_tracked_sets_view TO anon, authenticated, service_role;
