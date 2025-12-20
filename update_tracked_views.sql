-- Drop views first to avoid conflict with existing structure
DROP VIEW IF EXISTS public.my_tracked_cards_view;
DROP VIEW IF EXISTS public.my_tracked_sets_view;

-- Create my_tracked_cards_view with ck_last_update
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
    tc.user_id,
    tc.created_at as tracked_at
from cards c
join user_tracked_cards tc on c.id = tc.card_id;

-- Create my_tracked_sets_view with ck_last_update
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

-- Re-grant permissions (important for RLS/security)
GRANT SELECT ON public.my_tracked_cards_view TO authenticated;
GRANT SELECT ON public.my_tracked_cards_view TO service_role;
GRANT SELECT ON public.my_tracked_sets_view TO authenticated;
GRANT SELECT ON public.my_tracked_sets_view TO service_role;
