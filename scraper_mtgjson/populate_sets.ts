import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching SetList from MTGJSON...");
    try {
        const response = await axios.get('https://mtgjson.com/api/v5/SetList.json');
        const setsData = response.data.data;

        if (!setsData || setsData.length === 0) {
            console.error("No data found from MTGJSON.");
            return;
        }

        console.log(`Found ${setsData.length} sets. Preparing to insert...`);

        // Map to DB schema
        const timestamp = new Date().toISOString();
        const records = setsData.map((s: any) => ({
            code: s.code,
            name: s.name,
            release_date: s.releaseDate,
            card_count: s.totalSetSize,
            parent_set_code: s.parentCode || null,
            block: s.block || null
        }));

        // Batch insert
        const batchSize = 100;
        let insertedCount = 0;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { error } = await supabase.from('sets').upsert(batch, { onConflict: 'code' });

            if (error) {
                console.error(`Error inserting batch ${i}:`, error.message);
            } else {
                insertedCount += batch.length;
                process.stdout.write(`\rInserted/Updated ${insertedCount} sets...`);
            }
        }

        console.log("\nSets population complete!");

    } catch (err: any) {
        console.error("Error fetching or populating sets:", err.message);
    }
}

main();
