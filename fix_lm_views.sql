-- FIX VIEWS TO INCLUDE LIGAMAGIC PRICES

-- 1. Recreate View 1: all_cards_with_prices
DROP VIEW IF EXISTS public.my_tracked_cards_view;
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
    ac.liga_magic_url,
    -- ac.image_url removed as it doesn't exist in all_cards
    ac.is_foil,
    ac.lm_sell_brl, -- Expose the value stored in all_cards
    cp.ck_buylist_usd,
    cp.ck_buylist_credit,
    cp.updated_at AS price_updated_at
FROM all_cards ac
LEFT JOIN card_prices cp ON ac.mtgjson_uuid::text = cp.mtgjson_uuid::text
LEFT JOIN sets s ON LOWER(ac.set_code) = LOWER(s.code); 

GRANT SELECT ON public.all_cards_with_prices TO anon, authenticated, service_role;

-- 2. Recreate View 2: my_tracked_cards_view
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
    -- ac.image_url removed
    ac.ck_buylist_usd,
    ac.ck_buylist_credit,
    ac.lm_sell_brl, -- Properly select it here
    ac.price_updated_at as ck_last_update
FROM user_tracked_cards utc
JOIN all_cards_with_prices ac ON utc.card_id = ac.id;

GRANT SELECT ON public.my_tracked_cards_view TO anon, authenticated, service_role;
