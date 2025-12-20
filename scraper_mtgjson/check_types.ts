import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking types...");
    // We can't easily check PG types via Supabase JS select.
    // We can interpret from error or try cast.

    // 1. Check if 'cards' has mtgjson_uuid
    const { data: c } = await supabase.from('cards').select('mtgjson_uuid').limit(1);
    console.log('cards row:', c);

    // 2. Check card_prices
    const { data: cp } = await supabase.from('card_prices').select('mtgjson_uuid').limit(1);
    console.log('card_prices row:', cp);
}

main();
