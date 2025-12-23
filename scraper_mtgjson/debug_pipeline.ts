
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCardMappings(): Promise<Map<string, number>> {
    console.log('Fetching card mappings...');
    const mapping = new Map<string, number>();
    let from = 0;
    const size = 1000;
    let done = false;

    // Limit to 10k for debug speed if needed, or fetch all. 100k is fast enough usually.
    // We'll fetch 2 pages to be sure.

    while (!done) {
        console.log(`Fetching range ${from} to ${from + size - 1}...`);
        const { data, error } = await supabase
            .from('all_cards')
            .select('id, mtgjson_uuid')
            .range(from, from + size - 1);

        if (error) {
            console.error('Error fetching cards:', error);
            break;
        }

        if (!data || data.length === 0) {
            done = true;
            break;
        }

        data.forEach((card: any) => {
            if (card.mtgjson_uuid) {
                mapping.set(card.mtgjson_uuid, card.id);
            }
        });

        from += size;
        if (data.length < size) done = true;
    }

    console.log(`Loaded ${mapping.size} card mappings.`);
    return mapping;
}

async function debugPipeline() {
    console.log('--- DEBUG PIPELINE START ---');

    console.log('[1] Loading Mappings...');
    const cardMap = await getCardMappings();

    if (cardMap.size === 0) {
        console.error('CRITICAL: No card mappings found. Check all_cards table content.');
        return;
    }

    console.log('[2] Downloading AllPricesToday.json...');
    const url = 'https://mtgjson.com/api/v5/AllPricesToday.json';

    // Download small chunk or full? Full is needed to find matches if map is sparse?
    // We'll download full JSON but process only FIRST 100 entries to check structure.

    const response = await axios.get(url, { responseType: 'json' });
    const jsonData = response.data.data; // MTGJSON structure: { "data": { "UUID": ... } }

    if (!jsonData) {
        console.error('CRITICAL: No data in JSON response.');
        return;
    }

    const keys = Object.keys(jsonData);
    console.log(`[3] JSON Loaded. Total entries: ${keys.length}`);

    // Check first 50 entries
    console.log('[4] Checking matches...');
    let matches = 0;
    let attempts = 0;

    for (const uuid of keys) {
        attempts++;
        const mappedId = cardMap.get(uuid);

        if (mappedId) {
            matches++;
            if (matches <= 5) {
                console.log(`[MATCH] UUID ${uuid} -> ID ${mappedId}`);
                // Check internal structure
                const priceData = jsonData[uuid];
                const ck_buylist = priceData?.paper?.cardkingdom?.buylist;
                if (ck_buylist) {
                    console.log(`   -> Found CK Buylist data:`, JSON.stringify(ck_buylist).substring(0, 100) + '...');
                } else {
                    console.log(`   -> NO CK Buylist data for this card.`);
                }
            }
        }

        if (attempts >= 1000) break; // Check first 1000
    }

    console.log(`Checked ${attempts} entries. Found ${matches} ID matches.`);

    if (matches === 0) {
        console.error('CRITICAL: Zero matches found in sample. UUIDs might differ or map is empty.');
        // Log a sample UUID from map and from JSON
        console.log('Sample UUID from Map:', Array.from(cardMap.keys())[0]);
        console.log('Sample UUID from JSON:', keys[0]);
    } else {
        console.log('Pipeline looks healthy. Issue might be in the insertion filter logic in index.ts');
    }
}

debugPipeline();
