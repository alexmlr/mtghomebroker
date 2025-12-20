import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("--- Debugging Views ---");

    // 1. Check my_tracked_cards_view
    console.log("\n1. Querying 'my_tracked_cards_view'...");
    const { data: data1, error: err1 } = await supabase
        .from('my_tracked_cards_view')
        .select('id, name, set_name, ck_buylist_usd, ck_buylist_credit')
        .limit(1);

    if (err1) {
        console.error("ERROR querying my_tracked_cards_view:", err1.message);
    } else {
        console.log("Success! Row sample:", data1);
    }

    // 2. Check all_cards_with_prices
    console.log("\n2. Querying 'all_cards_with_prices'...");
    const { data: data2, error: err2 } = await supabase
        .from('all_cards_with_prices')
        .select('id, name, set_name, ck_buylist_usd')
        .limit(1);

    if (err2) {
        console.error("ERROR querying all_cards_with_prices:", err2.message);
    } else {
        console.log("Success! Row sample:", data2);
    }

    // 3. Test SetList logic behavior (optional, just ensuring api access isn't the issue via logic)
    // we can't test browser fetch here easily, but we can assume if node fetch works...
}

main();
