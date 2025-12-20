import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking 'cards' table columns...");
    const { data: cardsCols, error: err1 } = await supabase
        .from('cards')
        .select('*')
        .limit(1);

    if (cardsCols && cardsCols.length > 0) {
        console.log("Cards columns:", Object.keys(cardsCols[0]).join(', '));
    } else {
        console.log("Cards table empty or error:", err1);
    }

    console.log("\nChecking 'all_cards' table columns...");
    const { data: allCardsCols, error: err2 } = await supabase
        .from('all_cards')
        .select('*')
        .limit(1);

    if (allCardsCols && allCardsCols.length > 0) {
        console.log("All_cards columns:", Object.keys(allCardsCols[0]).join(', '));
    } else {
        console.log("All_cards table empty or error:", err2);
    }
}

main();
