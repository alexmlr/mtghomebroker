import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load from frontend .env which has ANON KEY

// Standard frontend key (Anon)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_KEY!; // Usually the anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    console.log("--- Debugging as ANON USER (Frontend Simulation) ---");

    // 1. Try to fetch from all_cards
    console.log("\n1. Querying 'all_cards' (direct)...");
    const { data: d1, error: e1 } = await supabase.from('all_cards').select('id, name').limit(1);
    if (e1) console.error("FAILED all_cards:", e1.message);
    else console.log("SUCCESS all_cards:", d1?.length ? "Found data" : "Empty array");

    // 2. Try to fetch from card_prices
    console.log("\n2. Querying 'card_prices' (direct)...");
    const { data: d2, error: e2 } = await supabase.from('card_prices').select('mtgjson_uuid').limit(1);
    if (e2) console.error("FAILED card_prices:", e2.message);
    else console.log("SUCCESS card_prices:", d2?.length ? "Found data" : "Empty array");

    // 3. Try to fetch from view all_cards_with_prices
    console.log("\n3. Querying 'all_cards_with_prices' (view)...");
    const { data: d3, error: e3 } = await supabase.from('all_cards_with_prices').select('id, name, ck_buylist_usd').limit(1);
    if (e3) console.error("FAILED all_cards_with_prices:", e3.message);
    else console.log("SUCCESS all_cards_with_prices:", d3?.length, "rows.", d3 ? d3[0] : "");
}

main();
