import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Check distinct sets in 'cards' (to see if it's the universe)
    const { count: totalSets, error: errorSets } = await supabase
        .from('cards')
        .select('set_code', { count: 'exact', head: true });
    // This just counts rows. I need distinct sets.
    // Supabase JS doesn't do distinct count easily.

    const { data: sets } = await supabase
        .from('cards')
        .select('set_name');
    //.distinct(); // JS client doesn't have distinct(). creating a set in JS.

    if (sets) {
        const uniqueSets = new Set(sets.map(s => s.set_name));
        console.log(`Unique sets in 'cards' table: ${uniqueSets.size}`);
        if (uniqueSets.size > 0) {
            console.log("Sample sets:", [...uniqueSets].slice(0, 5));
        }
    }

    // 2. Check my_tracked_cards_view for prices
    const { data: viewData, error: viewError } = await supabase
        .from('my_tracked_cards_view')
        .select('name, ck_buylist_usd, ck_buylist_credit, ck_buy_usd')
        .limit(5);

    if (viewError) {
        console.error('View Error:', viewError);
    } else {
        console.log('View Sample Data:');
        console.table(viewData);
    }
}

main();
