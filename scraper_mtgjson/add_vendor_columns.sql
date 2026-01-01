ALTER TABLE public.card_prices 
ADD COLUMN IF NOT EXISTS tcgplayer_market_usd NUMERIC,
ADD COLUMN IF NOT EXISTS cardmarket_avg_eur NUMERIC,
ADD COLUMN IF NOT EXISTS mtgo_cardhoarder_tix NUMERIC;
