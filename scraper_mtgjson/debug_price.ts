import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Searching for price 6.40...");
    const { data: prices } = await supabase
        .from('card_prices')
        .select('*')
        .eq('ck_buylist_usd', 6.40);

    if (prices && prices.length > 0) {
        console.log(`Found ${prices.length} entries with $6.40:`);
        prices.forEach(p => console.log(`UUID: ${p.mtgjson_uuid}`));

        // Note: We can't easily know the name without a mapping file locally if DB doesn't have it.
        // But giving the UUID to the user allows them to check MTGJSON.
    } else {
        console.log("No entries found with exactly $6.40");
    }
}

main();
