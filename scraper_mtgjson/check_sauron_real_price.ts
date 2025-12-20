import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching LTR.json from MTGJSON...");
    const res = await axios.get('https://mtgjson.com/api/v5/LTR.json');
    const cards = res.data.data.cards;

    const saurons = cards.filter((c: any) => c.name === 'Sauron, the Dark Lord');
    console.log(`Found ${saurons.length} Sauron entries in LTR set.`);

    for (const s of saurons) {
        console.log(`\nName: ${s.name} | Number: ${s.number} | UUID: ${s.uuid}`);
        console.log(`Finishes: ${s.finishes.join(', ')}`);

        // Check price in DB
        const { data: price } = await supabase
            .from('card_prices')
            .select('*')
            .eq('mtgjson_uuid', s.uuid)
            .maybeSingle();

        if (price) {
            console.log(`DB Price -> USD: ${price.ck_buylist_usd} | Credit: ${price.ck_buylist_credit}`);
        } else {
            console.log(`DB Price -> Not In Table`);
        }
    }
}

main();
