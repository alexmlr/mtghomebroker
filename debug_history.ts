
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("Fetching sample history...");

    // Fetch 5 recent history entries for CardKingdom
    const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('source', 'CardKingdom')
        .order('scraped_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found:", data?.length, "entries");
    data?.forEach(d => {
        console.log(`[${d.scraped_at}] ID:${d.card_id} Source:${d.source} Cur:${d.currency} Raw:${d.price_raw} BRL:${d.price_brl}`);
    });
}

debug();
