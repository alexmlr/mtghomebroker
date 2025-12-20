import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Check count
    const { count, error } = await supabase
        .from('all_cards')
        .select('*', { count: 'exact', head: true });

    console.log(`Row count in 'all_cards': ${count}`);
    if (error) console.error(error);

    // Check columns
    const { data } = await supabase.from('all_cards').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns in all_cards:', Object.keys(data[0]).join(', '));
    }

    // Check count in 'cards'
    const { count: cardsCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true });
    console.log(`Row count in 'cards': ${cardsCount}`);
}

main();
