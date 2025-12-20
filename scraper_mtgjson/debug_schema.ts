
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking Schema Types...");
    // We can't query information_schema directly via JS client easily unless we have a wrapper function or direct SQL access.
    // But we can insert a dummy logical check or just try to fetch types via a custom RPC? 
    // Actually, the JS client usually doesn't expose types.
    // Let's rely on `rpc` or just `mock insert` to see errors?
    // Better: Run a raw SQL via the JS client if possible? No, 'rpc' is the only way for raw SQL usually designated.

    // Instead, I will assume the user has not set up a 'exec_sql' RPC.
    // I will try to inspect the definition by trying to insert a string into card_id and seeing the error.

    try {
        // Try to select ONE item from user_tracked_cards
        const { data, error } = await supabase.from('user_tracked_cards').select('card_id').limit(1);
        if (error) {
            console.error("Error selecting from user_tracked_cards:", error);
        } else {
            console.log("user_tracked_cards sample:", data);
            if (data && data.length > 0) {
                console.log("Type of card_id:", typeof data[0].card_id);
            }
        }

        // Try to select ONE item from all_cards
        const { data: cards, error: cardError } = await supabase.from('all_cards').select('id').limit(1);
        if (cardError) {
            console.error("Error selecting from all_cards:", cardError);
        } else {
            console.log("all_cards sample:", cards);
            if (cards && cards.length > 0) {
                console.log("Type of id:", typeof cards[0].id);
            }
        }

    } catch (e) {
        console.error("Exception:", e);
    }
}

checkSchema();
