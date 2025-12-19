-- Add ck_buy_credit column to public.cards table
ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS ck_buy_credit numeric;
