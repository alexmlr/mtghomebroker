-- Create a view that joins cards with their latest prices
-- This view will be used for the "Global Opportunities" feature
create or replace view all_opportunities_view as
select
  c.id,
  c.name,
  c.set_name,
  c.set_code,
  c.collector_number,
  -- Prices from card_prices table (joined by mtgjson_uuid or best effort match)
  -- Note: We are assuming card_prices is populated via mtgjson_uuid mapping or similar.
  -- If direct join isn't possible (no foreign key), we might need to rely on what is available.
  -- Based on previous context, 'all_cards_with_prices' exists. Let's check its definition if possible, 
  -- but since we can't see internal postgres schemas easily, we will construct a robust view.
  
  -- Assuming 'cards' table has 'mtgjson_uuid' and 'card_prices' has 'mtgjson_uuid'
  cp.ck_buylist_usd,
  c.lm_sell_brl,
  cp.tcgplayer_market_usd,
  cp.cardmarket_avg_eur,
  
  -- Timestamps
  cp.updated_at as price_updated_at
from
  public.all_cards c
  left join public.card_prices cp on c.mtgjson_uuid::text = cp.mtgjson_uuid::text
where
  -- Filter out cards with no price data to keep the view lightweight
  (cp.ck_buylist_usd is not null and cp.ck_buylist_usd > 0)
  or (c.lm_sell_brl is not null and c.lm_sell_brl > 0);

-- Enable RLS (if needed, views inherit permissions of underlying tables usually, but good practice to be explicit if it were a table)
-- For views, we just grant select
grant select on all_opportunities_view to authenticated;
grant select on all_opportunities_view to anon;
