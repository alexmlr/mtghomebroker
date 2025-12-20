import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Syncing tracked cards (cards table) with UUIDs from all_cards...");

    // Fetch all tracked cards
    const { data: trackedCards } = await supabase.from('cards').select('id, set_code, collector_number');

    if (!trackedCards || trackedCards.length === 0) {
        console.log("No tracked cards found.");
        return;
    }

    let updatedCount = 0;
    for (const card of trackedCards) {
        // Find match in all_cards
        const { data: match } = await supabase
            .from('all_cards')
            .select('mtgjson_uuid')
            .eq('set_code', card.set_code)
            .eq('collector_number', card.collector_number)
            .maybeSingle(); // Assumes exact match on collector_number

        if (match && match.mtgjson_uuid) {
            const { error } = await supabase
                .from('cards')
                .update({ mtgjson_uuid: match.mtgjson_uuid })
                .eq('id', card.id);

            if (!error) updatedCount++;
        }
    }

    console.log(`Synced ${updatedCount} tracked cards.`);
}

main();
