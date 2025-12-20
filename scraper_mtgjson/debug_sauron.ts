import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Get all Saurons from DB
    const { data: cards, error } = await supabase
        .from('cards')
        .select('id, name, set_name, set_code, collector_number, mtgjson_uuid')
        .eq('name', 'Sauron, the Dark Lord');

    if (error) {
        console.error('Error fetching cards:', error);
        return;
    }

    console.log(`Found ${cards.length} versions of Sauron, the Dark Lord in DB:`);
    const uuids = cards.map(c => c.mtgjson_uuid).filter(u => u);

    // 2. Get prices from card_prices
    const { data: prices } = await supabase
        .from('card_prices')
        .select('*')
        .in('mtgjson_uuid', uuids);

    const priceMap = new Map(prices?.map(p => [p.mtgjson_uuid, p]));

    for (const card of cards) {
        const p = priceMap.get(card.mtgjson_uuid);
        console.log(`\nCard ID: ${card.id} | Set: ${card.set_name} (${card.set_code}) #${card.collector_number}`);
        console.log(`UUID: ${card.mtgjson_uuid}`);
        if (p) {
            console.log(`DB Price -> USD: ${p.ck_buylist_usd} | Credit: ${p.ck_buylist_credit}`);
        } else {
            console.log(`DB Price -> Not Found`);
        }
    }

    // 3. Fetch specific JSON for one relevant UUID to verify Source
    // We'll pick the first one or LTR main set one
    const ltrCard = cards.find(c => c.set_code === 'LTR' && !c.collector_number.includes('s')); // naive filtering
    const checkUuid = ltrCard?.mtgjson_uuid || uuids[0];

    if (checkUuid) {
        console.log(`\nChecking detailed MTGJSON data for UUID: ${checkUuid}...`);
        try {
            const url = `https://mtgjson.com/api/v5/AllPricesToday.json`;
            // Fetching whole file again is heavy but reliable for debug?
            // Or use their Card endpoint? Card endpoint doesn't usually have todays prices?
            // Let's use the file logic again but just find this UUID.
            const response = await axios.get(url);
            const data = response.data.data; // data[uuid]
            const entry = data[checkUuid];

            if (entry) {
                console.log('MTGJSON Entry found:');
                console.log(JSON.stringify(entry?.paper?.cardkingdom?.buylist, null, 2));
            } else {
                console.log('UUID not found in AllPricesToday.json');
            }

        } catch (e) {
            console.error(e);
        }
    }
}

main();
