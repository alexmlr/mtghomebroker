-- 0. Cleanup (Optional, to ensure clean state if you want to recreate table with UUID type, but here we just fix the join)
-- DROP TABLE IF EXISTS public.card_prices; 

-- 1. Create card_prices table
CREATE TABLE IF NOT EXISTS public.card_prices (
    mtgjson_uuid TEXT PRIMARY KEY,
    ck_buylist_usd NUMERIC,
    ck_buylist_credit NUMERIC,
    ck_buylist_foil_usd NUMERIC,
    ck_buylist_foil_credit NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_prices_uuid ON public.card_prices(mtgjson_uuid);

-- Grant permissions
GRANT ALL ON public.card_prices TO postgres;
GRANT ALL ON public.card_prices TO service_role;
GRANT SELECT ON public.card_prices TO anon;
GRANT SELECT ON public.card_prices TO authenticated;

-- 2. Add mtgjson_uuid column to cards table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'mtgjson_uuid') THEN 
        ALTER TABLE public.cards ADD COLUMN mtgjson_uuid TEXT;
        CREATE INDEX idx_cards_mtgjson_uuid ON public.cards(mtgjson_uuid);
    END IF;
END $$;

-- 3. Update Views to include new columns

-- Drop views first
DROP VIEW IF EXISTS public.my_tracked_cards_view;
DROP VIEW IF EXISTS public.my_tracked_sets_view;

-- Create my_tracked_cards_view with ck_last_update AND mtgjson prices
-- FIXED: Cast c.mtgjson_uuid to text to match cp.mtgjson_uuid if c.mtgjson_uuid is UUID type in DB.
create view public.my_tracked_cards_view as
select 
    c.id,
    c.name,
    c.set_name,
    c.set_code,
    c.collector_number_normalized,
    c.collector_number,
    c.imported_at,
    c.ck_buy_usd,
    c.lm_sell_brl,
    c.ck_last_update,
    c.mtgjson_uuid,
    cp.ck_buylist_usd,
    cp.ck_buylist_credit,
    tc.user_id,
    tc.created_at as tracked_at
from cards c
join user_tracked_cards tc on c.id = tc.card_id
left join card_prices cp on c.mtgjson_uuid::text = cp.mtgjson_uuid;

-- Create my_tracked_sets_view (optional to add prices here too, but focused on cards view)
create view public.my_tracked_sets_view as
select 
    c.id,
    c.name,
    c.set_name,
    c.set_code,
    c.collector_number_normalized,
    c.collector_number,
    c.imported_at,
    c.ck_buy_usd,
    c.lm_sell_brl,
    c.ck_last_update,
    ts.user_id,
    ts.created_at as tracked_at
from cards c
join user_tracked_sets ts on c.set_code = ts.set_code;

-- Re-grant permissions
GRANT SELECT ON public.my_tracked_cards_view TO authenticated;
GRANT SELECT ON public.my_tracked_cards_view TO service_role;
GRANT SELECT ON public.my_tracked_sets_view TO authenticated;
GRANT SELECT ON public.my_tracked_sets_view TO service_role;
