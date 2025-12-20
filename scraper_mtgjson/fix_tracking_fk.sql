-- FIX FOREIGN KEY CONSTRAINT
-- The 'user_tracked_cards' table is pointing to the old 'cards' table.
-- We need to repoint it to 'all_cards'.

-- 1. Drop the old constraint
ALTER TABLE public.user_tracked_cards
DROP CONSTRAINT IF EXISTS user_tracked_cards_card_id_fkey;

-- 2. Add the new constraint pointing to 'all_cards'
ALTER TABLE public.user_tracked_cards
ADD CONSTRAINT user_tracked_cards_card_id_fkey
FOREIGN KEY (card_id)
REFERENCES public.all_cards (id)
ON DELETE CASCADE;

-- 3. Verify 'user_tracked_sets' just in case (though it likely points to sets table or is standalone)
-- If it points to something else, we might need to check. Assuming it points to sets(code).
-- Let's check constraints on sets if needed, but the error was specific to cards.

-- 4. Ensure RLS is still good (redundant but safe)
ALTER TABLE public.user_tracked_cards ENABLE ROW LEVEL SECURITY;
