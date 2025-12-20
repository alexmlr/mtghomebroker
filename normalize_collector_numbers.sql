-- Normalize collector_number by removing leading zeros
-- e.g., '0243' -> '243'
UPDATE public.cards
SET collector_number = LTRIM(collector_number, '0')
WHERE collector_number LIKE '0%';

-- Ensure collector_number is '0' if it's strictly '000' or similar
UPDATE public.cards
SET collector_number = '0'
WHERE collector_number = '';
