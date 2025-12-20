CREATE TABLE IF NOT EXISTS public.card_prices (
    mtgjson_uuid TEXT PRIMARY KEY,
    ck_buylist_usd NUMERIC,
    ck_buylist_credit NUMERIC,
    ck_buylist_foil_usd NUMERIC,
    ck_buylist_foil_credit NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups (though PK handles uuid, good for joins if we use other columns later)
CREATE INDEX IF NOT EXISTS idx_card_prices_uuid ON public.card_prices(mtgjson_uuid);

-- Grant permissions if necessary (adjust based on role requirements)
GRANT ALL ON public.card_prices TO postgres;
GRANT ALL ON public.card_prices TO service_role;
GRANT SELECT ON public.card_prices TO anon;
GRANT SELECT ON public.card_prices TO authenticated;
