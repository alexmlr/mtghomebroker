-- Add mtgjson_uuid to all_cards
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'all_cards' AND column_name = 'mtgjson_uuid') THEN 
        ALTER TABLE public.all_cards ADD COLUMN mtgjson_uuid TEXT;
        CREATE INDEX idx_all_cards_mtgjson_uuid ON public.all_cards(mtgjson_uuid);
        CREATE INDEX idx_all_cards_set_code ON public.all_cards(set_code); -- Ensure set_code is indexed for filtering
    END IF;
END $$;
