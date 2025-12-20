-- 1. Create 'sets' table
CREATE TABLE IF NOT EXISTS public.sets (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    release_date DATE,
    card_count INTEGER,
    parent_set_code TEXT,
    block TEXT,
    icon_svg_uri TEXT
);

-- Index for searching sets by name
CREATE INDEX IF NOT EXISTS idx_sets_name ON public.sets(name);

-- 2. Add 'liga_magic_url' to 'cards' table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'liga_magic_url') THEN 
        ALTER TABLE public.cards ADD COLUMN liga_magic_url TEXT;
    END IF;
END $$;

-- 3. Grant permissions (just in case, though RLS was disabled by user)
GRANT ALL ON public.sets TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sets TO anon, authenticated;
