import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Starting UUID population...');

    // 1. Get All Sets from MTGJSON SetList (to ensure we cover everything without pagination issues)
    console.log("Fetching SetList from MTGJSON...");
    const setListRes = await axios.get('https://mtgjson.com/api/v5/SetList.json');
    const allSets = setListRes.data.data; // Array of { code, name, ... }

    // Check which sets exist in DB (optimization) -> actually hard to check 100k rows efficiently.
    // Better: Iterate all sets from MTGJSON. For each, check if we have cards.
    // 500 sets is not too many.

    console.log(`Found ${allSets.length} sets in MTGJSON.`);

    for (const setInfo of allSets) {
        const setCode = setInfo.code;
        if (!setCode) continue;
        // console.log(`Processing set: ${setCode}...`); -- too verbose


        try {
            // Fetch Set JSON
            const url = `https://mtgjson.com/api/v5/${setCode.toUpperCase()}.json`;
            const res = await axios.get(url, { validateStatus: () => true }); // Allow 404

            if (res.status === 404) {
                console.warn(`Set file not found for ${setCode}`);
                continue;
            }

            const cardsData = res.data.data.cards;
            if (!cardsData) continue;

            const updates: any[] = [];

            // Map JSON cards by collector number
            const jsonMap = new Map(); // Key: collector_number
            cardsData.forEach((c: any) => {
                jsonMap.set(c.number, c.uuid);
            });

            // Fetch DB cards for this set
            const { data: dbCards, error: dbError } = await supabase
                .from('all_cards')
                .select('id, collector_number, collector_number_normalized, mtgjson_uuid')
                .ilike('set_code', setCode); // Use ilike for case-independence

            if (!dbCards) continue;

            for (const card of dbCards) {
                // Try match by raw number first, then normalized
                let uuid = jsonMap.get(card.collector_number);

                // Fallback: try normalized if raw failed
                if (!uuid && card.collector_number_normalized) {
                    uuid = jsonMap.get(card.collector_number_normalized);
                }

                if (uuid && card.mtgjson_uuid !== uuid) {
                    updates.push({
                        id: card.id,
                        mtgjson_uuid: uuid
                    });
                }
            }

            if (updates.length > 0) {
                console.log(`Updating ${updates.length} cards in set ${setCode}...`);

                // Batching:
                for (let i = 0; i < updates.length; i += 50) {
                    const batch = updates.slice(i, i + 50);
                    await Promise.all(batch.map(u =>
                        supabase.from('all_cards').update({ mtgjson_uuid: u.mtgjson_uuid }).eq('id', u.id)
                    ));
                }
                console.log(`Updated set ${setCode}.`);
            } else {
                console.log(`No updates needed for set ${setCode}.`);
            }

        } catch (err) {
            console.error(`Error processing set ${setCode}:`, err);
        }
    }
    console.log('UUID population done.');
}

main();
