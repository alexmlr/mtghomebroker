-- Grants basic permissions to the 'all_cards' table for the 'authenticated' and 'anon' roles
-- This fixes "Could not find the table" errors for all_cards

GRANT ALL ON public.all_cards TO postgres;
GRANT ALL ON public.all_cards TO service_role;

-- Allow read access to everyone
GRANT SELECT ON public.all_cards TO anon;
GRANT SELECT ON public.all_cards TO authenticated;

-- Allow update/insert to authenticated users (so they can link cards)
GRANT UPDATE, INSERT ON public.all_cards TO authenticated;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
